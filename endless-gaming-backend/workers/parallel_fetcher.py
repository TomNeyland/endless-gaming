"""
Parallel metadata fetcher for efficient batch processing of Steam game metadata.

This module implements the hybrid batch + queue approach recommended in the spec,
processing games in batches for progress tracking while using asyncio.gather()
within each batch for concurrency.
"""
import asyncio
from typing import List, Optional, Callable, Any
from sqlalchemy.orm import Session

from collectors.steamspy_collector import SteamSpyMetadataCollector
from collectors.steam_store_collector import SteamStoreCollector
from models.game import Game


class ParallelMetadataFetcher:
    """
    Parallel metadata fetcher for processing large batches of games efficiently.
    
    Uses a hybrid batch + queue approach:
    - Process games in batches for progress tracking and memory efficiency
    - Use asyncio.gather() within each batch for concurrent API calls
    - Save batch results to database after each batch completes
    - Shared rate limiter automatically throttles requests across all concurrent workers
    """
    
    def __init__(
        self, 
        steamspy_collector: SteamSpyMetadataCollector,
        steam_store_collector: Optional[SteamStoreCollector] = None,
        batch_size: int = 50,
        max_concurrent: int = 10
    ):
        """
        Initialize the parallel metadata fetcher.
        
        Args:
            steamspy_collector: SteamSpy collector instance with rate limiter
            steam_store_collector: Optional Steam Store collector instance
            batch_size: Number of games to process per batch (default: 50)
            max_concurrent: Maximum concurrent requests per batch (default: 10)
        """
        self.steamspy_collector = steamspy_collector
        self.steam_store_collector = steam_store_collector
        self.batch_size = batch_size
        self.max_concurrent = max_concurrent
    
    async def process_batch(
        self, 
        games: List[Game], 
        session: Session,
        progress_callback: Optional[Callable] = None
    ) -> List[Game]:
        """
        Process a single batch of games for metadata and optionally storefront data collection.
        
        Args:
            games: List of Game objects to process
            session: SQLAlchemy session for database operations
            progress_callback: Optional callback for progress tracking
            
        Returns:
            List of processed games
        """
        if not games:
            return []
        
        # First, collect SteamSpy metadata
        await self.steamspy_collector.collect_metadata_for_games(
            games, session, progress_callback=progress_callback
        )
        
        # Then, collect Steam Store data if collector is provided
        if self.steam_store_collector:
            # Create a modified progress callback that shows storefront status
            def storefront_progress_callback(current, total, game_name, status):
                if progress_callback:
                    # Call original callback but indicate it's storefront data
                    progress_callback(current, total, f"{game_name} (storefront)", [], status)
            
            await self.steam_store_collector.collect_storefront_data_for_games(
                games, session, progress_callback=storefront_progress_callback
            )
        
        return games
    
    async def process_games_parallel(
        self,
        games: List[Game],
        session: Session,
        progress_callback: Optional[Callable] = None
    ) -> List[List[Game]]:
        """
        Process all games in parallel using batched approach.
        
        Uses hybrid batch + queue strategy:
        1. Split games into batches for progress tracking
        2. Process batches concurrently using asyncio.gather()
        3. Within each batch, the SteamSpyCollector handles concurrent requests
        4. Save results after each batch completes
        
        Args:
            games: List of all Game objects to process
            session: SQLAlchemy session for database operations
            progress_callback: Optional callback for progress tracking
            
        Returns:
            List of batches (each batch is a list of processed games)
        """
        if not games:
            return []
        
        # Split games into batches
        batches = []
        for i in range(0, len(games), self.batch_size):
            batch = games[i:i + self.batch_size]
            batches.append(batch)
        
        # Process all batches concurrently
        batch_tasks = []
        for batch in batches:
            task = self.process_batch(batch, session, progress_callback)
            batch_tasks.append(task)
        
        # Wait for all batches to complete
        completed_batches = await asyncio.gather(*batch_tasks)
        
        return completed_batches