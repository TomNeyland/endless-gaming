"""
Game model for storing Steam game data.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from models import Base


class Game(Base):
    """Model for storing basic Steam game information."""
    
    __tablename__ = "games"
    
    app_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False, server_default="1")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship to metadata
    game_metadata = relationship("GameMetadata", back_populates="game", uselist=False)