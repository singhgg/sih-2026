import cv2
import json
import math
import logging
import numpy as np
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

EARTH_RADIUS = 6378137.0  # in meters

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates physical geodesic distance in meters between two GPS coordinates."""
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS * c

def detect_shadow_metrics(
    image: np.ndarray, 
    bbox_x: int, 
    bbox_y: int, 
    bbox_w: int, 
    bbox_h: int, 
    is_starboard: bool
) -> Tuple[int, float]:
    """
    Scans horizontal row profile adjacent to the object away from the center nadir trackline.
    Returns:
        (shadow_len_px, shadow_contrast_ratio)
    """
    h, w = image.shape[:2]
    
    y_start = max(0, bbox_y - bbox_h // 2)
    y_end = min(h, bbox_y + bbox_h // 2 + 1)
    
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    # Extract vertical slice across target height
    target_crop = gray[y_start:y_end, max(0, bbox_x - bbox_w // 2):min(w, bbox_x + bbox_w // 2)]
    target_mean = np.mean(target_crop) if target_crop.size > 0 else 128.0

    # Extract horizontal profile across target vertical span
    row_slice = gray[y_start:y_end, :]
    # Use 30th percentile or mean to capture acoustic shadow even if bbox extends into seabed
    profile = np.percentile(row_slice, 30, axis=0) if row_slice.shape[0] > 2 else np.mean(row_slice, axis=0)

    # Local background intensity
    local_bg = float(np.mean(profile))
    shadow_threshold = max(20.0, local_bg * 0.50)  # Pixels < 50% of local background mean

    shadow_len = 0
    shadow_intensities = []

    if is_starboard:
        start_x = bbox_x + bbox_w // 2
        for x in range(start_x, min(w, start_x + 250)):
            val = float(profile[x])
            if val < shadow_threshold:
                shadow_len += 1
                shadow_intensities.append(val)
            elif shadow_len > 4:
                break
    else:
        start_x = bbox_x - bbox_w // 2
        for x in range(start_x, max(0, start_x - 250), -1):
            val = float(profile[x])
            if val < shadow_threshold:
                shadow_len += 1
                shadow_intensities.append(val)
            elif shadow_len > 4:
                break

    # Contrast ratio between target highlight and shadow
    shadow_mean = np.mean(shadow_intensities) if shadow_intensities else local_bg
    contrast_ratio = float((target_mean + 1e-5) / (shadow_mean + 1e-5))

    return shadow_len, contrast_ratio

def calculate_geometry_score(bbox_w: int, bbox_h: int, class_name: str) -> float:
    """
    Computes geometric plausibility score (0-100) based on target class aspect ratio and compactness.
    """
    aspect = float(bbox_w) / max(1.0, float(bbox_h))
    area = bbox_w * bbox_h

    if class_name == "pipe":
        # Linear structure: expects elongated aspect ratio (> 2.0 or < 0.5)
        if aspect > 2.0 or aspect < 0.5:
            score = 90.0
        else:
            score = 55.0
    elif class_name == "shipwreck":
        # Hull structure: expects substantial area (> 1500px) and moderate aspect
        if area > 1200:
            score = min(98.0, 70.0 + (area / 3000.0) * 25.0)
        else:
            score = 65.0
    else:
        # General debris: moderate compactness
        score = 80.0

    return float(round(score, 1))

def calculate_context_score(image: np.ndarray, bbox_x: int, bbox_y: int, bbox_w: int, bbox_h: int) -> float:
    """
    Computes acoustic target-to-background contrast score (0-100).
    """
    h, w = image.shape[:2]
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image

    x1 = max(0, bbox_x - bbox_w // 2)
    y1 = max(0, bbox_y - bbox_h // 2)
    x2 = min(w, bbox_x + bbox_w // 2)
    y2 = min(h, bbox_y + bbox_h // 2)

    target_crop = gray[y1:y2, x1:x2]
    if target_crop.size == 0:
        return 50.0

    target_mean = np.mean(target_crop)

    # Sample surrounding context ring (30px padding around target)
    pad = 30
    cx1, cy1 = max(0, x1 - pad), max(0, y1 - pad)
    cx2, cy2 = min(w, x2 + pad), min(h, y2 + pad)
    context_crop = gray[cy1:cy2, cx1:cx2]
    bg_mean = np.mean(context_crop) if context_crop.size > 0 else 128.0

    contrast_delta = abs(target_mean - bg_mean)
    # Higher contrast delta indicates prominent acoustic anomaly
    score = min(98.0, max(40.0, 50.0 + (contrast_delta / 80.0) * 45.0))
    return float(round(score, 1))

class GeoEstimator:
    def __init__(self, swath_range: float = 100.0):
        self.swath_range = swath_range

    def process_detections(
        self, 
        detections: List[Dict[str, Any]], 
        image: np.ndarray, 
        ping_records: Optional[List[Dict[str, Any]]] = None
    ) -> List[Dict[str, Any]]:
        """
        Phase 5 Dynamic Anomaly Intelligence:
        1. Evaluates multi-signal evidence: model confidence, shadow score, geometry score, context score.
        2. Computes composite validation score and final anomaly score.
        3. Computes physical dimensions (L, W, H).
        4. Performs direct georeferencing when real metadata is present (or returns 'unavailable' gracefully if missing).
        5. Assigns dynamic explainable priority (HIGH, MEDIUM, LOW) and evidence reasons.
        """
        h, w = image.shape[:2]
        center_x = w / 2.0

        # Check if valid real ping records with non-zero coordinates exist
        has_valid_pings = False
        sorted_pings = []
        if ping_records and len(ping_records) > 0:
            sorted_pings = sorted(ping_records, key=lambda x: x.get("ping_number", 0))
            # Verify coordinates are valid non-zero
            if any(p.get("latitude", 0.0) != 0.0 and p.get("longitude", 0.0) != 0.0 for p in sorted_pings):
                has_valid_pings = True

        # Calculate along-track resolution if pings exist
        if has_valid_pings and len(sorted_pings) > 1:
            p1 = sorted_pings[0]
            pn = sorted_pings[-1]
            total_dist = haversine_distance(p1["latitude"], p1["longitude"], pn["latitude"], pn["longitude"])
            along_track_res = total_dist / max(1, len(sorted_pings))
        else:
            along_track_res = 0.15  # Default estimated meter-per-ping scale for dimensioning

        across_track_res = self.swath_range / max(1.0, center_x)

        processed = []
        for det in detections:
            bx, by = det["bbox_x"], det["bbox_y"]
            bw, bh = det["bbox_w"], det["bbox_h"]
            class_name = det.get("class_name", "debris")
            raw_model_conf = float(det.get("confidence", 70.0))

            is_starboard = bx >= center_x
            dx_pixel = abs(bx - center_x)
            slant_range = (dx_pixel / center_x) * self.swath_range

            # --- Physical Shadow & 3D Height Analysis ---
            shadow_px, contrast_ratio = detect_shadow_metrics(image, bx, by, bw, bh, is_starboard)
            shadow_m = shadow_px * across_track_res

            # Retrieve towfish altitude for height calculation
            altitude = 12.0
            if has_valid_pings:
                ping_idx = min(int(by), len(sorted_pings) - 1)
                altitude = sorted_pings[ping_idx].get("altitude", 12.0)

            if shadow_m > 0 and slant_range > 0:
                est_height = (altitude * shadow_m) / (slant_range + shadow_m)
            else:
                est_height = None

            # --- Multi-Signal Score Calculation ---
            # 1. Shadow Score
            if shadow_px > 4:
                shadow_score = float(min(98.0, 60.0 + min(35.0, shadow_px * 2.0)))
            else:
                shadow_score = None  # Weak or no shadow

            # 2. Geometry Score
            geometry_score = calculate_geometry_score(bw, bh, class_name)

            # 3. Context Score
            context_score = calculate_context_score(image, bx, by, bw, bh)

            # 4. Composite Validation Score (combining physical evidence)
            valid_signals = [geometry_score, context_score]
            if shadow_score is not None:
                valid_signals.append(shadow_score)
            validation_score = float(round(np.mean(valid_signals), 1))

            # 5. Final Calibrated Anomaly Score (60% Model Confidence + 40% Validation Evidence)
            if shadow_score is not None:
                # Strong physical shadow evidence supports target
                final_anomaly_score = float(round(0.60 * raw_model_conf + 0.40 * validation_score, 1))
            else:
                # Weak / no shadow: Do not reject blindly (partially buried / flat target handling)
                # Apply mild scaling factor
                final_anomaly_score = float(round(0.70 * raw_model_conf + 0.30 * validation_score * 0.85, 1))

            # --- Metric Dimensions ---
            est_width = round(bw * across_track_res, 2)
            est_length = round(bh * along_track_res, 2)
            est_height_final = round(est_height, 2) if (est_height is not None and est_height > 0.1) else None

            # --- Georeferencing & Spatial Uncertainty ---
            lat_obj = None
            lon_obj = None
            geo_status = "unavailable"
            geo_uncertainty = None

            if has_valid_pings:
                ping_idx = min(int(by), len(sorted_pings) - 1)
                p_data = sorted_pings[ping_idx]

                lat_s = p_data["latitude"]
                lon_s = p_data["longitude"]
                heading = p_data.get("heading", 0.0)
                alt_s = p_data.get("altitude", 10.0)

                # Ground range calculation: Rg = sqrt(Rs^2 - H^2)
                if slant_range > alt_s:
                    ground_range = math.sqrt(slant_range**2 - alt_s**2)
                else:
                    ground_range = 0.0

                # Bearing offset: +90 deg for Starboard, -90 deg for Port
                bearing = heading + 90.0 if is_starboard else heading - 90.0
                bearing_rad = math.radians(bearing)
                lat_rad = math.radians(lat_s)

                delta_lat = (ground_range * math.cos(bearing_rad)) / EARTH_RADIUS
                delta_lon = (ground_range * math.sin(bearing_rad)) / (EARTH_RADIUS * math.cos(lat_rad))

                lat_obj = round(lat_s + math.degrees(delta_lat), 6)
                lon_obj = round(lon_s + math.degrees(delta_lon), 6)
                geo_status = "valid"

                # Dynamic Geospatial Uncertainty Estimation
                # delta_pos = sqrt(ping_spacing^2 + range_resolution^2 + heading_jitter^2)
                range_res = self.swath_range / 1000.0  # acoustic sampling resolution
                geo_uncertainty = round(math.sqrt(along_track_res**2 + range_res**2 + 1.2**2), 2)

            # --- Dynamic Prioritization & Explainable Reasoning ---
            reasons = []
            if raw_model_conf >= 80.0:
                reasons.append(f"High model confidence ({raw_model_conf:.1f}%)")
            elif raw_model_conf >= 60.0:
                reasons.append(f"Moderate model confidence ({raw_model_conf:.1f}%)")

            if shadow_score is not None:
                reasons.append(f"Confirmed acoustic shadow ({est_height_final}m height)")
            else:
                reasons.append("Low-relief / partial burial acoustic profile")

            if context_score >= 70.0:
                reasons.append("High contrast relative to surrounding seafloor")

            if geo_status == "valid":
                reasons.append(f"Direct georeferenced position (±{geo_uncertainty}m uncertainty)")

            # Assign Priority Tier
            if final_anomaly_score >= 78.0 and (shadow_score is not None or raw_model_conf >= 85.0):
                priority = "HIGH"
            elif final_anomaly_score >= 55.0:
                priority = "MEDIUM"
            else:
                priority = "LOW"

            processed.append({
                "class_name": class_name,
                "confidence": final_anomaly_score,
                "model_confidence": round(raw_model_conf, 1),
                "shadow_score": round(shadow_score, 1) if shadow_score is not None else None,
                "geometry_score": round(geometry_score, 1),
                "context_score": round(context_score, 1),
                "validation_score": round(validation_score, 1),
                "final_anomaly_score": round(final_anomaly_score, 1),
                "priority": priority,
                "priority_reasons": json.dumps(reasons),
                "bbox_x": int(bx),
                "bbox_y": int(by),
                "bbox_w": int(bw),
                "bbox_h": int(bh),
                "est_width": est_width,
                "est_length": est_length,
                "est_height": est_height_final,
                "latitude": lat_obj,
                "longitude": lon_obj,
                "geolocation_status": geo_status,
                "geo_uncertainty_m": geo_uncertainty
            })

        return processed
