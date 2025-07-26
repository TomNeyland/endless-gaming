"""
Request and response schemas for the Steam API blueprint.

Contains validation schemas for API requests and responses.
"""
from typing import Dict, Any, Optional


class LookupPlayerRequest:
    """Schema for player lookup request validation."""
    
    def __init__(self, player_id: str):
        """
        Initialize request with validation.
        
        Args:
            player_id: Steam player ID to lookup
            
        Raises:
            ValueError: If player_id is invalid
        """
        from app.steam.utils import validate_player_id
        
        if not player_id:
            raise ValueError("player_id parameter is required")
        
        if not validate_player_id(player_id):
            raise ValueError(f"Invalid player ID format: {player_id}")
        
        self.player_id = player_id


class SteamAPIResponse:
    """Schema for Steam API response formatting."""
    
    @staticmethod
    def format_success(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format successful Steam API response.
        
        Args:
            data: Raw Steam API response data
            
        Returns:
            Formatted response data
        """
        return data
    
    @staticmethod
    def format_error(message: str, status_code: int = 500) -> Dict[str, Any]:
        """
        Format error response.
        
        Args:
            message: Error message
            status_code: HTTP status code
            
        Returns:
            Formatted error response
        """
        return {
            "error": message,
            "status_code": status_code
        }