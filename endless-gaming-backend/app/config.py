"""
Configuration classes for the Flask application.

Provides different configuration classes for different environments
(development, testing, production).
"""
import os
from pathlib import Path


class Config:
    """Base configuration class."""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # Database settings
    BASE_DIR = Path(__file__).parent.parent
    DATABASE_URL = os.environ.get('DATABASE_URL') or f'sqlite:///{BASE_DIR}/steam_games.db'
    
    # Cache settings
    CACHE_TYPE = 'SimpleCache'  # In-memory cache for development
    CACHE_DEFAULT_TIMEOUT = 86400  # 24 hours for master.json
    
    # CORS settings
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')


class DevelopmentConfig(Config):
    """Development configuration."""
    
    DEBUG = True
    CACHE_TYPE = 'SimpleCache'


class TestingConfig(Config):
    """Testing configuration."""
    
    TESTING = True
    DATABASE_URL = 'sqlite:///:memory:'
    CACHE_TYPE = 'NullCache'  # Disable caching in tests
    WTF_CSRF_ENABLED = False


class ProductionConfig(Config):
    """Production configuration."""
    
    DEBUG = False
    CACHE_TYPE = os.environ.get('CACHE_TYPE', 'SimpleCache')
    
    # Use more secure cache backends in production
    if CACHE_TYPE == 'RedisCache':
        CACHE_REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')


# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}