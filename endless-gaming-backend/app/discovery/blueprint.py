"""
Discovery API blueprint routes.

Contains the routes for the discovery API endpoints:
- GET /games/master.json - Returns all active games with metadata
"""
from flask import jsonify, current_app
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import DatabaseError

from app.discovery import bp
from app.discovery.utils import to_game_record
from models.game import Game
from app import cache


@bp.route('/games/master.json')
@cache.cached(timeout=86400, key_prefix="master_json_v1")
def get_master_json():
    """
    Get all active games with their metadata in JSON format.
    
    Returns:
        JSON response containing array of game records
    """
    try:
        # Use the app's database session factory
        session = current_app.db_session_factory()
        
        try:
            # Query all active games with their metadata
            games = (
                session.query(Game)
                .filter(Game.is_active.is_(True))
                .options(joinedload(Game.game_metadata))
                .all()
            )
            
            # Convert to game records
            payload = [to_game_record(game) for game in games]
            
            # Set cache headers for browser caching
            response = jsonify(payload)
            response.headers['Cache-Control'] = 'public, max-age=86400'
            
            return response
            
        finally:
            session.close()
            
    except DatabaseError as e:
        current_app.logger.error(f"Database error in get_master_json: {e}")
        return jsonify({"error": "Database unavailable"}), 503
    except Exception as e:
        current_app.logger.error(f"Unexpected error in get_master_json: {e}")
        return jsonify({"error": "Internal server error"}), 500