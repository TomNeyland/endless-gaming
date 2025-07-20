"""
Flask application factory for the Endless Gaming backend.

This module creates and configures the Flask application using the
application factory pattern for better testability and configuration.
"""
from flask import Flask, g
from flask_caching import Cache
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import Config

# Initialize extensions
cache = Cache()
cors = CORS()

# Global database session factory
SessionLocal = None


def create_app(config_class=Config):
    """
    Application factory function.
    
    Args:
        config_class: Configuration class to use (defaults to Config)
        
    Returns:
        Flask: Configured Flask application instance
    """
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize database
    global SessionLocal
    engine = create_engine(app.config['DATABASE_URL'])
    SessionLocal = sessionmaker(bind=engine)
    
    # Store engine in app for testing access
    app.db_engine = engine
    app.db_session_factory = SessionLocal
    
    # Initialize extensions
    cache.init_app(app)
    cors.init_app(app)
    
    # Register blueprints
    from app.discovery import bp as discovery_bp
    app.register_blueprint(discovery_bp, url_prefix='/discovery')
    
    return app


def get_db_session():
    """Get database session for current application context."""
    if 'db_session' not in g:
        g.db_session = SessionLocal()
    return g.db_session


def close_db_session(error):
    """Close database session at end of request."""
    session = g.pop('db_session', None)
    if session is not None:
        session.close()