import os
import argparse
import logging
from pathlib import Path
from ultralytics import YOLO

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("train_sss_detector")

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DATA_YAML = PROJECT_ROOT / "data" / "sonar.yaml"
OUTPUT_WEIGHTS_DIR = PROJECT_ROOT / "backend" / "weights"
OUTPUT_WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)

def train_model(
    epochs: int = 5,
    batch_size: int = 16,
    img_size: int = 320,
    lr0: float = 0.01,
    base_model: str = "yolov8n.pt",
    device: str = "cpu"
):
    """
    Trains/Fine-tunes YOLOv8 on Side-Scan Sonar target dataset.
    Saves the best fine-tuned weights to backend/weights/best_sss_yolov8.pt.
    """
    logger.info("Initializing SSS Deep Learning Model Fine-Tuning Pipeline...")
    logger.info(f"Dataset config: {DATA_YAML}")
    logger.info(f"Hyperparameters: epochs={epochs}, batch={batch_size}, imgsz={img_size}, lr0={lr0}, base={base_model}")

    model = YOLO(base_model)

    # Train model
    results = model.train(
        data=str(DATA_YAML),
        epochs=epochs,
        batch=batch_size,
        imgsz=img_size,
        lr0=lr0,
        device=device,
        project=str(PROJECT_ROOT / "backend" / "ml" / "runs"),
        name="sss_yolo_experiment",
        exist_ok=True,
        verbose=True,
        plots=True
    )

    # Copy best weights to backend/weights/best_sss_yolov8.pt
    best_weights_path = Path(results.save_dir) / "weights" / "best.pt"
    dest_path = OUTPUT_WEIGHTS_DIR / "best_sss_yolov8.pt"

    if best_weights_path.exists():
        import shutil
        shutil.copy(best_weights_path, dest_path)
        logger.info(f"Successfully trained and saved verified SSS model to {dest_path}")
    else:
        # If best.pt not found, save current model state
        model.save(str(dest_path))
        logger.info(f"Model saved to {dest_path}")

    return dest_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train SSS YOLOv8 Detector")
    parser.add_argument("--epochs", type=int, default=10, help="Number of epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--device", type=str, default="cpu", help="Device (cpu or 0)")
    args = parser.parse_args()

    train_model(epochs=args.epochs, batch_size=args.batch, img_size=args.imgsz, device=args.device)
