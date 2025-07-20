"""
SteamSpy All collector for fetching games in popularity order.

This collector uses the SteamSpy /all endpoint to fetch games sorted by
popularity (owner count), processing them in batches of 1000 games per page.
"""
import logging
from datetime import datetime
from typing import List, Dict, Optional, Callable, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from models.game import Game
from models.game_metadata import GameMetadata  # Needed for SQLAlchemy relationship resolution
from utils.rate_limiter import SimpleRateLimiter, APIEndpoint


class SteamSpyAllCollector:
    """
    Collector for fetching games from SteamSpy /all endpoint in popularity order.
    
    Uses SteamSpy's /all endpoint which returns games sorted by owner count,
    ensuring the most popular/relevant games are processed first. Returns
    1000 games per page with rate limiting of 1 request per minute for /all calls.
    """
    
    def __init__(self):
        """Initialize SteamSpy All collector."""
        self.rate_limiter = SimpleRateLimiter()
        self.logger = logging.getLogger(__name__)
    
    def build_steamspy_all_url(self, page: int) -> str:
        """
        Build SteamSpy /all API URL for a specific page.
        
        Args:
            page: Page number (starts at 0)
            
        Returns:
            Complete URL for the SteamSpy /all request
        """
        return f"https://steamspy.com/api.php?request=all&page={page}"
    
    async def fetch_games_page(self, page: int) -> Dict[str, Any]:
        """
        Fetch a single page of games from SteamSpy /all endpoint.
        
        Args:
            page: Page number to fetch (starts at 0)
            
        Returns:
            Dictionary of games from SteamSpy API
            
        Raises:
            Exception: On API errors or network issues
        """
        url = self.build_steamspy_all_url(page)
        self.logger.info(f"Fetching SteamSpy page {page} from: {url}")
        
        try:
            response = await self.rate_limiter.make_request(
                APIEndpoint.STEAMSPY_ALL_API, url
            )
            
            self.logger.info(f"Successfully fetched {len(response)} games from page {page}")
            return response
            
        except Exception as e:
            self.logger.error(f"Failed to fetch SteamSpy page {page}: {e}")
            raise
    
    def parse_all_response(self, response: Dict[str, Any]) -> List[Game]:
        """
        Parse SteamSpy /all response into Game objects.
        
        Args:
            response: Raw response from SteamSpy /all API
            
        Returns:
            List of Game objects parsed from response
        """
        if not response or not isinstance(response, dict):
            return []
        
        games = []
        
        for app_id_str, game_data in response.items():
            try:
                # Validate game data structure
                if not isinstance(game_data, dict):
                    continue
                    
                app_id = game_data.get('appid')
                name = game_data.get('name')
                
                # Skip if missing required fields
                if not app_id or not name:
                    self.logger.warning(f"Skipping game with missing data: {game_data}")
                    continue
                
                # Create Game object with current timestamp
                game = Game(
                    app_id=int(app_id),
                    name=name,
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                games.append(game)
                
            except (ValueError, TypeError) as e:
                self.logger.warning(f"Error parsing game data {game_data}: {e}")
                continue
        
        self.logger.info(f"Parsed {len(games)} valid games from response")
        return games
    
    async def save_games_to_database(
        self, 
        games: List[Game], 
        session: Session,
        deactivate_missing: bool = False
    ) -> Dict[str, int]:
        """
        Save games to database with upsert logic.
        
        Args:
            games: List of Game objects to save
            session: Database session
            deactivate_missing: Whether to deactivate games not in current batch
            
        Returns:
            Dictionary with operation counts
        """
        new_games = 0
        updated_games = 0
        deactivated_games = 0
        
        # Get current app_ids for deactivation logic
        current_app_ids = {game.app_id for game in games}
        
        for game in games:
            try:
                # Check if game already exists
                existing = session.query(Game).filter(Game.app_id == game.app_id).first()
                
                if existing:
                    # Update existing game
                    existing.name = game.name
                    existing.is_active = True
                    existing.updated_at = datetime.utcnow()
                    updated_games += 1
                else:
                    # Add new game
                    session.add(game)
                    new_games += 1
                    
            except IntegrityError as e:
                self.logger.error(f"Database integrity error for game {game.app_id}: {e}")
                session.rollback()
                continue
        
        # Deactivate missing games if requested
        if deactivate_missing:
            # Find games not in current response
            existing_games = session.query(Game).filter(Game.is_active == True).all()
            for existing_game in existing_games:
                if existing_game.app_id not in current_app_ids:
                    existing_game.is_active = False
                    existing_game.updated_at = datetime.utcnow()
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
    
    async def collect_and_save_games(
        self,
        session: Session,
        max_pages: Optional[int] = None,
        progress_callback: Optional[Callable[[int, int, int, str], None]] = None
    ) -> Dict[str, int]:
        """
        Collect and save games from SteamSpy /all endpoint.
        
        Fetches games in popularity order (by owner count) from SteamSpy,
        processing 1000 games per page until all pages are processed or
        max_pages is reached.
        
        Args:
            session: Database session
            max_pages: Maximum number of pages to process (None for unlimited)
            progress_callback: Optional callback for progress updates
                Signature: (page, total_pages, games_in_page, status)
            
        Returns:
            Dictionary with operation counts and statistics
        """
        self.logger.info("Starting SteamSpy /all collection workflow")
        
        total_games_processed = 0
        total_new_games = 0
        total_updated_games = 0
        total_deactivated_games = 0
        pages_processed = 0
        
        page = 0
        
        while True:
            # Check if we've reached max pages
            if max_pages is not None and page >= max_pages:
                break
            
            try:
                # Fetch games page
                response = await self.fetch_games_page(page)
                pages_processed += 1
                
                # Stop if empty response (no more data)
                if not response:
                    self.logger.info(f"Received empty response at page {page}, stopping collection")
                    break
                
                # Parse games from response
                games = self.parse_all_response(response)
                
                if not games:
                    self.logger.info(f"No valid games found in page {page}, stopping collection")
                    break
                
                # Save games to database
                # Only deactivate missing games on the first page to avoid issues with pagination
                deactivate_missing = (page == 0)
                result = await self.save_games_to_database(games, session, deactivate_missing)
                
                # Update totals
                total_games_processed += len(games)
                total_new_games += result['new_games']
                total_updated_games += result['updated_games']
                total_deactivated_games += result['deactivated_games']
                
                # Progress callback
                if progress_callback:
                    total_pages = max_pages if max_pages else "unknown"
                    progress_callback(page, total_pages, len(games), "success")
                
                self.logger.info(f"Completed page {page}: {len(games)} games processed")
                
                # Move to next page
                page += 1
                
            except Exception as e:
                self.logger.error(f"Error processing page {page}: {e}")
                if progress_callback:
                    total_pages = max_pages if max_pages else "unknown"
                    progress_callback(page, total_pages, 0, "failed")
                break
        
        # Final results
        result = {
            'total_games_processed': total_games_processed,
            'new_games': total_new_games,
            'updated_games': total_updated_games,
            'deactivated_games': total_deactivated_games,
            'pages_processed': pages_processed
        }
        
        self.logger.info(f"SteamSpy /all collection completed: {result}")
        return result