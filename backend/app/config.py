import os
from pathlib import Path

# Base Directory of the AQUASCAN project
BASE_DIR = Path(__file__).resolve().parent.parent

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aquascan.db")

# Upload and storage directories
STORAGE_DIR = BASE_DIR / "storage"
RAW_STORAGE_DIR = STORAGE_DIR / "raw"
PROCESSED_STORAGE_DIR = STORAGE_DIR / "processed"

# Model weights configuration (Prioritize fine-tuned SSS model, fallback to yolov8s.pt)
WEIGHTS_DIR = BASE_DIR / "weights"
SSS_FINE_TUNED_WEIGHTS = WEIGHTS_DIR / "best_sss_yolov8.pt"
MODEL_WEIGHTS_PATH = SSS_FINE_TUNED_WEIGHTS if SSS_FINE_TUNED_WEIGHTS.exists() else (WEIGHTS_DIR / "yolov8s.pt")

# Create necessary directories
RAW_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
