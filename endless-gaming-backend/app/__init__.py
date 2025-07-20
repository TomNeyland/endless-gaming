"""
Flask application factory for the Endless Gaming backend.

This module creates and configures the Flask application using the
application factory pattern for better testability and configuration.
"""
from flask import Flask
from flask_caching import Cache
from flask_cors import CORS
from app.config import Config

# Initialize extensions
cache = Cache()
cors = CORS()


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
    
    # Initialize extensions
    cache.init_app(app)
    cors.init_app(app)
    
    # Register blueprints
    from app.discovery import bp as discovery_bp
    app.register_blueprint(discovery_bp, url_prefix='/discovery')
    
    return app