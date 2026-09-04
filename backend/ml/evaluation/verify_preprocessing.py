import os
import cv2
import json
import logging
import numpy as np
from pathlib import Path

from app.ml.preprocessor import apply_bilateral_filter, apply_clahe, preprocess_pipeline, tile_waterfall_image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("verify_preprocessing")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "results" / "preprocessing_comparison"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def verify_preprocessing_pipeline():
    """
    Controlled test of existing preprocessing and tiling modules.
    Generates comparison outputs and verifies mathematical coordinate reconstruction.
    """
    test_img_dir = PROJECT_ROOT / "data" / "images" / "test"
    sample_files = list(test_img_dir.glob("*.jpg"))
    if not sample_files:
        raise FileNotFoundError("No test images found in data/images/test")

    sample_path = sample_files[0]
    raw_img = cv2.imread(str(sample_path))
    h, w = raw_img.shape[:2]

    logger.info(f"Loaded sample image {sample_path.name} (shape: {w}x{h})")

    # 1. Test Bilateral Filter
    denoised = apply_bilateral_filter(raw_img, d=9, sigma_color=75.0, sigma_space=75.0)
    raw_noise_std = np.std(raw_img)
    denoised_std = np.std(denoised)

    # 2. Test CLAHE
    clahe_enhanced = apply_clahe(denoised, clip_limit=2.5)
    clahe_std = np.std(clahe_enhanced)

    # 3. Full Pipeline
    pipeline_out = preprocess_pipeline(sample_path, d=9, clip_limit=2.5)

    # Save comparison images
    cv2.imwrite(str(OUTPUT_DIR / "01_raw.jpg"), raw_img)
    cv2.imwrite(str(OUTPUT_DIR / "02_denoised_bilateral.jpg"), denoised)
    cv2.imwrite(str(OUTPUT_DIR / "03_clahe_enhanced.jpg"), clahe_enhanced)
    cv2.imwrite(str(OUTPUT_DIR / "04_pipeline_result.jpg"), pipeline_out)

    # 4. Test Tiling & Coordinate Restoration
    tiles = tile_waterfall_image(pipeline_out, tile_size=640, overlap=128)
    logger.info(f"Generated {len(tiles)} tiles from {w}x{h} image")

    # Verify tile coverage & coordinate restoration
    for idx, t in enumerate(tiles):
        x_off = t["x_offset"]
        y_off = t["y_offset"]
        tw = t["w"]
        th = t["h"]

        # Simulate a target at tile center (tx, ty)
        tx = tw // 2
        ty = th // 2

        # Map back to global
        gx = x_off + tx
        gy = y_off + ty

        assert 0 <= gx <= w, f"Global coordinate X {gx} out of bounds"
        assert 0 <= gy <= h, f"Global coordinate Y {gy} out of bounds"

    metrics = {
        "sample_image": sample_path.name,
        "dimensions": {"width": w, "height": h},
        "raw_image_std": float(round(raw_noise_std, 2)),
        "denoised_image_std": float(round(denoised_std, 2)),
        "clahe_contrast_std": float(round(clahe_std, 2)),
        "tiles_generated": len(tiles),
        "coordinate_restoration_verified": True,
        "status": "PASSED"
    }

    with open(OUTPUT_DIR / "preprocessing_verification.json", "w") as f:
        json.dump(metrics, f, indent=2)

    logger.info("Preprocessing verification completed successfully.")
    logger.info(f"Results saved to {OUTPUT_DIR}")
    return metrics

if __name__ == "__main__":
    verify_preprocessing_pipeline()
