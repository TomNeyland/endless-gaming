"""
Database models and configuration for Steam game data collection.

This module sets up SQLAlchemy and provides the base configuration
for all database models.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

# Import all models to ensure they are registered with SQLAlchemy
from .game import Game
from .game_metadata import GameMetadata  
from .storefront_data import StorefrontData