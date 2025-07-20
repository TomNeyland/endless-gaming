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
    # TDD: Initially raise NotImplementedError - tests should fail first
    raise NotImplementedError("to_game_record function not yet implemented")