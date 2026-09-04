import csv
from io import StringIO
from typing import Optional, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session

from app.models import SonarScan, Detection, PingMetadata

def get_scan_summary(scan: SonarScan) -> Dict[str, Any]:
    """
    Computes real-time dynamic summary statistics directly from database records.
    """
    detections = scan.detections or []
    total = len(detections)

    confirmed = sum(1 for d in detections if d.validation_status == "approved")
    rejected = sum(1 for d in detections if d.validation_status == "rejected")
    pending = sum(1 for d in detections if not d.validation_status or d.validation_status == "pending")

    high_prio = sum(1 for d in detections if d.priority == "HIGH")
    med_prio = sum(1 for d in detections if d.priority == "MEDIUM")
    low_prio = sum(1 for d in detections if d.priority == "LOW")

    shipwrecks = sum(1 for d in detections if d.class_name == "shipwreck")
    pipes = sum(1 for d in detections if d.class_name == "pipe")
    debris = sum(1 for d in detections if d.class_name == "debris")

    geolocated_count = sum(1 for d in detections if d.latitude is not None and d.longitude is not None)

    avg_model_conf = round(sum(d.model_confidence or d.confidence for d in detections) / max(1, total), 1) if total > 0 else 0.0
    avg_anomaly_score = round(sum(d.confidence for d in detections) / max(1, total), 1) if total > 0 else 0.0

    return {
        "scan_id": scan.id,
        "file_name": scan.file_name,
        "is_synthetic": bool(scan.is_synthetic),
        "status": scan.status,
        "processing_stage": scan.processing_stage or "completed",
        "processing_duration_s": scan.processing_duration_s,
        "total_detections": total,
        "confirmed_targets": confirmed,
        "false_positives": rejected,
        "pending_validation": pending,
        "priority_distribution": {
            "high": high_prio,
            "medium": med_prio,
            "low": low_prio
        },
        "class_distribution": {
            "shipwreck": shipwrecks,
            "pipe": pipes,
            "debris": debris
        },
        "geolocated_targets_count": geolocated_count,
        "avg_model_confidence_pct": avg_model_conf,
        "avg_anomaly_score_pct": avg_anomaly_score
    }

def filter_detections_query(
    db_session: Session,
    scan_id: Optional[int] = None,
    class_name: Optional[str] = None,
    priority: Optional[str] = None,
    validation_status: Optional[str] = None,
    min_confidence: Optional[float] = None
) -> List[Detection]:
    """
    Applies dynamic query filtering directly against database records.
    """
    query = db_session.query(Detection)
    if scan_id is not None:
        query = query.filter(Detection.scan_id == scan_id)
    if class_name and class_name.lower() != "all":
        query = query.filter(Detection.class_name == class_name.lower())
    if priority and priority.upper() != "ALL":
        query = query.filter(Detection.priority == priority.upper())
    if validation_status and validation_status.lower() != "all":
        query = query.filter(Detection.validation_status == validation_status.lower())
    if min_confidence is not None and min_confidence > 0:
        query = query.filter(Detection.confidence >= min_confidence)

    return query.order_by(Detection.confidence.desc()).all()

def generate_json_report(
    scan: SonarScan, 
    detections: List[Detection]
) -> Dict[str, Any]:
    """
    Generates structured, traceable JSON mission intelligence report.
    """
    summary = get_scan_summary(scan)

    return {
        "report_metadata": {
            "report_id": f"AQUA-REP-{scan.id}-{int(datetime.utcnow().timestamp())}",
            "generated_at": datetime.utcnow().isoformat(),
            "generator": "AQUASCAN Dynamic Reporting Engine v2.1",
            "traceability": {
                "scan_id": scan.id,
                "file_name": scan.file_name,
                "upload_timestamp": scan.upload_timestamp.isoformat() if scan.upload_timestamp else None,
                "processing_started_at": scan.processing_started_at.isoformat() if scan.processing_started_at else None,
                "completed_at": scan.completed_at.isoformat() if scan.completed_at else None,
                "processing_duration_s": scan.processing_duration_s
            }
        },
        "mission_mode": "SYNTHETIC_DEMONSTRATION" if scan.is_synthetic else "REAL_SSS_ANALYSIS",
        "scan_profile": {
            "id": scan.id,
            "file_name": scan.file_name,
            "status": scan.status,
            "swath_range_m": scan.swath_range,
            "start_coordinates": {
                "latitude": scan.start_latitude,
                "longitude": scan.start_longitude
            } if scan.start_latitude and scan.start_longitude else "unavailable"
        },
        "summary": summary,
        "filtered_detections_count": len(detections),
        "detections": [
            {
                "id": d.id,
                "scan_id": d.scan_id,
                "class_name": d.class_name,
                "priority": d.priority or "MEDIUM",
                "priority_reasons": d.priority_reasons,
                "scores": {
                    "final_anomaly_score_pct": round(d.confidence, 1),
                    "model_confidence_pct": d.model_confidence,
                    "shadow_score": d.shadow_score,
                    "geometry_score": d.geometry_score,
                    "context_score": d.context_score,
                    "validation_score": d.validation_score
                },
                "geolocation": {
                    "latitude": d.latitude,
                    "longitude": d.longitude,
                    "status": d.geolocation_status or ("valid" if d.latitude else "unavailable"),
                    "uncertainty_radius_m": d.geo_uncertainty_m
                } if d.latitude is not None and d.longitude is not None else {
                    "status": "unavailable",
                    "latitude": None,
                    "longitude": None,
                    "uncertainty_radius_m": None
                },
                "metric_dimensions_m": {
                    "length": d.est_length,
                    "width": d.est_width,
                    "height": d.est_height
                },
                "bounding_box_pixels": {
                    "center_x": d.bbox_x,
                    "center_y": d.bbox_y,
                    "width": d.bbox_w,
                    "height": d.bbox_h
                },
                "analyst_verification": {
                    "validation_status": d.validation_status or "pending",
                    "analyst_notes": d.analyst_notes
                },
                "timestamps": {
                    "created_at": d.created_at.isoformat() if hasattr(d, "created_at") and d.created_at else None,
                    "updated_at": d.updated_at.isoformat() if hasattr(d, "updated_at") and d.updated_at else None
                }
            }
            for d in detections
        ]
    }

def generate_csv_report(
    scan: Optional[SonarScan], 
    detections: List[Detection]
) -> str:
    """
    Generates tabular CSV mission report directly from database records.
    """
    output = StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Detection ID", "Scan ID", "Mission File", "Class", "Priority", 
        "Final Anomaly Score (%)", "Model Confidence (%)", "Shadow Score", "Geometry Score", "Context Score",
        "Latitude", "Longitude", "Geolocation Status", "Geo Uncertainty (m)",
        "Est Length (m)", "Est Width (m)", "Est Height (m)",
        "BBox Center X", "BBox Center Y", "BBox Width", "BBox Height", 
        "Validation Status", "Analyst Notes"
    ])

    for d in detections:
        writer.writerow([
            d.id,
            d.scan_id,
            scan.file_name if scan else f"SCAN-{d.scan_id}",
            d.class_name,
            d.priority or "MEDIUM",
            round(d.confidence, 1),
            d.model_confidence if d.model_confidence is not None else "",
            d.shadow_score if d.shadow_score is not None else "",
            d.geometry_score if d.geometry_score is not None else "",
            d.context_score if d.context_score is not None else "",
            d.latitude if d.latitude is not None else "unavailable",
            d.longitude if d.longitude is not None else "unavailable",
            d.geolocation_status or ("valid" if d.latitude else "unavailable"),
            d.geo_uncertainty_m if d.geo_uncertainty_m is not None else "",
            d.est_length if d.est_length is not None else "unavailable",
            d.est_width if d.est_width is not None else "unavailable",
            d.est_height if d.est_height is not None else "unavailable",
            d.bbox_x,
            d.bbox_y,
            d.bbox_w,
            d.bbox_h,
            d.validation_status or "pending",
            d.analyst_notes or ""
        ])

    return output.getvalue()

def generate_geojson_report(
    scan: Optional[SonarScan], 
    detections: List[Detection]
) -> Dict[str, Any]:
    """
    Generates valid WGS-84 GeoJSON FeatureCollection.
    CRITICAL: Excludes detections that lack valid coordinates from Point features.
    """
    features = []
    excluded_count = 0

    for d in detections:
        if d.latitude is not None and d.longitude is not None:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(d.longitude), float(d.latitude)]
                },
                "properties": {
                    "detection_id": d.id,
                    "scan_id": d.scan_id,
                    "file_name": scan.file_name if scan else f"SCAN-{d.scan_id}",
                    "class_name": d.class_name,
                    "priority": d.priority or "MEDIUM",
                    "final_anomaly_score": round(d.confidence, 1),
                    "model_confidence": d.model_confidence,
                    "shadow_score": d.shadow_score,
                    "est_length_m": d.est_length,
                    "est_width_m": d.est_width,
                    "est_height_m": d.est_height,
                    "geo_uncertainty_m": d.geo_uncertainty_m,
                    "validation_status": d.validation_status or "pending",
                    "analyst_notes": d.analyst_notes
                }
            })
        else:
            excluded_count += 1

    return {
        "type": "FeatureCollection",
        "metadata": {
            "generated_at": datetime.utcnow().isoformat(),
            "scan_id": scan.id if scan else None,
            "total_detections_in_scan": len(detections),
            "geolocated_features_count": len(features),
            "non_geolocated_excluded_count": excluded_count
        },
        "features": features
    }
