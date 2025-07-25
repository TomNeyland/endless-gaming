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
from models.game_metadata import GameMetadata
from app import cache


def has_million_plus_owners(owners_estimate: str) -> bool:
    """
    Check if an owner estimate indicates 1M+ owners.
    
    Args:
        owners_estimate: String like "1,000,000 .. 2,000,000"
        
    Returns:
        True if the estimate indicates 1M+ owners
    """
    if not owners_estimate:
        return False
    
    # Ranges that indicate 1M+ owners
    million_plus_ranges = [
        "1,000,000 .. 2,000,000",
        "2,000,000 .. 5,000,000", 
        "5,000,000 .. 10,000,000",
        "10,000,000 .. 20,000,000",
        "20,000,000 .. 50,000,000",
        "50,000,000 .. 100,000,000",
        "100,000,000 .. 200,000,000"
    ]
    
    return owners_estimate in million_plus_ranges


@bp.route('/games/master.json')
@cache.cached(timeout=86400, key_prefix="master_json_1m_owners_tags_v2")
def get_master_json():
    """
    Get all active games with 1M+ owners and their metadata in JSON format.
    Filters out games without tags since they can't contribute to preference learning.
    
    Returns:
        JSON response containing array of game records for games with 1M+ estimated owners and valid tags
    """
    try:
        # Use the app's database session factory
        session = current_app.db_session_factory()
        
        try:
            # Define owner ranges that indicate 1M+ owners
            million_plus_ranges = [
                "1,000,000 .. 2,000,000",
                "2,000,000 .. 5,000,000", 
                "5,000,000 .. 10,000,000",
                "10,000,000 .. 20,000,000",
                "20,000,000 .. 50,000,000",
                "50,000,000 .. 100,000,000",
                "100,000,000 .. 200,000,000"
            ]
            
            # Query all active games with their metadata, filtered for 1M+ owners
            # Also filter out games without tags since they can't contribute to preference learning
            games = (
                session.query(Game)
                .join(Game.game_metadata)
                .filter(Game.is_active.is_(True))
                .filter(GameMetadata.owners_estimate.in_(million_plus_ranges))
                .filter(GameMetadata.tags_json.isnot(None))  # Has tags data
                .filter(GameMetadata.tags_json != '{}')      # Not empty JSON object
                .filter(GameMetadata.tags_json != '')       # Not empty string
                .order_by(GameMetadata.score_rank)
                .limit(1000)
                .options(
                    joinedload(Game.game_metadata),
                    joinedload(Game.storefront_data)
                )
                .all()
            )
            
            # Convert to game records and filter out any remaining games without valid tags
            game_records = []
            for game in games:
                record = to_game_record(game)
                # Additional client-side check: ensure tags dict has actual content
                if record.get('tags') and len(record['tags']) > 0:
                    game_records.append(record)
            
            payload = game_records
            
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