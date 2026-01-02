from sqlalchemy import Column, DateTime, ForeignKey, String, func
from sqlalchemy.orm import relationship

from app.db.base import Base


class DriverProfile(Base):
    __tablename__ = "driver_profiles"

    id = Column(String, primary_key=True)
    company_id = Column(String, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    home_base = Column(String, nullable=True)
    license_class = Column(String, nullable=True)
    rating = Column(String, nullable=True)

    # Relationships
    vehicles = relationship("Vehicle", back_populates="driver", lazy="dynamic")

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
