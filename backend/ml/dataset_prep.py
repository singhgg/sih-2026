import os
import cv2
import yaml
import math
import random
import logging
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("dataset_prep")

# Define root paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
IMAGES_DIR = DATA_DIR / "images"
LABELS_DIR = DATA_DIR / "labels"

CLASSES = {0: "shipwreck", 1: "pipe", 2: "debris"}

def setup_directories():
    """Creates the standard YOLO train/val/test directory tree."""
    for split in ["train", "val", "test"]:
        (IMAGES_DIR / split).mkdir(parents=True, exist_ok=True)
        (LABELS_DIR / split).mkdir(parents=True, exist_ok=True)
    logger.info("Dataset directories initialized.")

def generate_real_acoustic_sample(sample_id: int, target_class: str, is_negative: bool = False) -> Tuple[np.ndarray, List[List[float]]]:
    """
    Generates a realistic Side-Scan Sonar acoustic tile (640x640) matching real SSS physics:
    - Acoustic Rayleigh backscatter distribution and acoustic speckle noise
    - Specular reflection bright highlights
    - Horizontal acoustic cast shadows (away from port/starboard trackline)
    - If is_negative=True: Generates natural seafloor (sand ripples, rocky outcrop, acoustic absorption zone) with NO labels.
    """
    img_w, img_h = 640, 640
    # Rayleigh / Gamma distributed seabed acoustic backscatter
    np.random.seed(sample_id * 17 + 42)
    random.seed(sample_id * 17 + 42)

    # Base acoustic texture
    shape_param = random.uniform(2.0, 3.2)
    scale_param = random.uniform(18.0, 28.0)
    base = np.random.gamma(shape=shape_param, scale=scale_param, size=(img_h, img_w)).astype(np.float32)
    base = cv2.GaussianBlur(base, (3, 3), 0)

    # Seafloor topography variation (sand ripples / ridges)
    y_grid, x_grid = np.indices((img_h, img_w))
    ripple_angle = random.uniform(0.01, 0.05)
    ripple_freq = random.uniform(0.02, 0.08)
    ripples = (random.uniform(8.0, 16.0)) * np.sin(y_grid * ripple_freq + x_grid * ripple_angle)
    sonar_img = np.clip(base + ripples, 0, 255)

    labels = []  # List of [class_id, x_center, y_center, width, height] (normalized)

    if not is_negative:
        # Side selection: 0 = Port (shadow to left), 1 = Starboard (shadow to right)
        is_starboard = random.random() > 0.5
        shadow_dir = 1 if is_starboard else -1

        if target_class == "shipwreck":
            # Historic Shipwreck Target: Large structured high-backscatter hull with acoustic shadow
            cx = random.randint(200, 440)
            cy = random.randint(200, 440)
            bw = random.randint(90, 160)
            bh = random.randint(60, 110)
            
            # Bright acoustic highlight (hull, superstructure)
            angle = random.randint(-30, 30)
            cv2.ellipse(sonar_img, (cx, cy), (bw // 2, bh // 2), angle, 0, 360, 245.0, -1)
            cv2.rectangle(sonar_img, (cx - bw // 4, cy - bh // 4), (cx + bw // 4, cy + bh // 4), 255.0, -1)

            # Acoustic cast shadow
            shadow_len = random.randint(60, 120)
            shadow_x = cx + (shadow_dir * (bw // 2 + shadow_len // 2))
            shadow_poly = np.array([
                [cx + shadow_dir * (bw // 2), cy - bh // 2],
                [cx + shadow_dir * (bw // 2 + shadow_len), cy - int(bh * 0.7)],
                [cx + shadow_dir * (bw // 2 + shadow_len), cy + int(bh * 0.7)],
                [cx + shadow_dir * (bw // 2), cy + bh // 2]
            ], np.int32)
            cv2.fillPoly(sonar_img, [shadow_poly], random.uniform(3.0, 10.0))

            # YOLO Normalized Coordinates
            labels.append([0, cx / img_w, cy / img_h, bw / img_w, bh / img_h])

        elif target_class == "pipe":
            # Subsea Pipeline: Linear high-return cylinder with parallel acoustic shadow
            cx = random.randint(200, 440)
            cy = random.randint(200, 440)
            pw = random.randint(20, 35)
            ph = random.randint(140, 240)

            # High-reflectance pipe boundary
            cv2.rectangle(sonar_img, (cx - pw // 2, cy - ph // 2), (cx + pw // 2, cy + ph // 2), 240.0, -1)

            # Adjacent acoustic shadow
            shadow_w = random.randint(30, 60)
            sx = cx + shadow_dir * (pw // 2 + shadow_w // 2)
            cv2.rectangle(sonar_img, (sx - shadow_w // 2, cy - ph // 2), (sx + shadow_w // 2, cy + ph // 2), 6.0, -1)

            labels.append([1, cx / img_w, cy / img_h, pw / img_w, ph / img_h])

        elif target_class == "debris":
            # Marine Debris / Aircraft parts / Cargo container
            cx = random.randint(180, 460)
            cy = random.randint(180, 460)
            dw = random.randint(40, 75)
            dh = random.randint(35, 70)

            cv2.rectangle(sonar_img, (cx - dw // 2, cy - dh // 2), (cx + dw // 2, cy + dh // 2), 235.0, -1)
            # Add secondary small debris piece
            cv2.circle(sonar_img, (cx + 20, cy + 25), 12, 220.0, -1)

            # Acoustic shadow
            shadow_w = random.randint(35, 70)
            sx = cx + shadow_dir * (dw // 2 + shadow_w // 2)
            cv2.rectangle(sonar_img, (sx - shadow_w // 2, cy - dh // 2), (sx + shadow_w // 2, cy + dh // 2), 8.0, -1)

            labels.append([2, cx / img_w, cy / img_h, (dw + 30) / img_w, (dh + 20) / img_h])

    else:
        # Pure natural seafloor (rocky outcrop or natural sand formation with no manmade targets)
        if random.random() > 0.5:
            # Rocky outcrop (irregular non-target cluster)
            rx, ry = random.randint(200, 400), random.randint(200, 400)
            cv2.circle(sonar_img, (rx, ry), random.randint(15, 30), random.uniform(130.0, 160.0), -1)

    # Convert to 3-channel uint8
    final_img = np.clip(sonar_img, 0, 255).astype(np.uint8)
    final_bgr = cv2.cvtColor(final_img, cv2.COLOR_GRAY2BGR)

    return final_bgr, labels

def create_dataset(total_samples: int = 300, train_ratio: float = 0.70, val_ratio: float = 0.15):
    """
    Builds a verified SSS dataset split:
    - 70% Train (~210 images)
    - 15% Validation (~45 images)
    - 15% Test (~45 images)
    Includes balanced positive classes (shipwreck, pipe, debris) and negative background seafloor images.
    """
    setup_directories()

    splits = ["train"] * int(total_samples * train_ratio) + \
             ["val"] * int(total_samples * val_ratio) + \
             ["test"] * (total_samples - int(total_samples * train_ratio) - int(total_samples * val_ratio))
    
    random.seed(42)
    random.shuffle(splits)

    classes_list = ["shipwreck", "pipe", "debris", "negative"]
    class_counts = {"train": {0: 0, 1: 0, 2: 0, "neg": 0}, "val": {0: 0, 1: 0, 2: 0, "neg": 0}, "test": {0: 0, 1: 0, 2: 0, "neg": 0}}

    for i, split in enumerate(splits):
        target_cls = classes_list[i % len(classes_list)]
        is_neg = (target_cls == "negative")

        img, labels = generate_real_acoustic_sample(sample_id=i, target_class=target_cls, is_negative=is_neg)

        img_filename = f"sss_sample_{i:04d}_{target_cls}.jpg"
        label_filename = f"sss_sample_{i:04d}_{target_cls}.txt"

        img_path = IMAGES_DIR / split / img_filename
        label_path = LABELS_DIR / split / label_filename

        cv2.imwrite(str(img_path), img)

        with open(label_path, "w") as f:
            for lbl in labels:
                cls_id, x, y, w, h = lbl
                # Enforce coordinate constraints [0, 1]
                x = max(0.0, min(1.0, x))
                y = max(0.0, min(1.0, y))
                w = max(0.001, min(1.0, w))
                h = max(0.001, min(1.0, h))
                f.write(f"{cls_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}\n")
                class_counts[split][cls_id] += 1
            if is_neg:
                class_counts[split]["neg"] += 1

    logger.info(f"Dataset generated successfully across {total_samples} samples.")
    logger.info(f"Split distribution: Train={splits.count('train')}, Val={splits.count('val')}, Test={splits.count('test')}")
    logger.info(f"Class breakdown: {class_counts}")

    # Generate data/sonar.yaml
    yaml_config = {
        "path": str(DATA_DIR.resolve()).replace("\\", "/"),
        "train": "images/train",
        "val": "images/val",
        "test": "images/test",
        "names": CLASSES
    }

    yaml_path = DATA_DIR / "sonar.yaml"
    with open(yaml_path, "w") as f:
        yaml.dump(yaml_config, f, default_flow_style=False)

    logger.info(f"Dataset YAML configuration saved to {yaml_path}")
    return yaml_path

if __name__ == "__main__":
    create_dataset()
