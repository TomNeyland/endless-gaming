"""
Steam API client for interacting with Steam Web API endpoints.

Provides methods for retrieving player information and game data from Steam.
"""
import re
from typing import Dict, Any, Optional
from urllib.parse import urlencode
from utils.http_client import HTTPClient


class SteamAPIClient:
    """Client for Steam Web API with built-in retry logic and error handling."""
    
    def __init__(self, api_key: Optional[str] = None, base_url: str = "https://api.steampowered.com"):
        """
        Initialize Steam API client.
        
        Args:
            api_key: Steam Web API key
            base_url: Base URL for Steam API
            
        Raises:
            ValueError: If api_key is not provided
        """
        if not api_key:
            raise ValueError("Steam API key is required")
        
        self.api_key = api_key
        self.base_url = base_url
        self.http_client = HTTPClient(timeout=30.0)
    
    def _validate_steam_id(self, steam_id: str) -> bool:
        """
        Validate SteamID64 format.
        
        Args:
            steam_id: Steam ID to validate
            
        Returns:
            True if valid SteamID64 format
        """
        if not steam_id or not isinstance(steam_id, str):
            return False
        
        # SteamID64 format: 17-digit number starting with 76561198
        pattern = r'^76561198\d{9}$'
        return bool(re.match(pattern, steam_id))
    
    def _detect_player_id_type(self, player_id: str) -> str:
        """
        Detect the type of player identifier.
        
        Args:
            player_id: Player identifier to analyze
            
        Returns:
            'steamid64', 'vanity', or 'url'
        """
        if not player_id or not isinstance(player_id, str):
            return 'unknown'
        
        # SteamID64 format
        if re.match(r'^76561198\d{9}$', player_id):
            return 'steamid64'
        
        # Full Steam profile URL or partial path
        if 'steamcommunity.com/id/' in player_id or player_id.startswith('/id/'):
            return 'url'
        
        # Assume it's a vanity name (letters, numbers, underscores, hyphens)
        if re.match(r'^[a-zA-Z0-9_-]+$', player_id):
            return 'vanity'
        
        return 'unknown'
    
    def _extract_vanity_from_url(self, url: str) -> str:
        """
        Extract vanity name from Steam profile URL.
        
        Args:
            url: Steam profile URL
            
        Returns:
            Vanity name or original string if not a URL
        """
        # Extract from URLs like https://steamcommunity.com/id/vanityname or /id/vanityname/
        match = re.search(r'/id/([^/]+)', url)
        if match:
            return match.group(1)
        return url
    
    async def resolve_vanity_url(self, vanity_name: str) -> str:
        """
        Resolve a Steam vanity URL to SteamID64.
        
        Args:
            vanity_name: Steam vanity name (e.g., 'gaben')
            
        Returns:
            SteamID64 string
            
        Raises:
            ValueError: If vanity name cannot be resolved
            httpx.HTTPError: On HTTP errors
        """
        params = {
            'key': self.api_key,
            'vanityurl': vanity_name,
            'url_type': 1,  # 1 = individual profile
            'format': 'json'
        }
        
        url = f"{self.base_url}/ISteamUser/ResolveVanityURL/v0001/?{urlencode(params)}"
        response = await self.http_client.get_with_retry(url)
        
        if response.get('response', {}).get('success') == 1:
            return response['response']['steamid']
        else:
            raise ValueError(f"Could not resolve vanity URL: {vanity_name}")
    
    async def resolve_player_id(self, player_id: str) -> str:
        """
        Resolve any player identifier to SteamID64.
        
        Args:
            player_id: Can be SteamID64, vanity name, or Steam profile URL
            
        Returns:
            SteamID64 string
            
        Raises:
            ValueError: If player_id cannot be resolved
        """
        id_type = self._detect_player_id_type(player_id)
        
        if id_type == 'steamid64':
            return player_id
        elif id_type == 'url':
            vanity_name = self._extract_vanity_from_url(player_id)
            return await self.resolve_vanity_url(vanity_name)
        elif id_type == 'vanity':
            return await self.resolve_vanity_url(player_id)
        else:
            raise ValueError(f"Invalid player ID format: {player_id}")
    
    async def get_owned_games(
        self,
        player_id: str,
        include_appinfo: bool = True,
        include_played_free_games: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Get owned games for a Steam user.
        
        Args:
            player_id: Can be SteamID64, vanity name, or Steam profile URL
            include_appinfo: Include game name and logo information
            include_played_free_games: Include free games with playtime
            **kwargs: Additional parameters
            
        Returns:
            Steam API response containing owned games data
            
        Raises:
            ValueError: If player_id cannot be resolved
            httpx.HTTPError: On HTTP errors
            httpx.TimeoutException: On timeout
        """
        # Resolve to SteamID64 regardless of input format
        steam_id = await self.resolve_player_id(player_id)
        
        params = {
            'key': self.api_key,
            'steamid': steam_id,
            'format': 'json',
            'include_appinfo': 1 if include_appinfo else 0,
            'include_played_free_games': 1 if include_played_free_games else 0
        }
        
        # Add any additional parameters
        params.update(kwargs)
        
        url = f"{self.base_url}/IPlayerService/GetOwnedGames/v0001/?{urlencode(params)}"
        
        return await self.http_client.get_with_retry(url)
    
    async def close(self):
        """Close the HTTP client session."""
        await self.http_client.close()
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()