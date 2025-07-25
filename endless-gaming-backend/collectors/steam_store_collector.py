"""
Steam Store collector for fetching detailed game storefront data.
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional, Callable
from sqlalchemy.orm import Session

from models.game import Game
from models.storefront_data import StorefrontData
from models.game_metadata import FetchStatus
from utils.rate_limiter import SimpleRateLimiter, APIEndpoint


class SteamStoreCollector:
    """
    Collector for fetching detailed game storefront data from Steam Store API.
    
    Handles individual game storefront data fetching with proper rate limiting (1/second),
    batch processing, progress tracking, and error handling for large-scale
    data collection.
    """
    
    def __init__(self, max_retries: int = 3):
        """
        Initialize Steam Store collector.
        
        Args:
            max_retries: Maximum number of retry attempts for failed requests
        """
        self.rate_limiter = SimpleRateLimiter()
        self.logger = logging.getLogger(__name__)
        self.max_retries = max_retries
        
    def build_steam_store_api_url(self, app_id: int) -> str:
        """
        Build Steam Store API URL for fetching individual game storefront data.
        
        Args:
            app_id: Steam application ID
            
        Returns:
            Complete API URL for the specific game
        """
        base_url = "https://store.steampowered.com/api/appdetails"
        params = f"?appids={app_id}"
        return base_url + params
    
    async def fetch_storefront_data(self, app_id: int) -> StorefrontData:
        """
        Fetch storefront data for a single game from Steam Store API.
        
        Args:
            app_id: Steam application ID
            
        Returns:
            StorefrontData object with fetch status and data
        """
        url = self.build_steam_store_api_url(app_id)
        
        try:
            self.logger.debug(f"Fetching storefront data for app_id {app_id}")
            
            response_data = await self.rate_limiter.make_request(
                APIEndpoint.STEAM_STORE_APPDETAILS_API,
                url
            )
            
            # Steam Store API returns data in format: {"app_id": {"success": bool, "data": {...}}}
            app_data = response_data.get(str(app_id))
            if not app_data or not app_data.get('success'):
                self.logger.warning(f"Game {app_id} not found in Steam Store")
                return StorefrontData(
                    app_id=app_id,
                    fetch_status=FetchStatus.NOT_FOUND.value,
                    fetch_attempts=1
                )
            
            # Parse successful response
            game_data = app_data.get('data', {})
            storefront_data = self.parse_steam_store_data(app_id, game_data)
            self.logger.debug(f"Successfully fetched storefront data for app_id {app_id}")
            return storefront_data
            
        except Exception as e:
            self.logger.error(f"Failed to fetch storefront data for app_id {app_id}: {e}")
            return StorefrontData(
                app_id=app_id,
                fetch_status=FetchStatus.FAILED.value,
                fetch_attempts=1
            )
    
    def parse_steam_store_data(self, app_id: int, raw_data: Dict[str, Any]) -> StorefrontData:
        """
        Parse Steam Store API response into StorefrontData object.
        
        Args:
            app_id: Steam application ID
            raw_data: Raw response data from Steam Store API
            
        Returns:
            StorefrontData object with parsed data
        """
        # Extract release date string (Steam returns as {"date": "15 Jan, 2024"})
        release_date = None
        if raw_data.get('release_date') and raw_data['release_date'].get('date'):
            release_date = raw_data['release_date']['date']
            
        storefront_data = StorefrontData(
            app_id=app_id,
            short_description=raw_data.get('short_description'),
            detailed_description=raw_data.get('detailed_description'),
            is_free=raw_data.get('is_free'),
            required_age=raw_data.get('required_age'),
            website=raw_data.get('website'),
            header_image=raw_data.get('header_image'),
            release_date=release_date,
            developers=raw_data.get('developers'),
            publishers=raw_data.get('publishers'),
            genres=raw_data.get('genres'),
            categories=raw_data.get('categories'),
            supported_languages=raw_data.get('supported_languages'),
            price_overview=raw_data.get('price_overview'),
            pc_requirements=raw_data.get('pc_requirements'),
            screenshots=raw_data.get('screenshots'),  # Array of screenshot objects
            movies=raw_data.get('movies'),  # Array of movie/video objects
            fetch_status=FetchStatus.SUCCESS.value,
            fetch_attempts=1
        )
        
        return storefront_data
    
    async def save_storefront_data_to_database(
        self, 
        storefront_data_list: List[StorefrontData], 
        session: Session
    ) -> Dict[str, int]:
        """
        Save storefront data to database with upsert logic.
        
        Args:
            storefront_data_list: List of StorefrontData objects to save
            session: Database session
            
        Returns:
            Dictionary with counts of operations performed
        """
        new_storefront_data = 0
        updated_storefront_data = 0
        
        for storefront_data in storefront_data_list:
            existing = session.query(StorefrontData).filter_by(app_id=storefront_data.app_id).first()
            
            if existing:
                # Update existing storefront data
                existing.short_description = storefront_data.short_description
                existing.detailed_description = storefront_data.detailed_description
                existing.is_free = storefront_data.is_free
                existing.required_age = storefront_data.required_age
                existing.website = storefront_data.website
                existing.header_image = storefront_data.header_image
                existing.release_date = storefront_data.release_date
                existing.developers = storefront_data.developers
                existing.publishers = storefront_data.publishers
                existing.genres = storefront_data.genres
                existing.categories = storefront_data.categories
                existing.supported_languages = storefront_data.supported_languages
                existing.price_overview = storefront_data.price_overview
                existing.pc_requirements = storefront_data.pc_requirements
                existing.fetch_status = storefront_data.fetch_status
                existing.fetch_attempts = storefront_data.fetch_attempts
                updated_storefront_data += 1
            else:
                # Create new storefront data
                session.add(storefront_data)
                new_storefront_data += 1
        
        session.commit()
        
        self.logger.info(
            f"Saved storefront data: new={new_storefront_data}, updated={updated_storefront_data}"
        )
        
        return {
            'new_storefront_data': new_storefront_data,
            'updated_storefront_data': updated_storefront_data
        }
    
    async def collect_storefront_data_for_games(
        self,
        games: List[Game],
        session: Session,
        batch_size: int = 10,
        progress_callback: Optional[Callable[[int, int, str, str], None]] = None
    ) -> Dict[str, int]:
        """
        Collect storefront data for a list of games, saving each immediately after fetch.
        
        Args:
            games: List of Game objects to fetch storefront data for
            session: Database session
            batch_size: Number of games to process concurrently (for rate limiting)
            progress_callback: Optional callback for progress updates
                Signature: (current, total, game_name, status)
            
        Returns:
            Dictionary with operation counts and statistics
        """
        total_games = len(games)
        successful_fetches = 0
        failed_fetches = 0
        not_found = 0
        
        self.logger.info(f"Starting storefront data collection for {total_games} games")
        
        # Process games in batches for concurrent fetching but save immediately
        for i in range(0, total_games, batch_size):
            batch = games[i:i + batch_size]
            batch_start = i + 1
            batch_end = min(i + batch_size, total_games)
            
            self.logger.info(f"Processing batch {batch_start}-{batch_end} of {total_games}")
            
            # Create tasks for concurrent fetching within the batch
            tasks = []
            for game in batch:
                task = self.fetch_storefront_data(game.app_id)
                tasks.append(task)
            
            # Execute batch concurrently (rate limiter handles throttling)
            batch_storefront_data = await asyncio.gather(*tasks)
            
            # Process each game immediately: save to DB and call progress callback
            for j, storefront_data in enumerate(batch_storefront_data):
                game = batch[j]  # Get corresponding game
                
                # Save this single game's storefront data immediately
                await self.save_storefront_data_to_database([storefront_data], session)
                
                # Update counters
                if storefront_data.fetch_status == FetchStatus.SUCCESS.value:
                    successful_fetches += 1
                elif storefront_data.fetch_status == FetchStatus.NOT_FOUND.value:
                    not_found += 1
                else:
                    failed_fetches += 1
                
                # Call progress callback immediately after saving
                if progress_callback:
                    current = successful_fetches + failed_fetches + not_found
                    # Call progress callback with status info
                    progress_callback(current, total_games, game.name, storefront_data.fetch_status)
            
            self.logger.info(
                f"Completed batch {batch_start}-{batch_end}: "
                f"success={len([s for s in batch_storefront_data if s.fetch_status == FetchStatus.SUCCESS.value])}, "
                f"failed={len([s for s in batch_storefront_data if s.fetch_status == FetchStatus.FAILED.value])}, "
                f"not_found={len([s for s in batch_storefront_data if s.fetch_status == FetchStatus.NOT_FOUND.value])}"
            )
        
        result = {
            'total_games_processed': total_games,
            'successful_fetches': successful_fetches,
            'failed_fetches': failed_fetches,
            'not_found': not_found
        }
        
        self.logger.info(f"Storefront data collection completed: {result}")
        return result