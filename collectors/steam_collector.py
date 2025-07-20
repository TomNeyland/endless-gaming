"""
Steam game list collector for fetching and managing Steam game data.
"""
import logging
import os
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models.game import Game
from models.game_metadata import GameMetadata  # Import to ensure SQLAlchemy relationship works
from utils.rate_limiter import SimpleRateLimiter, APIEndpoint


class SteamGameListCollector:
    """
    Collector for fetching Steam game list and managing game data in database.
    
    Handles fetching the complete Steam game list from the Steam Web API,
    parsing the data, and maintaining the local database with proper
    upsert logic for new/updated/deactivated games.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Steam game list collector.
        
        Args:
            api_key: Steam Web API key. If not provided, will try to get from environment.
        """
        self.api_key = api_key or os.getenv('STEAM_API_KEY')
        self.rate_limiter = SimpleRateLimiter()
        self.logger = logging.getLogger(__name__)
        
    def build_steam_api_url(self) -> str:
        """
        Build Steam API URL for fetching game list.
        
        Returns:
            Complete API URL with key and parameters
            
        Raises:
            ValueError: If no API key is available
        """
        if not self.api_key:
            raise ValueError("Steam API key is required")
            
        base_url = "https://api.steampowered.com/ISteamApps/GetAppList/v2/"
        params = f"?key={self.api_key}&format=json"
        return base_url + params
    
    async def fetch_steam_game_list(self) -> List[Dict[str, Any]]:
        """
        Fetch complete game list from Steam API.
        
        Returns:
            List of raw game dictionaries from Steam API
            
        Raises:
            httpx.HTTPError: On API request failures
            KeyError: On invalid API response structure
        """
        url = self.build_steam_api_url()
        self.logger.info("Fetching Steam game list from API")
        
        response_data = await self.rate_limiter.make_request(
            APIEndpoint.STEAM_WEB_API,
            url
        )
        
        # Extract games from Steam API response structure
        games = response_data['applist']['apps']
        self.logger.info(f"Received {len(games)} games from Steam API")
        
        return games
    
    def parse_game_data(self, raw_games: List[Dict[str, Any]]) -> List[Game]:
        """
        Parse raw Steam API game data into Game objects.
        
        Filters out invalid entries (missing appid/name, invalid types).
        
        Args:
            raw_games: Raw game dictionaries from Steam API
            
        Returns:
            List of valid Game objects
        """
        parsed_games = []
        
        for raw_game in raw_games:
            try:
                # Validate required fields
                app_id = raw_game.get('appid')
                name = raw_game.get('name')
                
                if not app_id or not name:
                    continue
                    
                # Ensure app_id is numeric
                if not isinstance(app_id, int):
                    try:
                        app_id = int(app_id)
                    except (ValueError, TypeError):
                        continue
                
                # Create Game object
                game = Game(app_id=app_id, name=str(name))
                parsed_games.append(game)
                
            except Exception as e:
                self.logger.warning(f"Failed to parse game data: {raw_game}, error: {e}")
                continue
        
        self.logger.info(f"Parsed {len(parsed_games)} valid games from {len(raw_games)} raw entries")
        return parsed_games
    
    async def save_games_to_database(
        self, 
        games: List[Game], 
        session: Session
    ) -> Dict[str, int]:
        """
        Save games to database with upsert logic.
        
        - Creates new games that don't exist
        - Updates existing games (name changes)
        - Deactivates games that are no longer in the Steam API
        
        Args:
            games: List of Game objects to save
            session: Database session
            
        Returns:
            Dictionary with counts of operations performed
        """
        new_games = 0
        updated_games = 0
        deactivated_games = 0
        
        # Get current app_ids from Steam API
        current_app_ids = {game.app_id for game in games}
        
        # Process each game from Steam API
        for game in games:
            existing_game = session.query(Game).filter_by(app_id=game.app_id).first()
            
            if existing_game:
                # Update existing game
                if existing_game.name != game.name:
                    existing_game.name = game.name
                    updated_games += 1
                
                # Ensure it's marked as active
                if not existing_game.is_active:
                    existing_game.is_active = True
                    updated_games += 1
            else:
                # Create new game
                session.add(game)
                new_games += 1
        
        # Deactivate games that are no longer in Steam API
        # (but only games that are currently active)
        active_games = session.query(Game).filter_by(is_active=True).all()
        for existing_game in active_games:
            if existing_game.app_id not in current_app_ids:
                existing_game.is_active = False
                deactivated_games += 1
        
        # Commit all changes
        session.commit()
        
        self.logger.info(
            f"Database operations completed: "
            f"new={new_games}, updated={updated_games}, deactivated={deactivated_games}"
        )
        
        return {
            'new_games': new_games,
            'updated_games': updated_games,
            'deactivated_games': deactivated_games
        }
    
    async def collect_and_save_games(self, session: Session) -> Dict[str, int]:
        """
        Complete workflow: fetch games from Steam API and save to database.
        
        Args:
            session: Database session
            
        Returns:
            Dictionary with operation counts and total games processed
        """
        self.logger.info("Starting Steam game collection workflow")
        
        # Fetch raw game data from Steam API
        raw_games = await self.fetch_steam_game_list()
        
        # Parse into Game objects
        games = self.parse_game_data(raw_games)
        
        # Save to database
        db_result = await self.save_games_to_database(games, session)
        
        # Add total count to result
        result = db_result.copy()
        result['total_games_processed'] = len(games)
        
        self.logger.info(f"Steam game collection completed: {result}")
        return result