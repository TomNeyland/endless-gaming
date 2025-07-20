"""
Utility functions for the discovery API.

Contains helper functions for converting database models to API responses.
"""
import json
from typing import Dict, Any
from models.game import Game
from models.game_metadata import GameMetadata


def to_game_record(game: Game) -> Dict[str, Any]:
    """
    Convert a Game model instance to a game record dictionary.
    
    Converts snake_case field names to camelCase for frontend compatibility.
    
    Args:
        game: Game model instance with optional metadata relationship
        
    Returns:
        Dictionary containing game record data in camelCase format
    """
    metadata = game.game_metadata
    
    # Convert price format
    price = None
    if metadata and metadata.price:
        if metadata.price == "0":
            price = "Free"
        else:
            price = metadata.price
    
    # Handle tags - ensure we have a dictionary
    tags = {}
    if metadata and metadata.tags_json:
        if isinstance(metadata.tags_json, dict):
            tags = metadata.tags_json
        elif isinstance(metadata.tags_json, str):
            try:
                tags = json.loads(metadata.tags_json)
            except (json.JSONDecodeError, TypeError):
                tags = {}
    
    # Handle genres - convert single genre string to list
    genres = []
    if metadata and metadata.genre:
        genres = [metadata.genre] if isinstance(metadata.genre, str) else metadata.genre
    
    # Build camelCase record
    record = {
        "appId": game.app_id,
        "name": game.name,
        "coverUrl": None,  # Not implemented yet - would need Steam store data
        "price": price,
        "developer": metadata.developer if metadata else None,
        "publisher": metadata.publisher if metadata else None,
        "tags": tags,
        "genres": genres,
        "reviewPos": metadata.positive_reviews if metadata else None,
        "reviewNeg": metadata.negative_reviews if metadata else None,
    }
    
    return record