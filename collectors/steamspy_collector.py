"""
SteamSpy metadata collector for fetching detailed game metadata.
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional, Callable
from sqlalchemy.orm import Session

from models.game import Game
from models.game_metadata import GameMetadata, FetchStatus
from utils.rate_limiter import SimpleRateLimiter, APIEndpoint


class SteamSpyMetadataCollector:
    """
    Collector for fetching detailed game metadata from SteamSpy API.
    
    Handles individual game metadata fetching with proper rate limiting,
    batch processing, progress tracking, and error handling for large-scale
    data collection (23k+ games).
    """
    
    def __init__(self, max_retries: int = 3):
        """
        Initialize SteamSpy metadata collector.
        
        Args:
            max_retries: Maximum number of retry attempts for failed requests
        """
        self.rate_limiter = SimpleRateLimiter()
        self.logger = logging.getLogger(__name__)
        self.max_retries = max_retries
        
    def build_steamspy_api_url(self, app_id: int) -> str:
        """
        Build SteamSpy API URL for fetching individual game metadata.
        
        Args:
            app_id: Steam application ID
            
        Returns:
            Complete API URL for the specific game
        """
        base_url = "https://steamspy.com/api.php"
        params = f"?request=appdetails&appid={app_id}"
        return base_url + params
    
    async def fetch_game_metadata(self, app_id: int) -> GameMetadata:
        """
        Fetch metadata for a single game from SteamSpy API.
        
        Args:
            app_id: Steam application ID
            
        Returns:
            GameMetadata object with fetch status and data
        """
        url = self.build_steamspy_api_url(app_id)
        
        try:
            self.logger.debug(f"Fetching metadata for app_id {app_id}")
            
            response_data = await self.rate_limiter.make_request(
                APIEndpoint.STEAMSPY_API,
                url
            )
            
            # Check if game was found (SteamSpy returns empty dict for not found)
            if not response_data or not response_data.get('appid'):
                self.logger.warning(f"Game {app_id} not found in SteamSpy")
                return GameMetadata(
                    app_id=app_id,
                    fetch_status=FetchStatus.NOT_FOUND.value,
                    fetch_attempts=1
                )
            
            # Parse successful response
            metadata = self.parse_steamspy_data(app_id, response_data)
            self.logger.debug(f"Successfully fetched metadata for app_id {app_id}")
            return metadata
            
        except Exception as e:
            self.logger.error(f"Failed to fetch metadata for app_id {app_id}: {e}")
            return GameMetadata(
                app_id=app_id,
                fetch_status=FetchStatus.FAILED.value,
                fetch_attempts=1
            )
    
    def parse_steamspy_data(self, app_id: int, raw_data: Dict[str, Any]) -> GameMetadata:
        """
        Parse SteamSpy API response into GameMetadata object.
        
        Args:
            app_id: Steam application ID
            raw_data: Raw response data from SteamSpy API
            
        Returns:
            GameMetadata object with parsed data
        """
        # Convert price from cents to dollars
        price = self._convert_price(raw_data.get('price'))
        
        # Extract tags (can be dict or None)
        tags_json = raw_data.get('tags')
        if not isinstance(tags_json, dict):
            tags_json = None
        
        metadata = GameMetadata(
            app_id=app_id,
            developer=raw_data.get('developer'),
            publisher=raw_data.get('publisher'), 
            owners_estimate=raw_data.get('owners'),
            positive_reviews=raw_data.get('positive'),
            negative_reviews=raw_data.get('negative'),
            score_rank=raw_data.get('score_rank'),
            average_playtime_forever=raw_data.get('average_forever'),
            average_playtime_2weeks=raw_data.get('average_2weeks'),
            price=price,
            genre=raw_data.get('genre'),
            languages=raw_data.get('languages'),
            tags_json=tags_json,
            fetch_status=FetchStatus.SUCCESS.value,
            fetch_attempts=1
        )
        
        return metadata
    
    def _convert_price(self, price_cents: Any) -> Optional[str]:
        """
        Convert price from cents to dollar string format.
        
        Args:
            price_cents: Price in cents (string, int, or None)
            
        Returns:
            Formatted price string or None
        """
        if not price_cents:
            return None
            
        try:
            cents = int(price_cents)
            if cents == 0:
                return "Free"
            
            dollars = cents / 100
            return f"{dollars:.2f}"
            
        except (ValueError, TypeError):
            return None
    
    async def save_metadata_to_database(
        self, 
        metadata_list: List[GameMetadata], 
        session: Session
    ) -> Dict[str, int]:
        """
        Save metadata to database with upsert logic.
        
        Args:
            metadata_list: List of GameMetadata objects to save
            session: Database session
            
        Returns:
            Dictionary with counts of operations performed
        """
        new_metadata = 0
        updated_metadata = 0
        
        for metadata in metadata_list:
            existing = session.query(GameMetadata).filter_by(app_id=metadata.app_id).first()
            
            if existing:
                # Update existing metadata
                existing.developer = metadata.developer
                existing.publisher = metadata.publisher
                existing.owners_estimate = metadata.owners_estimate
                existing.positive_reviews = metadata.positive_reviews
                existing.negative_reviews = metadata.negative_reviews
                existing.score_rank = metadata.score_rank
                existing.average_playtime_forever = metadata.average_playtime_forever
                existing.average_playtime_2weeks = metadata.average_playtime_2weeks
                existing.price = metadata.price
                existing.genre = metadata.genre
                existing.languages = metadata.languages
                existing.tags_json = metadata.tags_json
                existing.fetch_status = metadata.fetch_status
                existing.fetch_attempts = metadata.fetch_attempts
                updated_metadata += 1
            else:
                # Create new metadata
                session.add(metadata)
                new_metadata += 1
        
        session.commit()
        
        self.logger.info(
            f"Saved metadata: new={new_metadata}, updated={updated_metadata}"
        )
        
        return {
            'new_metadata': new_metadata,
            'updated_metadata': updated_metadata
        }
    
    async def collect_metadata_for_games(
        self,
        games: List[Game],
        session: Session,
        batch_size: int = 50,
        progress_callback: Optional[Callable[[int, int, str], None]] = None
    ) -> Dict[str, int]:
        """
        Collect metadata for a list of games with batch processing.
        
        Args:
            games: List of Game objects to fetch metadata for
            session: Database session
            batch_size: Number of games to process in each batch
            progress_callback: Optional callback for progress updates
            
        Returns:
            Dictionary with operation counts and statistics
        """
        total_games = len(games)
        successful_fetches = 0
        failed_fetches = 0
        not_found = 0
        
        self.logger.info(f"Starting metadata collection for {total_games} games")
        
        # Process games in batches
        for i in range(0, total_games, batch_size):
            batch = games[i:i + batch_size]
            batch_start = i + 1
            batch_end = min(i + batch_size, total_games)
            
            self.logger.info(f"Processing batch {batch_start}-{batch_end} of {total_games}")
            
            # Create tasks for concurrent fetching within the batch
            tasks = []
            for game in batch:
                task = self.fetch_game_metadata(game.app_id)
                tasks.append(task)
            
            # Execute batch concurrently (rate limiter handles throttling)
            batch_metadata = await asyncio.gather(*tasks)
            
            # Count results
            for metadata in batch_metadata:
                if metadata.fetch_status == FetchStatus.SUCCESS.value:
                    successful_fetches += 1
                elif metadata.fetch_status == FetchStatus.NOT_FOUND.value:
                    not_found += 1
                else:
                    failed_fetches += 1
                
                # Progress callback
                if progress_callback:
                    current = successful_fetches + failed_fetches + not_found
                    progress_callback(current, total_games, metadata.fetch_status)
            
            # Save batch to database
            await self.save_metadata_to_database(batch_metadata, session)
            
            self.logger.info(
                f"Completed batch {batch_start}-{batch_end}: "
                f"success={len([m for m in batch_metadata if m.fetch_status == FetchStatus.SUCCESS.value])}, "
                f"failed={len([m for m in batch_metadata if m.fetch_status == FetchStatus.FAILED.value])}, "
                f"not_found={len([m for m in batch_metadata if m.fetch_status == FetchStatus.NOT_FOUND.value])}"
            )
        
        result = {
            'total_games_processed': total_games,
            'successful_fetches': successful_fetches,
            'failed_fetches': failed_fetches,
            'not_found': not_found
        }
        
        self.logger.info(f"Metadata collection completed: {result}")
        return result