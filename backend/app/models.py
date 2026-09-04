from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class SonarScan(Base):
    __tablename__ = "sonar_scans"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False)
    raw_file_path = Column(String, nullable=False)
    processed_file_path = Column(String, nullable=True)
    upload_timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    
    # Phase 5 & 6 Real-Time Lifecycle & Tracking State
    processing_stage = Column(String, default="queued")  # queued, preprocessing, inference, postprocessing, georeferencing, saving_results, completed, failed
    progress_pct = Column(Float, default=0.0)
    total_tiles = Column(Integer, default=0)
    processed_tiles = Column(Integer, default=0)
    is_synthetic = Column(Boolean, default=False)  # True only for synthetic demo missions

    # Lifecycle Timestamps
    processing_started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    processing_duration_s = Column(Float, nullable=True)

    start_latitude = Column(Float, nullable=True)
    start_longitude = Column(Float, nullable=True)
    swath_range = Column(Float, default=100.0)  # Max range in meters on one side

    # Relationships
    tracks = relationship("PingMetadata", back_populates="scan", cascade="all, delete-orphan")
    detections = relationship("Detection", back_populates="scan", cascade="all, delete-orphan")

class PingMetadata(Base):
    __tablename__ = "ping_metadata"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("sonar_scans.id", ondelete="CASCADE"), nullable=False)
    ping_number = Column(Integer, nullable=False)  # Maps to the image row index
    timestamp = Column(DateTime, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    heading = Column(Float, default=0.0)           # In degrees
    speed = Column(Float, default=0.0)             # In knots or m/s
    altitude = Column(Float, default=10.0)         # Towfish height above seafloor in meters

    # Relationships
    scan = relationship("SonarScan", back_populates="tracks")

class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("sonar_scans.id", ondelete="CASCADE"), nullable=False)
    class_name = Column(String, nullable=False)
    
    # Dynamic Multi-Dimensional Scoring
    confidence = Column(Float, nullable=False)            # Legacy compatibility / final anomaly score
    model_confidence = Column(Float, nullable=True)      # Raw YOLO model prediction confidence (0-100)
    shadow_score = Column(Float, nullable=True)          # Acoustic shadow evidence score (0-100 or None)
    geometry_score = Column(Float, nullable=True)        # Aspect & contour compactness score (0-100)
    context_score = Column(Float, nullable=True)         # Contrast to local background score (0-100)
    validation_score = Column(Float, nullable=True)      # Composite multi-signal physical validation score (0-100)
    final_anomaly_score = Column(Float, nullable=True)   # Calibrated anomaly score (0-100)
    
    # Prioritization
    priority = Column(String, default="MEDIUM")          # HIGH, MEDIUM, LOW
    priority_reasons = Column(Text, nullable=True)       # JSON string list of explainable evidence reasons

    # Pixel Bounding Box
    bbox_x = Column(Integer, nullable=False)             # Center X in pixels
    bbox_y = Column(Integer, nullable=False)             # Center Y in pixels
    bbox_w = Column(Integer, nullable=False)             # Width in pixels
    bbox_h = Column(Integer, nullable=False)             # Height in pixels

    # Physical Dimensions
    est_length = Column(Float, nullable=True)            # Estimated physical length in meters
    est_width = Column(Float, nullable=True)             # Estimated physical width in meters
    est_height = Column(Float, nullable=True)            # Estimated physical height in meters (from shadow)

    # Geospatial Coordinates
    latitude = Column(Float, nullable=True)              # Geotagged Latitude (None if missing metadata)
    longitude = Column(Float, nullable=True)             # Geotagged Longitude (None if missing metadata)
    geolocation_status = Column(String, default="unavailable")  # valid, estimated, unavailable
    geo_uncertainty_m = Column(Float, nullable=True)     # Estimated spatial error radius in meters

    # Analyst Triage
    validation_status = Column(String, default="pending")  # pending, approved, rejected
    analyst_notes = Column(String, nullable=True)

    # Persistence Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    scan = relationship("SonarScan", back_populates="detections")
