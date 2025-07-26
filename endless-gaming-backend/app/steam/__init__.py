"""
Steam blueprint package.

This package contains the Flask blueprint for the Steam API proxy,
which provides Steam player lookup endpoints.
"""
from flask import Blueprint

bp = Blueprint('steam', __name__)

# Import routes to register them with the blueprint
from app.steam import blueprint