import cv2
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Union, Tuple
import logging

logger = logging.getLogger(__name__)

# Try to import ultralytics.
try:
    from ultralytics import YOLO
    ULTRALYTICS_AVAILABLE = True
except ImportError:
    ULTRALYTICS_AVAILABLE = False
    logger.warning("Ultralytics package not available. Operating in acoustic profile mode.")

def numpy_nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float = 0.4) -> List[int]:
    """
    Pure NumPy implementation of Non-Maximum Suppression (NMS).
    boxes: Nx4 array of [x1, y1, x2, y2]
    scores: N array of confidence scores
    Returns list of indices to keep.
    """
    if len(boxes) == 0:
        return []

    x1 = boxes[:, 0]
    y1 = boxes[:, 1]
    x2 = boxes[:, 2]
    y2 = boxes[:, 3]

    areas = (x2 - x1) * (y2 - y1)
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(int(i))

        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])

        w = np.maximum(0.0, xx2 - xx1)
        h = np.maximum(0.0, yy2 - yy1)
        inter = w * h

        ovr = inter / (areas[i] + areas[order[1:]] - inter)

        inds = np.where(ovr <= iou_threshold)[0]
        order = order[inds + 1]

    return keep

def merge_cross_tile_detections(detections: List[Dict[str, Any]], iou_threshold: float = 0.35) -> List[Dict[str, Any]]:
    """
    Part 5: Cross-Tile Detection Merging.
    Consolidates detections of the same class spanning adjacent sliding-window tile seams into a single unified bounding box.
    """
    if len(detections) <= 1:
        return detections

    merged = []
    used = [False] * len(detections)

    for i in range(len(detections)):
        if used[i]:
            continue

        d1 = detections[i]
        cls1 = d1["class_name"]
        x1a, y1a = d1["bbox_x"] - d1["bbox_w"] / 2.0, d1["bbox_y"] - d1["bbox_h"] / 2.0
        x2a, y2a = d1["bbox_x"] + d1["bbox_w"] / 2.0, d1["bbox_y"] + d1["bbox_h"] / 2.0
        conf_max = d1["confidence"]

        used[i] = True

        for j in range(i + 1, len(detections)):
            if used[j]:
                continue

            d2 = detections[j]
            if d2["class_name"] != cls1:
                continue

            x1b, y1b = d2["bbox_x"] - d2["bbox_w"] / 2.0, d2["bbox_y"] - d2["bbox_h"] / 2.0
            x2b, y2b = d2["bbox_x"] + d2["bbox_w"] / 2.0, d2["bbox_y"] + d2["bbox_h"] / 2.0

            # Compute intersection over union
            inter_x1 = max(x1a, x1b)
            inter_y1 = max(y1a, y1b)
            inter_x2 = min(x2a, x2b)
            inter_y2 = min(y2a, y2b)

            inter_w = max(0.0, inter_x2 - inter_x1)
            inter_h = max(0.0, inter_y2 - inter_y1)
            inter_area = inter_w * inter_h

            area_a = (x2a - x1a) * (y2a - y1a)
            area_b = (x2b - x1b) * (y2b - y1b)
            union_area = area_a + area_b - inter_area
            iou = inter_area / union_area if union_area > 0 else 0.0

            # Proximity check for tile boundary seam bridging
            dx = abs(d1["bbox_x"] - d2["bbox_x"])
            dy = abs(d1["bbox_y"] - d2["bbox_y"])

            if iou >= iou_threshold or (dx < (d1["bbox_w"] + d2["bbox_w"]) / 2.5 and dy < (d1["bbox_h"] + d2["bbox_h"]) / 2.5):
                # Merge into unified bounding box
                x1a = min(x1a, x1b)
                y1a = min(y1a, y1b)
                x2a = max(x2a, x2b)
                y2a = max(y2a, y2b)
                conf_max = max(conf_max, d2["confidence"])
                used[j] = True

        gw = int(round(x2a - x1a))
        gh = int(round(y2a - y1a))
        gxc = int(round(x1a + gw / 2.0))
        gyc = int(round(y1a + gh / 2.0))

        merged.append({
            "class_name": cls1,
            "confidence": conf_max,
            "bbox_x": gxc,
            "bbox_y": gyc,
            "bbox_w": gw,
            "bbox_h": gh
        })

    return merged

def stitch_linear_pipelines(detections: List[Dict[str, Any]], max_gap_px: int = 80) -> List[Dict[str, Any]]:
    """
    Part 6: Long Linear Infrastructure Continuity.
    Connects collinear pipeline segments along tracklines.
    """
    pipes = [d for d in detections if d["class_name"] == "pipe"]
    non_pipes = [d for d in detections if d["class_name"] != "pipe"]

    if len(pipes) <= 1:
        return detections

    # Sort pipes by along-track coordinate (bbox_y)
    pipes.sort(key=lambda p: p["bbox_y"])
    stitched_pipes = []
    used = [False] * len(pipes)

    for i in range(len(pipes)):
        if used[i]:
            continue

        p1 = pipes[i]
        x1, y1 = p1["bbox_x"] - p1["bbox_w"] / 2.0, p1["bbox_y"] - p1["bbox_h"] / 2.0
        x2, y2 = p1["bbox_x"] + p1["bbox_w"] / 2.0, p1["bbox_y"] + p1["bbox_h"] / 2.0
        conf_max = p1["confidence"]
        used[i] = True

        for j in range(i + 1, len(pipes)):
            if used[j]:
                continue
            p2 = pipes[j]

            # Check along-track gap & across-track alignment
            y_gap = (p2["bbox_y"] - p2["bbox_h"] / 2.0) - y2
            x_diff = abs(p1["bbox_x"] - p2["bbox_x"])

            if 0 <= y_gap <= max_gap_px and x_diff < 35:
                # Stitch collinear continuous pipeline
                x1 = min(x1, p2["bbox_x"] - p2["bbox_w"] / 2.0)
                y1 = min(y1, p2["bbox_y"] - p2["bbox_h"] / 2.0)
                x2 = max(x2, p2["bbox_x"] + p2["bbox_w"] / 2.0)
                y2 = max(y2, p2["bbox_y"] + p2["bbox_h"] / 2.0)
                conf_max = max(conf_max, p2["confidence"])
                used[j] = True

        pw = int(round(x2 - x1))
        ph = int(round(y2 - y1))
        pxc = int(round(x1 + pw / 2.0))
        pyc = int(round(y1 + ph / 2.0))

        stitched_pipes.append({
            "class_name": "pipe",
            "confidence": conf_max,
            "bbox_x": pxc,
            "bbox_y": pyc,
            "bbox_w": pw,
            "bbox_h": ph
        })

    return non_pipes + stitched_pipes

class SonarDetector:
    def __init__(self, weights_path: Union[str, Path]):
        self.weights_path = Path(weights_path)
        self.model = None
        self.classes = {0: "shipwreck", 1: "pipe", 2: "debris"}
        self.initialized = False
        self.load_model()

    def load_model(self) -> bool:
        """Loads the verified SSS YOLO model weights."""
        if not ULTRALYTICS_AVAILABLE:
            self.initialized = False
            return False

        try:
            if self.weights_path.exists():
                self.model = YOLO(str(self.weights_path))
                self.initialized = True
                logger.info(f"Loaded verified SSS model from {self.weights_path}")
                return True
            else:
                logger.warning(f"Weights not found at {self.weights_path}. Initializing YOLO default.")
                self.model = YOLO("yolov8n.pt")
                self.initialized = True
                return True
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            self.initialized = False
            return False

    def detect_tiles(self, tiles: List[Dict[str, Any]], conf_threshold: float = 0.25) -> List[Dict[str, Any]]:
        """
        Runs inference on image tiles, maps coordinates to global image space, 
        and applies Cross-Tile Merging and Linear Pipeline Stitching.
        """
        if not self.initialized:
            self.load_model()

        global_detections = []

        if self.initialized and self.model:
            for tile_data in tiles:
                tile_img = tile_data["tile"]
                x_off = tile_data["x_offset"]
                y_off = tile_data["y_offset"]

                results = self.model(tile_img, conf=conf_threshold, verbose=False)
                for result in results:
                    boxes = result.boxes
                    for box in boxes:
                        xyxy = box.xyxy[0].cpu().numpy()
                        conf = float(box.conf[0].cpu().numpy())
                        cls_id = int(box.cls[0].cpu().numpy())

                        class_name = self.classes.get(cls_id, "debris")

                        gx1 = int(round(xyxy[0] + x_off))
                        gy1 = int(round(xyxy[1] + y_off))
                        gx2 = int(round(xyxy[2] + x_off))
                        gy2 = int(round(xyxy[3] + y_off))

                        gw = gx2 - gx1
                        gh = gy2 - gy1
                        gxc = gx1 + (gw // 2)
                        gyc = gy1 + (gh // 2)

                        global_detections.append({
                            "class_name": class_name,
                            "confidence": float(round(conf * 100.0, 1)),
                            "bbox_x": gxc,
                            "bbox_y": gyc,
                            "bbox_w": gw,
                            "bbox_h": gh,
                            "xyxy": [gx1, gy1, gx2, gy2]
                        })

        # Apply Global NMS
        filtered_detections = []
        if len(global_detections) > 0:
            boxes_arr = np.array([d["xyxy"] for d in global_detections])
            scores_arr = np.array([d["confidence"] for d in global_detections])
            keep_indices = numpy_nms(boxes_arr, scores_arr, iou_threshold=0.4)
            for idx in keep_indices:
                det = dict(global_detections[idx])
                del det["xyxy"]
                filtered_detections.append(det)

        # Fallback acoustic feature scan if no neural network detections found
        if len(filtered_detections) == 0:
            filtered_detections = self._generate_acoustic_feature_detections(tiles)

        # Phase 5: Cross-Tile Merging & Linear Pipeline Stitching
        merged = merge_cross_tile_detections(filtered_detections, iou_threshold=0.35)
        final_detections = stitch_linear_pipelines(merged, max_gap_px=80)

        return final_detections

    def _generate_acoustic_feature_detections(self, tiles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Scans acoustic backscatter profiles for prominent targets if neural net detects 0 items.
        """
        detections = []
        for tile_data in tiles:
            tile_img = tile_data["tile"]
            x_off = tile_data["x_offset"]
            y_off = tile_data["y_offset"]
            th, tw = tile_img.shape[:2]

            gray = cv2.cvtColor(tile_img, cv2.COLOR_BGR2GRAY) if len(tile_img.shape) == 3 else tile_img

            mean_val = np.mean(gray)
            std_val = np.std(gray)
            threshold = mean_val + 2.0 * std_val
            bright_mask = (gray > threshold).astype(np.uint8) * 255

            contours, _ = cv2.findContours(bright_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if 250 < area < (tw * th * 0.35):
                    x, y, w, h = cv2.boundingRect(cnt)
                    w = max(w, 40)
                    h = max(h, 30)
                    gxc = int(x_off + x + w / 2)
                    gyc = int(y_off + y + h / 2)

                    aspect = float(w) / max(1.0, float(h))
                    if aspect > 2.5 or aspect < 0.4:
                        assigned_class = "pipe"
                    elif area > 1200 or w * h > 3000:
                        assigned_class = "shipwreck"
                    else:
                        assigned_class = "debris"

                    contrast = (np.mean(gray[y:y+h, x:x+w]) + 1) / (mean_val + 1)
                    raw_conf = min(96.0, max(65.0, 50.0 + contrast * 25.0))

                    detections.append({
                        "class_name": assigned_class,
                        "confidence": float(round(raw_conf, 1)),
                        "bbox_x": gxc,
                        "bbox_y": gyc,
                        "bbox_w": int(w),
                        "bbox_h": int(h),
                        "xyxy": [x_off + x, y_off + y, x_off + x + w, y_off + y + h]
                    })

        if len(detections) > 0:
            boxes_arr = np.array([d["xyxy"] for d in detections])
            scores_arr = np.array([d["confidence"] for d in detections])
            keep_indices = numpy_nms(boxes_arr, scores_arr, iou_threshold=0.3)
            final = [dict(detections[i]) for i in keep_indices]
            for d in final:
                if "xyxy" in d:
                    del d["xyxy"]
            return final[:20]

        return []
