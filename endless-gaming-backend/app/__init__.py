"""
Flask application factory for the Endless Gaming backend.

This module creates and configures the Flask application using the
application factory pattern for better testability and configuration.
"""
import os
from flask import Flask, g
from flask_caching import Cache
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from datetime import datetime
from app.config import Config, config

# Initialize extensions
cache = Cache()
cors = CORS()

# Global database session factory
SessionLocal = None


def create_app(config_name=None):
    """
    Application factory function.
    
    Args:
        config_name: Configuration name to use ('development', 'testing', 'production')
                    If None, uses FLASK_ENV environment variable or defaults to 'default'
        
    Returns:
        Flask: Configured Flask application instance
    """
    # Determine configuration based on environment
    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'default')
    
    config_class = config.get(config_name, config['default'])
    
    app = Flask(__name__)
    app.config.from_object(config_class)
    
    # Initialize database
    global SessionLocal
    engine = create_engine(app.config['DATABASE_URL'])
    SessionLocal = sessionmaker(bind=engine)
    
    # Create tables if they don't exist (for SQLite)
    from models import Base
    Base.metadata.create_all(engine)
    
    # Store engine in app for testing access
    app.db_engine = engine
    app.db_session_factory = SessionLocal
    
    # Initialize extensions
    cache.init_app(app)
    cors.init_app(app, origins=app.config['CORS_ORIGINS'])
    
    # Register blueprints
    from app.discovery import bp as discovery_bp
    app.register_blueprint(discovery_bp, url_prefix='/discovery')
    
    from app.steam import bp as steam_bp
    app.register_blueprint(steam_bp, url_prefix='/api/steam')
    
    # Health check endpoint for DigitalOcean App Platform
    @app.route('/health')
    def health_check():
        """Health check endpoint for load balancer monitoring."""
        try:
            # Test database connectivity
            session = SessionLocal()
            session.execute(text('SELECT 1'))
            session.close()
            
            return {
                'status': 'healthy',
                'timestamp': datetime.utcnow().isoformat(),
                'environment': app.config.get('FLASK_ENV', 'unknown'),
                'database': 'connected'
            }, 200
        except Exception as e:
            app.logger.error(f"Health check failed: {e}")
            return {
                'status': 'unhealthy',
                'error': str(e),
                'environment': app.config.get('FLASK_ENV', 'unknown'),
                'database': 'disconnected'
            }, 503
    
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