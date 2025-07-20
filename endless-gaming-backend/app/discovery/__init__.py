"""
Discovery blueprint package.

This package contains the Flask blueprint for the discovery API,
which provides game data endpoints for the frontend.
"""
from flask import Blueprint

bp = Blueprint('discovery', __name__)

# Import routes to register them with the blueprint
from app.discovery import blueprint