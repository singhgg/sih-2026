from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

# Detection schemas
class DetectionBase(BaseModel):
    class_name: str
    confidence: float
    bbox_x: int
    bbox_y: int
    bbox_w: int
    bbox_h: int
    est_width: Optional[float] = None
    est_length: Optional[float] = None
    est_height: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geolocation_status: Optional[str] = "unavailable"
    geo_uncertainty_m: Optional[float] = None
    
    # Phase 5 Dynamic Scoring & Priority
    model_confidence: Optional[float] = None
    shadow_score: Optional[float] = None
    geometry_score: Optional[float] = None
    context_score: Optional[float] = None
    validation_score: Optional[float] = None
    final_anomaly_score: Optional[float] = None
    priority: Optional[str] = "MEDIUM"
    priority_reasons: Optional[str] = None

class DetectionCreate(DetectionBase):
    scan_id: int

class DetectionResponse(DetectionBase):
    id: int
    scan_id: int
    validation_status: str
    analyst_notes: Optional[str] = None

    class Config:
        from_attributes = True

# SonarScan schemas
class SonarScanBase(BaseModel):
    file_name: str
    swath_range: float = 100.0

class SonarScanCreate(SonarScanBase):
    raw_file_path: str

class SonarScanResponse(SonarScanBase):
    id: int
    raw_file_path: str
    processed_file_path: Optional[str] = None
    upload_timestamp: datetime
    status: str
    processing_stage: Optional[str] = "queued"
    progress_pct: Optional[float] = 0.0
    is_synthetic: Optional[bool] = False
    start_latitude: Optional[float] = None
    start_longitude: Optional[float] = None
    detection_count: Optional[int] = 0

    class Config:
        from_attributes = True

# Verification / Triage schema
class VerificationUpdate(BaseModel):
    validation_status: str = Field(..., description="Must be approved, rejected, or pending")
    analyst_notes: Optional[str] = None

# Comprehensive visualization response
class ScanVisualizeResponse(BaseModel):
    scan_id: int
    file_name: str
    raw_image_url: str
    processed_image_url: Optional[str] = None
    swath_range_m: float
    status: str
    processing_stage: Optional[str] = "completed"
    progress_pct: Optional[float] = 100.0
    is_synthetic: Optional[bool] = False
    detections: List[DetectionResponse]

    class Config:
        from_attributes = True
