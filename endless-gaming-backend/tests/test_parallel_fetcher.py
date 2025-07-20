"""
Tests for parallel metadata fetching functionality.
"""
import asyncio
import pytest
from unittest.mock import Mock, AsyncMock, patch, call
from sqlalchemy.orm import Session

from workers.parallel_fetcher import ParallelMetadataFetcher
from collectors.steamspy_collector import SteamSpyMetadataCollector
from models.game import Game
from models.game_metadata import GameMetadata, FetchStatus


class TestParallelMetadataFetcher:
    """Test the ParallelMetadataFetcher class."""
    
    def test_fetcher_initialization(self):
        """Test that ParallelMetadataFetcher initializes correctly."""
        collector = Mock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector, batch_size=25, max_concurrent=5)
        
        assert fetcher.steamspy_collector == collector
        assert fetcher.batch_size == 25
        assert fetcher.max_concurrent == 5
    
    def test_fetcher_default_values(self):
        """Test default initialization values."""
        collector = Mock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector)
        
        assert fetcher.batch_size == 50
        assert fetcher.max_concurrent == 10
    
    @pytest.mark.asyncio
    async def test_process_batch_empty_games(self, db_session):
        """Test processing an empty batch of games."""
        collector = Mock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector)
        
        result = await fetcher.process_batch([], db_session)
        
        assert result == []
        collector.collect_metadata_for_games.assert_not_called()
    
    @pytest.mark.asyncio
    async def test_process_batch_with_games(self, db_session, sample_games):
        """Test processing a batch of games."""
        collector = AsyncMock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector)
        
        # Mock the collector to return success
        collector.collect_metadata_for_games.return_value = None
        
        result = await fetcher.process_batch(sample_games, db_session)
        
        assert result == sample_games
        collector.collect_metadata_for_games.assert_called_once_with(
            sample_games, db_session, progress_callback=None
        )
    
    @pytest.mark.asyncio
    async def test_process_batch_with_progress_callback(self, db_session, sample_games):
        """Test processing a batch with progress callback."""
        collector = AsyncMock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector)
        progress_callback = Mock()
        
        await fetcher.process_batch(sample_games, db_session, progress_callback)
        
        collector.collect_metadata_for_games.assert_called_once_with(
            sample_games, db_session, progress_callback=progress_callback
        )
    
    @pytest.mark.asyncio
    async def test_process_games_parallel_single_batch(self, db_session, sample_games):
        """Test parallel processing with games that fit in a single batch."""
        collector = AsyncMock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector, batch_size=10)
        
        # Should fit in one batch since we have 3 games and batch_size=10
        results = await fetcher.process_games_parallel(sample_games, db_session)
        
        assert len(results) == 1  # One batch
        assert results[0] == sample_games
        collector.collect_metadata_for_games.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_process_games_parallel_multiple_batches(self, db_session):
        """Test parallel processing with games that require multiple batches."""
        collector = AsyncMock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector, batch_size=2)
        
        # Create 5 games, should split into 3 batches (2, 2, 1)
        games = [
            Game(app_id=1, name="Game 1"),
            Game(app_id=2, name="Game 2"),
            Game(app_id=3, name="Game 3"),
            Game(app_id=4, name="Game 4"),
            Game(app_id=5, name="Game 5"),
        ]
        
        results = await fetcher.process_games_parallel(games, db_session)
        
        assert len(results) == 3  # Three batches
        assert len(results[0]) == 2  # First batch: 2 games
        assert len(results[1]) == 2  # Second batch: 2 games
        assert len(results[2]) == 1  # Third batch: 1 game
        
        # Should be called once per batch
        assert collector.collect_metadata_for_games.call_count == 3
    
    @pytest.mark.asyncio
    async def test_process_games_parallel_with_progress_tracking(self, db_session, sample_games):
        """Test parallel processing with progress tracking."""
        collector = AsyncMock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector)
        progress_callback = Mock()
        
        await fetcher.process_games_parallel(sample_games, db_session, progress_callback)
        
        # Progress callback should be passed to the collector
        collector.collect_metadata_for_games.assert_called_with(
            sample_games, db_session, progress_callback=progress_callback
        )
    
    @pytest.mark.asyncio
    async def test_process_games_parallel_handles_collector_errors(self, db_session, sample_games):
        """Test that parallel processing handles collector errors gracefully."""
        collector = AsyncMock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector)
        
        # Mock collector to raise an exception
        collector.collect_metadata_for_games.side_effect = Exception("API Error")
        
        # Should not raise exception, but return empty results
        with pytest.raises(Exception, match="API Error"):
            await fetcher.process_games_parallel(sample_games, db_session)
    
    @pytest.mark.asyncio 
    async def test_batch_creation_logic(self, db_session):
        """Test that batches are created with correct sizes."""
        collector = AsyncMock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector, batch_size=3)
        
        # Create 7 games, should split into 3 batches (3, 3, 1)
        games = [Game(app_id=i, name=f"Game {i}") for i in range(1, 8)]
        
        await fetcher.process_games_parallel(games, db_session)
        
        # Verify the batches were the right size
        calls = collector.collect_metadata_for_games.call_args_list
        assert len(calls) == 3
        
        # Check batch sizes
        assert len(calls[0][0][0]) == 3  # First batch: 3 games
        assert len(calls[1][0][0]) == 3  # Second batch: 3 games  
        assert len(calls[2][0][0]) == 1  # Third batch: 1 game
    
    @pytest.mark.asyncio
    async def test_concurrent_batch_processing(self, db_session):
        """Test that batches are processed concurrently."""
        collector = AsyncMock(spec=SteamSpyMetadataCollector)
        fetcher = ParallelMetadataFetcher(collector, batch_size=2)
        
        # Create delay to verify concurrency
        async def delayed_collect(*args, **kwargs):
            await asyncio.sleep(0.1)
            return args[0]  # Return the games passed in
        
        collector.collect_metadata_for_games.side_effect = delayed_collect
        
        games = [Game(app_id=i, name=f"Game {i}") for i in range(1, 5)]  # 4 games = 2 batches
        
        import time
        start_time = time.time()
        results = await fetcher.process_games_parallel(games, db_session)
        elapsed_time = time.time() - start_time
        
        # If processed sequentially, would take ~0.2s. If concurrent, should be ~0.1s
        assert elapsed_time < 0.15  # Should be roughly 0.1s with some buffer
        assert len(results) == 2  # Two batches


@pytest.fixture
def sample_games():
    """Create sample games for testing."""
    return [
        Game(app_id=1, name="Game 1"),
        Game(app_id=2, name="Game 2"), 
        Game(app_id=3, name="Game 3"),
    ]