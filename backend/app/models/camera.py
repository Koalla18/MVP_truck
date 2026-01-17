"""Camera and Clip models for incident recording."""

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text, func

from app.db.base import Base


class CameraClip(Base):
    """Recorded video clip from vehicle camera."""
    __tablename__ = "camera_clips"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    vehicle_id = Column(String, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    incident_id = Column(String, ForeignKey("incidents.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Camera info
    camera_type = Column(String, nullable=False, default="front")  # front, back, cabin, road
    
    # Clip details
    duration_seconds = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    
    # Storage location
    storage_type = Column(String, nullable=False, default="local")  # local, s3, azure
    storage_path = Column(String, nullable=True)  # Path or URL to the clip
    thumbnail_path = Column(String, nullable=True)
    
    # Metadata
    description = Column(Text, nullable=True)
    tags = Column(String, nullable=True)  # Comma-separated tags
    
    # Timestamps
    recorded_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # GPS at recording time
    lat = Column(String, nullable=True)
    lon = Column(String, nullable=True)
