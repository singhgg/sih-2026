import os
import cv2
import json
import logging
from pathlib import Path

from app.ml.preprocessor import preprocess_pipeline, tile_waterfall_image
from app.ml.detector import SonarDetector
from app.ml.postprocessor import GeoEstimator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("real_inference_test")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
WEIGHTS_PATH = PROJECT_ROOT / "backend" / "weights" / "best_sss_yolov8.pt"
OUTPUT_DIR = PROJECT_ROOT / "results" / "real_inference_test"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def run_real_inference_test():
    """
    Runs end-to-end inference on held-out test SSS images:
    Image -> Preprocess (Bilateral + CLAHE) -> Tiling -> YOLO SSS Detector -> NMS -> GeoEstimator -> Annotated Output.
    """
    detector = SonarDetector(weights_path=WEIGHTS_PATH)
    geo_estimator = GeoEstimator(swath_range=100.0)

    test_images = list((PROJECT_ROOT / "data" / "images" / "test").glob("*.jpg"))
    # Pick a few target samples and background samples
    selected_samples = [img for img in test_images if "negative" not in img.name][:3]
    if not selected_samples and test_images:
        selected_samples = test_images[:3]

    results_summary = []

    for idx, img_path in enumerate(selected_samples):
        logger.info(f"Processing real SSS test scan: {img_path.name}")
        raw_img = cv2.imread(str(img_path))
        h, w = raw_img.shape[:2]

        # 1. Preprocess
        enhanced = preprocess_pipeline(raw_img, d=9, clip_limit=2.5)

        # 2. Tile
        tiles = tile_waterfall_image(enhanced, tile_size=640, overlap=128)

        # 3. Detect
        detections = detector.detect_tiles(tiles, conf_threshold=0.25)

        # 4. Geotag and calculate dimensions
        dummy_pings = [
            {"ping_number": i, "latitude": 36.8012 + (i * 0.00001), "longitude": -121.9475 + (i * 0.00001), "heading": 40.0, "speed": 4.5, "altitude": 12.0}
            for i in range(h)
        ]
        refined_detections = geo_estimator.process_detections(detections, enhanced, dummy_pings)

        # 5. Draw Annotations on output image
        annotated = enhanced.copy()
        for det in refined_detections:
            bx, by, bw, bh = det["bbox_x"], det["bbox_y"], det["bbox_w"], det["bbox_h"]
            x1, y1 = int(bx - bw // 2), int(by - bh // 2)
            x2, y2 = int(bx + bw // 2), int(by + bh // 2)

            color = (0, 255, 0) if det["confidence"] >= 75 else (0, 200, 255)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            label = f"{det['class_name']} {det['confidence']:.0f}% L:{det['est_length']:.1f}m"
            cv2.putText(annotated, label, (x1, max(15, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

        out_img_name = f"annotated_test_{idx+1}_{img_path.stem}.jpg"
        cv2.imwrite(str(OUTPUT_DIR / out_img_name), annotated)

        results_summary.append({
            "test_image": img_path.name,
            "dimensions": {"width": w, "height": h},
            "detections_count": len(refined_detections),
            "detections": refined_detections,
            "annotated_output_file": out_img_name
        })

    summary_file = OUTPUT_DIR / "real_inference_results.json"
    with open(summary_file, "w") as f:
        json.dump(results_summary, f, indent=2)

    logger.info(f"Real-world inference tests complete. Saved to {summary_file}")
    return results_summary

if __name__ == "__main__":
    run_real_inference_test()
