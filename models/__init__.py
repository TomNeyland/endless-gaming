"""
Database models and configuration for Steam game data collection.

This module sets up SQLAlchemy and provides the base configuration
for all database models.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

Base = declarative_base()