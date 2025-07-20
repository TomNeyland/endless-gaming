"""
Database models and configuration for Steam game data collection.

This module sets up SQLAlchemy and provides the base configuration
for all database models.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()