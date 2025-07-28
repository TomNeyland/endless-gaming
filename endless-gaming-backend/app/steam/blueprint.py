"""
Steam API blueprint routes.

Contains the routes for the Steam API proxy endpoints:
- GET /api/steam/lookup-player - Proxy Steam GetOwnedGames API
"""
import asyncio
from flask import request, jsonify, current_app
import httpx

from app.steam import bp
from app.steam.schemas import LookupPlayerRequest, SteamAPIResponse
from utils.steam_api_client import SteamAPIClient


@bp.route('/lookup-player')
def lookup_player():
    """
    Lookup Steam player's owned games.
    
    Query Parameters:
        player_id (str): Can be SteamID64, vanity name, or Steam profile URL
        
    Examples:
        - SteamID64: ?player_id=76561198000000000
        - Vanity name: ?player_id=gaben
        - Profile URL: ?player_id=https://steamcommunity.com/id/gaben
        - URL path: ?player_id=/id/gaben
        
    Returns:
        JSON response containing Steam API data or error information
    """
    try:
        # Get and validate player_id parameter
        player_id = request.args.get('player_id')
        if not player_id:
            return jsonify({"error": "player_id parameter is required"}), 400
        
        # Validate request
        try:
            request_schema = LookupPlayerRequest(player_id)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        
        # Get Steam API key from config
        steam_api_key = current_app.config.get('STEAM_API_KEY')
        if not steam_api_key:
            current_app.logger.error("Steam API key not configured")
            return jsonify({"error": "Steam API not configured"}), 500
        
        # Create Steam API client and make request
        async def fetch_games():
            async with SteamAPIClient(
                api_key=steam_api_key,
                base_url=current_app.config.get('STEAM_API_BASE_URL', 'https://api.steampowered.com')
            ) as client:
                return await client.get_owned_games(request_schema.player_id)
        
        try:
            # Run async function in sync context
            steam_response = asyncio.run(fetch_games())
            
            # Extract the inner response data (Steam API returns {"response": {...}})
            if 'response' in steam_response:
                return jsonify(SteamAPIResponse.format_success(steam_response['response']))
            else:
                # Fallback if response format is different
                return jsonify(SteamAPIResponse.format_success(steam_response))
            
        except httpx.HTTPStatusError as e:
            current_app.logger.error(f"Steam API HTTP error: {e}")
            if e.response.status_code == 403:
                return jsonify({"error": "Steam API access denied"}), 503
            elif e.response.status_code == 404:
                return jsonify({"error": "Player not found"}), 404
            else:
                return jsonify({"error": "Steam API error"}), 503
                
        except httpx.TimeoutException:
            current_app.logger.error("Steam API timeout")
            return jsonify({"error": "Steam API timeout"}), 504
            
        except Exception as e:
            current_app.logger.error(f"Unexpected error in Steam API call: {e}")
            return jsonify({"error": "Internal server error"}), 500
    
    except Exception as e:
        current_app.logger.error(f"Unexpected error in lookup_player: {e}")
        return jsonify({"error": "Internal server error"}), 500