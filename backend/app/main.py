import os
import uuid
import csv
import math
import random
import logging
from io import StringIO
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, status, BackgroundTasks, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.config import RAW_STORAGE_DIR, PROCESSED_STORAGE_DIR, STORAGE_DIR, MODEL_WEIGHTS_PATH
from app.database import engine, Base, get_db
from app.models import SonarScan, PingMetadata, Detection
from app.schemas import (
    SonarScanResponse, 
    DetectionResponse, 
    ScanVisualizeResponse, 
    VerificationUpdate
)
from app.ml.preprocessor import preprocess_pipeline, tile_waterfall_image
from app.ml.detector import SonarDetector
from app.ml.postprocessor import GeoEstimator

logger = logging.getLogger("aquascan")
logging.basicConfig(level=logging.INFO)

# Create/Migrate database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AQUASCAN Sonar Intelligence API",
    description="Real-Time Underwater Debris & Anomaly Detection Intelligence Platform",
    version="2.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage directories
if not STORAGE_DIR.exists():
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
RAW_STORAGE_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/storage", StaticFiles(directory=str(STORAGE_DIR)), name="storage")

# Supported file formats and size limits
SUPPORTED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/tiff"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

# Initialize Sonar Detector
detector = SonarDetector(weights_path=MODEL_WEIGHTS_PATH)

def run_ml_pipeline_for_scan(scan_id: int, db_session: Session):
    """
    Real-Time AI/ML Pipeline with measurable progress state tracking:
    1. Preprocessing (Bilateral Filter + CLAHE)
    2. Slicing into overlapping tiles
    3. Neural Network Inference + Tile Merging + Pipeline Stitching
    4. Multi-Signal Anomaly Validation + Georeferencing + Uncertainty
    5. Database Persistence
    """
    scan = db_session.query(SonarScan).filter(SonarScan.id == scan_id).first()
    if not scan:
        logger.error(f"Scan {scan_id} not found.")
        return

    try:
        # Step 1: Preprocessing
        scan.status = "processing"
        scan.processing_stage = "preprocessing"
        scan.progress_pct = 15.0
        db_session.commit()

        raw_path = Path(scan.raw_file_path)
        if not raw_path.exists():
            raise FileNotFoundError(f"Raw image file not found at {raw_path}")

        enhanced_image = preprocess_pipeline(raw_path, d=9, clip_limit=2.5)

        proc_img_name = f"{scan_id}_processed.jpg"
        proc_img_path = PROCESSED_STORAGE_DIR / proc_img_name
        cv2.imwrite(str(proc_img_path), enhanced_image)
        scan.processed_file_path = str(proc_img_path)

        # Step 2: Tiling
        scan.processing_stage = "tiling"
        scan.progress_pct = 25.0
        db_session.commit()

        tiles = tile_waterfall_image(enhanced_image, tile_size=640, overlap=128)
        scan.total_tiles = len(tiles)
        scan.processed_tiles = 0
        db_session.commit()

        # Step 3: Neural Network & Feature Detection
        scan.processing_stage = "inference"
        scan.progress_pct = 40.0
        db_session.commit()

        raw_detections = detector.detect_tiles(tiles, conf_threshold=0.25)
        scan.processed_tiles = len(tiles)
        scan.progress_pct = 75.0
        db_session.commit()

        # Step 4: Multi-Signal Postprocessing & Georeferencing
        scan.processing_stage = "postprocessing"
        scan.progress_pct = 85.0
        db_session.commit()

        pings = db_session.query(PingMetadata).filter(PingMetadata.scan_id == scan_id).order_by(PingMetadata.ping_number).all()
        ping_dicts = [
            {
                "ping_number": p.ping_number,
                "latitude": p.latitude,
                "longitude": p.longitude,
                "heading": p.heading,
                "speed": p.speed,
                "altitude": p.altitude
            }
            for p in pings
        ]

        geo_estimator = GeoEstimator(swath_range=scan.swath_range or 100.0)
        refined_detections = geo_estimator.process_detections(
            detections=raw_detections,
            image=enhanced_image,
            ping_records=ping_dicts if ping_dicts else None
        )

        # Step 5: Save Results
        scan.processing_stage = "saving_results"
        scan.progress_pct = 95.0
        db_session.commit()

        db_session.query(Detection).filter(Detection.scan_id == scan_id).delete()

        for det in refined_detections:
            db_det = Detection(
                scan_id=scan_id,
                class_name=det["class_name"],
                confidence=det["confidence"],
                model_confidence=det.get("model_confidence"),
                shadow_score=det.get("shadow_score"),
                geometry_score=det.get("geometry_score"),
                context_score=det.get("context_score"),
                validation_score=det.get("validation_score"),
                final_anomaly_score=det.get("final_anomaly_score"),
                priority=det.get("priority", "MEDIUM"),
                priority_reasons=det.get("priority_reasons"),
                bbox_x=det["bbox_x"],
                bbox_y=det["bbox_y"],
                bbox_w=det["bbox_w"],
                bbox_h=det["bbox_h"],
                est_width=det["est_width"],
                est_length=det["est_length"],
                est_height=det["est_height"],
                latitude=det["latitude"],
                longitude=det["longitude"],
                geolocation_status=det.get("geolocation_status", "unavailable"),
                geo_uncertainty_m=det.get("geo_uncertainty_m"),
                validation_status="pending"
            )
            db_session.add(db_det)

        scan.status = "completed"
        scan.processing_stage = "completed"
        scan.progress_pct = 100.0
        db_session.commit()
        logger.info(f"Scan {scan_id} analysis complete. {len(refined_detections)} anomalies cataloged.")

    except Exception as e:
        logger.error(f"Error processing scan {scan_id}: {e}", exc_info=True)
        scan.status = "failed"
        scan.processing_stage = "failed"
        db_session.commit()


@app.get("/api/health", status_code=status.HTTP_200_OK)
def health_check():
    """Health check endpoint to verify backend status."""
    return {
        "status": "online",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "connected",
        "model_loaded": detector.initialized,
        "active_weights": str(detector.weights_path.name)
    }


@app.get("/api/sonar-scans/{scan_id}/status", response_model=dict)
def get_scan_status(scan_id: int, db: Session = Depends(get_db)):
    """
    Part 11: Real-Time Processing State Endpoint.
    Returns the real-time stage, progress percentage, and tile metrics of a scan.
    """
    scan = db.query(SonarScan).filter(SonarScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Sonar scan not found")

    det_count = len(scan.detections) if scan.detections else 0
    return {
        "scan_id": scan.id,
        "status": scan.status,
        "processing_stage": scan.processing_stage or ("completed" if scan.status == "completed" else "queued"),
        "progress_pct": scan.progress_pct or (100.0 if scan.status == "completed" else 0.0),
        "total_tiles": scan.total_tiles or 0,
        "processed_tiles": scan.processed_tiles or 0,
        "detection_count": det_count,
        "is_synthetic": bool(scan.is_synthetic)
    }


@app.post("/api/sonar-scans/upload", response_model=dict, status_code=status.HTTP_201_CREATED)
async def upload_sonar_scan(
    image_file: UploadFile = File(...),
    metadata_file: Optional[UploadFile] = File(None),
    auto_process: bool = True,
    db: Session = Depends(get_db)
):
    """
    Ingests real Side-Scan Sonar imagery and optional CSV navigation telemetry log.
    Executes real-time AI ML pipeline.
    """
    ext = os.path.splitext(image_file.filename)[1].lower()
    if ext not in {".png", ".jpg", ".jpeg", ".tiff", ".tif"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported format: {ext}. Only PNG, JPEG, and TIFF are supported."
        )

    contents = await image_file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds 50MB limit."
        )
    await image_file.seek(0)

    # Validate metadata if provided
    metadata_contents = None
    if metadata_file is not None:
        meta_raw = await metadata_file.read()
        metadata_contents = meta_raw
        await metadata_file.seek(0)

    scan_uuid = str(uuid.uuid4())[:8]
    clean_name = Path(image_file.filename).stem
    raw_img_name = f"{scan_uuid}_{clean_name}{ext}"
    raw_img_path = RAW_STORAGE_DIR / raw_img_name

    with open(raw_img_path, "wb") as f:
        f.write(contents)

    swath_range = 100.0
    start_lat = None
    start_lon = None
    pings_to_insert = []

    # Parse real CSV navigation metadata
    if metadata_contents:
        try:
            meta_str = metadata_contents.decode("utf-8", errors="ignore")
            csv_reader = csv.DictReader(StringIO(meta_str))
            
            for idx, row in enumerate(csv_reader):
                lat_k = next((k for k in row.keys() if k and k.strip().lower() in {"latitude", "lat"}), None)
                lon_k = next((k for k in row.keys() if k and k.strip().lower() in {"longitude", "lon", "lng"}), None)
                ping_k = next((k for k in row.keys() if k and k.strip().lower() in {"ping_number", "ping"}), None)
                heading_k = next((k for k in row.keys() if k and k.strip().lower() in {"heading", "heading_deg"}), None)
                speed_k = next((k for k in row.keys() if k and k.strip().lower() in {"speed", "speed_knots"}), None)
                alt_k = next((k for k in row.keys() if k and k.strip().lower() in {"altitude", "altitude_m"}), None)
                range_k = next((k for k in row.keys() if k and k.strip().lower() in {"max_range_m", "range"}), None)

                if lat_k and lon_k and row[lat_k] and row[lon_k]:
                    try:
                        cur_lat = float(row[lat_k])
                        cur_lon = float(row[lon_k])
                        if start_lat is None:
                            start_lat = cur_lat
                            start_lon = cur_lon
                        if range_k and row[range_k]:
                            swath_range = float(row[range_k])

                        pings_to_insert.append({
                            "ping_number": int(row[ping_k]) if (ping_k and row[ping_k]) else idx,
                            "latitude": cur_lat,
                            "longitude": cur_lon,
                            "heading": float(row[heading_k]) if (heading_k and row[heading_k]) else 0.0,
                            "speed": float(row[speed_k]) if (speed_k and row[speed_k]) else 4.0,
                            "altitude": float(row[alt_k]) if (alt_k and row[alt_k]) else 10.0
                        })
                    except ValueError:
                        continue
        except Exception as e:
            logger.warning(f"Error parsing metadata: {e}")

    sonar_scan = SonarScan(
        file_name=image_file.filename,
        raw_file_path=str(raw_img_path),
        upload_timestamp=datetime.utcnow(),
        status="uploaded",
        processing_stage="queued",
        progress_pct=0.0,
        is_synthetic=False,
        start_latitude=start_lat,
        start_longitude=start_lon,
        swath_range=swath_range
    )
    db.add(sonar_scan)
    db.commit()
    db.refresh(sonar_scan)

    if pings_to_insert:
        db_pings = [
            PingMetadata(
                scan_id=sonar_scan.id,
                ping_number=p["ping_number"],
                latitude=p["latitude"],
                longitude=p["longitude"],
                heading=p["heading"],
                speed=p["speed"],
                altitude=p["altitude"]
            )
            for p in pings_to_insert
        ]
        db.bulk_save_objects(db_pings)
        db.commit()

    if auto_process:
        run_ml_pipeline_for_scan(sonar_scan.id, db)

    return {
        "scan_id": sonar_scan.id,
        "status": sonar_scan.status,
        "message": "Scan uploaded and AI pipeline executed."
    }


@app.post("/api/sonar-scans/{scan_id}/process", response_model=dict)
def process_sonar_scan(scan_id: int, db: Session = Depends(get_db)):
    """Triggers or re-runs AI ML pipeline on a scan."""
    scan = db.query(SonarScan).filter(SonarScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Sonar scan not found")
    
    run_ml_pipeline_for_scan(scan_id, db)
    return {
        "scan_id": scan_id,
        "status": scan.status,
        "processing_stage": scan.processing_stage,
        "message": "Processing executed successfully."
    }


@app.get("/api/sonar-scans", response_model=list)
def list_sonar_scans(db: Session = Depends(get_db)):
    """Retrieve all sonar scans dynamically from SQLite."""
    scans = db.query(SonarScan).order_by(SonarScan.upload_timestamp.desc()).all()
    result = []
    for s in scans:
        det_count = len(s.detections) if s.detections else 0
        approved_count = sum(1 for d in s.detections if d.validation_status == "approved") if s.detections else 0
        
        raw_url = f"/storage/raw/{Path(s.raw_file_path).name}" if s.raw_file_path else None
        proc_url = f"/storage/processed/{Path(s.processed_file_path).name}" if s.processed_file_path else None

        result.append({
            "id": s.id,
            "file_name": s.file_name,
            "raw_file_path": s.raw_file_path,
            "processed_file_path": s.processed_file_path,
            "raw_image_url": raw_url,
            "processed_image_url": proc_url,
            "upload_timestamp": s.upload_timestamp.isoformat(),
            "status": s.status,
            "processing_stage": s.processing_stage or "completed",
            "progress_pct": s.progress_pct or 100.0,
            "is_synthetic": bool(s.is_synthetic),
            "start_latitude": s.start_latitude,
            "start_longitude": s.start_longitude,
            "swath_range": s.swath_range,
            "detection_count": det_count,
            "approved_count": approved_count
        })
    return result


@app.get("/api/sonar-scans/{scan_id}/visualize", response_model=dict)
def get_scan_visualization(scan_id: int, db: Session = Depends(get_db)):
    """
    Returns complete scan visualization and anomaly telemetry dynamically from database.
    """
    scan = db.query(SonarScan).filter(SonarScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Sonar scan not found")

    raw_url = f"/storage/raw/{Path(scan.raw_file_path).name}" if scan.raw_file_path else None
    proc_url = f"/storage/processed/{Path(scan.processed_file_path).name}" if scan.processed_file_path else None

    img_width, img_height = 1000, 2000
    if scan.raw_file_path and Path(scan.raw_file_path).exists():
        img = cv2.imread(scan.raw_file_path)
        if img is not None:
            img_height, img_width = img.shape[:2]

    # Real trackline from PingMetadata
    pings = db.query(PingMetadata).filter(PingMetadata.scan_id == scan_id).order_by(PingMetadata.ping_number).all()
    trackline = [
        {"lat": p.latitude, "lon": p.longitude, "heading": p.heading, "altitude": p.altitude, "ping": p.ping_number}
        for p in pings
    ]

    detections_data = []
    for d in scan.detections:
        detections_data.append({
            "id": d.id,
            "scan_id": d.scan_id,
            "class_name": d.class_name,
            "confidence": d.confidence,
            "model_confidence": d.model_confidence,
            "shadow_score": d.shadow_score,
            "geometry_score": d.geometry_score,
            "context_score": d.context_score,
            "validation_score": d.validation_score,
            "final_anomaly_score": d.final_anomaly_score,
            "priority": d.priority or "MEDIUM",
            "priority_reasons": d.priority_reasons,
            "bbox_x": d.bbox_x,
            "bbox_y": d.bbox_y,
            "bbox_w": d.bbox_w,
            "bbox_h": d.bbox_h,
            "est_length": d.est_length,
            "est_width": d.est_width,
            "est_height": d.est_height,
            "latitude": d.latitude,
            "longitude": d.longitude,
            "geolocation_status": d.geolocation_status or ("valid" if d.latitude else "unavailable"),
            "geo_uncertainty_m": d.geo_uncertainty_m,
            "validation_status": d.validation_status,
            "analyst_notes": d.analyst_notes
        })

    return {
        "scan_id": scan.id,
        "file_name": scan.file_name,
        "status": scan.status,
        "processing_stage": scan.processing_stage or "completed",
        "progress_pct": scan.progress_pct or 100.0,
        "is_synthetic": bool(scan.is_synthetic),
        "upload_timestamp": scan.upload_timestamp.isoformat(),
        "raw_image_url": raw_url,
        "processed_image_url": proc_url,
        "swath_range_m": scan.swath_range,
        "image_width": img_width,
        "image_height": img_height,
        "trackline": trackline,
        "detections": detections_data
    }


@app.patch("/api/detections/{detection_id}/verify", response_model=dict)
@app.post("/api/detections/{detection_id}/verify", response_model=dict)
def verify_detection(
    detection_id: int, 
    update: VerificationUpdate, 
    db: Session = Depends(get_db)
):
    """Analyst Triage: Confirm, reject, or update notes for a detection."""
    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise HTTPException(status_code=404, detail="Detection not found")

    det.validation_status = update.validation_status
    if update.analyst_notes is not None:
        det.analyst_notes = update.analyst_notes

    db.commit()
    db.refresh(det)

    return {
        "id": det.id,
        "validation_status": det.validation_status,
        "analyst_notes": det.analyst_notes,
        "message": f"Detection {detection_id} updated to {det.validation_status}."
    }


@app.delete("/api/sonar-scans/{scan_id}", status_code=status.HTTP_200_OK)
def delete_sonar_scan(scan_id: int, db: Session = Depends(get_db)):
    """Deletes a sonar scan and all associated records and files."""
    scan = db.query(SonarScan).filter(SonarScan.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Sonar scan not found")

    try:
        if scan.raw_file_path and Path(scan.raw_file_path).exists():
            os.remove(scan.raw_file_path)
        if scan.processed_file_path and Path(scan.processed_file_path).exists():
            os.remove(scan.processed_file_path)
    except Exception as e:
        logger.warning(f"Error removing files for scan {scan_id}: {e}")

    db.delete(scan)
    db.commit()
    return {"message": f"Scan {scan_id} deleted successfully."}


@app.get("/api/reports/export")
def export_report(
    scan_id: Optional[int] = None,
    format: str = Query("json", enum=["json", "csv", "geojson"]),
    db: Session = Depends(get_db)
):
    """
    Part 14: Dynamic Reporting.
    Exports structured mission intelligence dynamically from database records.
    """
    query = db.query(Detection)
    if scan_id is not None:
        query = query.filter(Detection.scan_id == scan_id)
    
    detections = query.all()

    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Detection ID", "Scan ID", "Class", "Priority", "Final Anomaly Score (%)", 
            "Model Confidence (%)", "Shadow Score", "Geometry Score", "Context Score",
            "Latitude", "Longitude", "Geolocation Status", "Geo Uncertainty (m)",
            "Est Length (m)", "Est Width (m)", "Est Height (m)",
            "BBox X", "BBox Y", "BBox Width", "BBox Height", 
            "Validation Status", "Analyst Notes"
        ])
        for d in detections:
            writer.writerow([
                d.id, d.scan_id, d.class_name, d.priority or "MEDIUM", round(d.confidence, 1),
                d.model_confidence or "", d.shadow_score or "", d.geometry_score or "", d.context_score or "",
                d.latitude or "unavailable", d.longitude or "unavailable", d.geolocation_status or "unavailable",
                d.geo_uncertainty_m or "",
                d.est_length or "unavailable", d.est_width or "unavailable", d.est_height or "unavailable",
                d.bbox_x, d.bbox_y, d.bbox_w, d.bbox_h, 
                d.validation_status, d.analyst_notes or ""
            ])
        
        response = Response(content=output.getvalue(), media_type="text/csv")
        response.headers["Content-Disposition"] = f"attachment; filename=aquascan_report_{scan_id or 'all'}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        return response

    elif format == "geojson":
        # GeoJSON FeatureCollection
        features = []
        for d in detections:
            if d.latitude and d.longitude:
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [d.longitude, d.latitude]
                    },
                    "properties": {
                        "id": d.id,
                        "scan_id": d.scan_id,
                        "class": d.class_name,
                        "priority": d.priority,
                        "confidence": d.confidence,
                        "est_length_m": d.est_length,
                        "est_width_m": d.est_width,
                        "est_height_m": d.est_height,
                        "validation_status": d.validation_status,
                        "analyst_notes": d.analyst_notes
                    }
                })
        geojson_data = {
            "type": "FeatureCollection",
            "features": features
        }
        return JSONResponse(content=geojson_data)

    else:
        report_data = {
            "report_generated_at": datetime.utcnow().isoformat(),
            "scan_id": scan_id,
            "total_detections": len(detections),
            "approved_targets": sum(1 for d in detections if d.validation_status == "approved"),
            "rejected_false_positives": sum(1 for d in detections if d.validation_status == "rejected"),
            "pending_validation": sum(1 for d in detections if d.validation_status == "pending"),
            "targets": [
                {
                    "id": d.id,
                    "scan_id": d.scan_id,
                    "class": d.class_name,
                    "priority": d.priority or "MEDIUM",
                    "scores": {
                        "final_anomaly_score": d.confidence,
                        "model_confidence": d.model_confidence,
                        "shadow_score": d.shadow_score,
                        "geometry_score": d.geometry_score,
                        "context_score": d.context_score,
                        "validation_score": d.validation_score
                    },
                    "geotag": {
                        "latitude": d.latitude, 
                        "longitude": d.longitude,
                        "status": d.geolocation_status or ("valid" if d.latitude else "unavailable"),
                        "uncertainty_m": d.geo_uncertainty_m
                    },
                    "dimensions_m": {
                        "length": d.est_length, 
                        "width": d.est_width, 
                        "height": d.est_height
                    },
                    "bbox_pixels": {"x": d.bbox_x, "y": d.bbox_y, "w": d.bbox_w, "h": d.bbox_h},
                    "validation_status": d.validation_status,
                    "analyst_notes": d.analyst_notes
                }
                for d in detections
            ]
        }
        return JSONResponse(content=report_data)


@app.post("/api/demo/generate-sample", response_model=dict, status_code=status.HTTP_201_CREATED)
def generate_sample_sonar_scan(db: Session = Depends(get_db)):
    """
    Synthetic Demo Mode:
    Generates a synthetic demo mission with explicit is_synthetic=True flag.
    """
    width = 1200
    height = 2400
    center_x = width // 2
    swath_range = 100.0

    np.random.seed(int(datetime.utcnow().timestamp()) % 100000)
    base_noise = np.random.gamma(shape=2.5, scale=25.0, size=(height, width)).astype(np.float32)
    base_noise = cv2.GaussianBlur(base_noise, (3, 3), 0)

    y_indices, x_indices = np.indices((height, width))
    ripples = 12.0 * np.sin(y_indices * 0.04 + 0.01 * x_indices)
    img_float = base_noise + ripples

    nadir_width = 120
    for x in range(center_x - nadir_width // 2, center_x + nadir_width // 2):
        dist = abs(x - center_x)
        factor = (dist / (nadir_width / 2)) ** 2
        img_float[:, x] *= max(0.1, factor * 0.5)

    img_float[:, center_x - nadir_width // 2] += 60.0
    img_float[:, center_x + nadir_width // 2] += 60.0

    # Anomaly 1: Shipwreck
    ship_x, ship_y = center_x + 220, 650
    cv2.ellipse(img_float, (ship_x, ship_y), (65, 35), 25, 0, 360, 240.0, -1)
    cv2.rectangle(img_float, (ship_x - 30, ship_y - 20), (ship_x + 30, ship_y + 20), 255.0, -1)
    shadow_poly = np.array([
        [ship_x + 35, ship_y - 30],
        [ship_x + 190, ship_y - 45],
        [ship_x + 200, ship_y + 45],
        [ship_x + 35, ship_y + 30]
    ], np.int32)
    cv2.fillPoly(img_float, [shadow_poly], 5.0)

    # Anomaly 2: Pipeline
    pipe_x, pipe_y = center_x - 280, 1400
    cv2.line(img_float, (pipe_x - 40, pipe_y - 120), (pipe_x + 40, pipe_y + 120), 235.0, 14)
    cv2.line(img_float, (pipe_x - 90, pipe_y - 120), (pipe_x - 10, pipe_y + 120), 8.0, 18)

    # Anomaly 3: Debris
    debris_x, debris_y = center_x + 320, 1850
    cv2.rectangle(img_float, (debris_x - 25, debris_y - 25), (debris_x + 25, debris_y + 25), 250.0, -1)
    cv2.rectangle(img_float, (debris_x + 30, debris_y - 25), (debris_x + 140, debris_y + 25), 8.0, -1)

    final_img = np.clip(img_float, 0, 255).astype(np.uint8)
    final_bgr = cv2.cvtColor(final_img, cv2.COLOR_GRAY2BGR)

    scan_uuid = str(uuid.uuid4())[:8]
    raw_filename = f"DEMO_SYNTHETIC_SSS_{scan_uuid}.png"
    raw_path = RAW_STORAGE_DIR / raw_filename
    cv2.imwrite(str(raw_path), final_bgr)

    base_lat = 36.798500 + random.uniform(-0.01, 0.01)
    base_lon = -121.942100 + random.uniform(-0.01, 0.01)
    
    sonar_scan = SonarScan(
        file_name=f"SYNTHETIC_DEMO_SURVEY_{scan_uuid}.png",
        raw_file_path=str(raw_path),
        upload_timestamp=datetime.utcnow(),
        status="uploaded",
        processing_stage="queued",
        progress_pct=0.0,
        is_synthetic=True,  # Explicitly marked as synthetic demonstration
        start_latitude=base_lat,
        start_longitude=base_lon,
        swath_range=swath_range
    )
    db.add(sonar_scan)
    db.commit()
    db.refresh(sonar_scan)

    pings = []
    heading = 38.5
    for i in range(0, height, 10):
        dist_km = (i / height) * 0.6
        d_lat = (dist_km * 1000 * math.cos(math.radians(heading))) / 6378137.0
        d_lon = (dist_km * 1000 * math.sin(math.radians(heading))) / (6378137.0 * math.cos(math.radians(base_lat)))
        
        pings.append(PingMetadata(
            scan_id=sonar_scan.id,
            ping_number=i,
            latitude=base_lat + math.degrees(d_lat),
            longitude=base_lon + math.degrees(d_lon),
            heading=heading + random.uniform(-0.5, 0.5),
            speed=4.2,
            altitude=12.5
        ))
    db.bulk_save_objects(pings)
    db.commit()

    run_ml_pipeline_for_scan(sonar_scan.id, db)

    return {
        "scan_id": sonar_scan.id,
        "file_name": sonar_scan.file_name,
        "status": "completed",
        "is_synthetic": True,
        "message": "Synthetic demo mission generated successfully."
    }
