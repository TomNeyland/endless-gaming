"""
GameMetadata model for storing detailed Steam game metadata.
"""
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from models import Base


class FetchStatus(Enum):
    """Enum for tracking metadata fetch status."""
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    NOT_FOUND = "not_found"
    
    def __str__(self):
        return self.value


class GameMetadata(Base):
    """Model for storing detailed Steam game metadata from SteamSpy API."""
    
    __tablename__ = "game_metadata"
    
    app_id = Column(Integer, ForeignKey("games.app_id"), primary_key=True, index=True)
    developer = Column(String)
    publisher = Column(String)
    owners_estimate = Column(String)  # SteamSpy format: "1,000,000 .. 2,000,000"
    positive_reviews = Column(Integer)
    negative_reviews = Column(Integer)
    score_rank = Column(Integer)
    average_playtime_forever = Column(Integer)
    average_playtime_2weeks = Column(Integer)
    price = Column(String)
    genre = Column(String)
    languages = Column(Text)
    tags_json = Column(JSON)  # Store tag dictionary
    last_updated = Column(DateTime, default=datetime.utcnow, nullable=False)
    fetch_attempts = Column(Integer, default=0, nullable=False, server_default="0")
    fetch_status = Column(String, default=FetchStatus.PENDING.value, nullable=False, server_default="pending")
    
    # Relationship to game
    game = relationship("Game", back_populates="game_metadata")