"""
Discovery API blueprint routes.

Contains the routes for the discovery API endpoints:
- GET /games/master.json - Returns all active games with metadata
"""
from flask import jsonify
from app.discovery import bp


@bp.route('/games/master.json')
def get_master_json():
    """
    Get all active games with their metadata in JSON format.
    
    Returns:
        JSON response containing array of game records
    """
    # TDD: Initially raise NotImplementedError - tests should fail first
    raise NotImplementedError("GET /games/master.json endpoint not yet implemented")