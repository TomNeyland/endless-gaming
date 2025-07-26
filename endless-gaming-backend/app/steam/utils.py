"""
Utility functions for the Steam API blueprint.

Contains helper functions for validation and response formatting.
"""
import re
from typing import Dict, Any


def validate_player_id(player_id: Any) -> bool:
    """
    Validate any player identifier format.
    
    Args:
        player_id: Player ID to validate (SteamID64, vanity name, or URL)
        
    Returns:
        True if valid format, False otherwise
    """
    if not player_id or not isinstance(player_id, str):
        return False
    
    # SteamID64 format: 17-digit number starting with 76561198
    if re.match(r'^76561198\d{9}$', player_id):
        return True
    
    # Steam profile URL (full or partial)
    if 'steamcommunity.com/id/' in player_id or player_id.startswith('/id/'):
        return True
    
    # Vanity name: letters, numbers, underscores, hyphens
    if re.match(r'^[a-zA-Z0-9_-]+$', player_id):
        return True
    
    return False


def validate_steam_id(steam_id: Any) -> bool:
    """
    Validate SteamID64 format (kept for backward compatibility).
    
    Args:
        steam_id: Steam ID to validate
        
    Returns:
        True if valid SteamID64 format, False otherwise
    """
    if not steam_id or not isinstance(steam_id, str):
        return False
    
    # SteamID64 format: 17-digit number starting with 76561198
    pattern = r'^76561198\d{9}$'
    return bool(re.match(pattern, steam_id))


def format_error_response(message: str, status_code: int = 400) -> Dict[str, Any]:
    """
    Format error response for consistent API error handling.
    
    Args:
        message: Error message
        status_code: HTTP status code
        
    Returns:
        Dictionary containing error information
    """
    return {
        "error": message,
        "status_code": status_code
    }