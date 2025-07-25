"""
StorefrontData model for storing Steam Store API data.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from models import Base
from models.game_metadata import FetchStatus


class StorefrontData(Base):
    """Model for storing detailed Steam Store API data."""
    
    __tablename__ = "storefront_data"
    
    app_id = Column(Integer, ForeignKey("games.app_id"), primary_key=True, index=True)
    short_description = Column(Text)
    detailed_description = Column(Text)
    is_free = Column(Boolean)
    required_age = Column(Integer)
    website = Column(String)
    header_image = Column(String)  # URL to header image
    release_date = Column(String)  # Steam returns this as string like "15 Jan, 2024"
    developers = Column(JSON)  # Array of developer names
    publishers = Column(JSON)  # Array of publisher names
    genres = Column(JSON)  # Array of genre objects with id/description
    categories = Column(JSON)  # Array of category objects with id/description
    supported_languages = Column(Text)  # HTML formatted language support info
    price_overview = Column(JSON)  # Price information: currency, initial, final, discount_percent
    pc_requirements = Column(JSON)  # PC system requirements: minimum, recommended
    last_updated = Column(DateTime, default=datetime.utcnow, nullable=False)
    fetch_attempts = Column(Integer, default=0, nullable=False, server_default="0")
    fetch_status = Column(String, default=FetchStatus.PENDING.value, nullable=False, server_default="pending")
    
    # Relationship to game
    game = relationship("Game", back_populates="storefront_data")