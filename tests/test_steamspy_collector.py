import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import httpx

from collectors.steamspy_collector import SteamSpyMetadataCollector
from models.game import Game
from models.game_metadata import GameMetadata, FetchStatus
from utils.rate_limiter import APIEndpoint


class TestSteamSpyMetadataCollector:
    """Test cases for SteamSpyMetadataCollector class."""

    def test_collector_initialization(self):
        """Test that collector initializes correctly."""
        collector = SteamSpyMetadataCollector()
        assert collector is not None
        assert hasattr(collector, 'rate_limiter')
        assert hasattr(collector, 'logger')

    def test_build_steamspy_api_url(self):
        """Test SteamSpy API URL construction."""
        collector = SteamSpyMetadataCollector()
        
        url = collector.build_steamspy_api_url(123456)
        
        assert "https://steamspy.com/api.php" in url
        assert "request=appdetails" in url
        assert "appid=123456" in url

    @pytest.mark.asyncio
    async def test_fetch_game_metadata_success(self):
        """Test successful fetching of game metadata from SteamSpy."""
        collector = SteamSpyMetadataCollector()
        
        # Mock successful SteamSpy response
        mock_response_data = {
            "appid": 123456,
            "name": "Test Game",
            "developer": "Test Developer",
            "publisher": "Test Publisher",
            "owners": "1,000,000 .. 2,000,000",
            "positive": 1500,
            "negative": 200,
            "score_rank": 85,
            "average_forever": 120,
            "average_2weeks": 30,
            "price": "1999",
            "genre": "Action",
            "languages": "English, Spanish, French",
            "tags": {
                "action": 100,
                "adventure": 80,
                "indie": 60
            }
        }
        
        with patch.object(collector.rate_limiter, 'make_request', return_value=mock_response_data) as mock_request:
            metadata = await collector.fetch_game_metadata(123456)
            
            assert metadata is not None
            assert metadata.app_id == 123456
            assert metadata.developer == "Test Developer"
            assert metadata.publisher == "Test Publisher"
            assert metadata.owners_estimate == "1,000,000 .. 2,000,000"
            assert metadata.positive_reviews == 1500
            assert metadata.negative_reviews == 200
            assert metadata.score_rank == 85
            assert metadata.fetch_status == FetchStatus.SUCCESS.value
            
            # Verify rate limiter was called with correct endpoint
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args[0][0] == APIEndpoint.STEAMSPY_API

    @pytest.mark.asyncio
    async def test_fetch_game_metadata_not_found(self):
        """Test handling of games not found in SteamSpy."""
        collector = SteamSpyMetadataCollector()
        
        # Mock SteamSpy response for non-existent game
        mock_response_data = {}  # Empty response indicates game not found
        
        with patch.object(collector.rate_limiter, 'make_request', return_value=mock_response_data):
            metadata = await collector.fetch_game_metadata(999999)
            
            assert metadata is not None
            assert metadata.app_id == 999999
            assert metadata.fetch_status == FetchStatus.NOT_FOUND.value
            assert metadata.fetch_attempts == 1

    @pytest.mark.asyncio
    async def test_fetch_game_metadata_api_error(self):
        """Test handling of API errors during metadata fetch."""
        collector = SteamSpyMetadataCollector()
        
        # Mock API error
        with patch.object(collector.rate_limiter, 'make_request', side_effect=httpx.HTTPError("API Error")):
            metadata = await collector.fetch_game_metadata(123456)
            
            assert metadata is not None
            assert metadata.app_id == 123456
            assert metadata.fetch_status == FetchStatus.FAILED.value
            assert metadata.fetch_attempts == 1

    def test_parse_steamspy_data(self):
        """Test parsing SteamSpy API response into GameMetadata object."""
        collector = SteamSpyMetadataCollector()
        
        raw_data = {
            "appid": 123456,
            "name": "Test Game",
            "developer": "Test Developer",
            "publisher": "Test Publisher",
            "owners": "1,000,000 .. 2,000,000",
            "positive": 1500,
            "negative": 200,
            "score_rank": 85,
            "average_forever": 120,
            "average_2weeks": 30,
            "price": "1999",
            "genre": "Action",
            "languages": "English, Spanish, French",
            "tags": {
                "action": 100,
                "adventure": 80,
                "indie": 60
            }
        }
        
        metadata = collector.parse_steamspy_data(123456, raw_data)
        
        assert metadata.app_id == 123456
        assert metadata.developer == "Test Developer"
        assert metadata.publisher == "Test Publisher"
        assert metadata.owners_estimate == "1,000,000 .. 2,000,000"
        assert metadata.positive_reviews == 1500
        assert metadata.negative_reviews == 200
        assert metadata.score_rank == 85
        assert metadata.average_playtime_forever == 120
        assert metadata.average_playtime_2weeks == 30
        assert metadata.price == "19.99"  # Should convert from cents
        assert metadata.genre == "Action"
        assert metadata.languages == "English, Spanish, French"
        assert metadata.tags_json == {"action": 100, "adventure": 80, "indie": 60}
        assert metadata.fetch_status == FetchStatus.SUCCESS.value

    def test_parse_steamspy_data_missing_fields(self):
        """Test parsing SteamSpy data with missing or invalid fields."""
        collector = SteamSpyMetadataCollector()
        
        # Minimal data with missing fields
        raw_data = {
            "appid": 123456,
            "name": "Test Game",
            # Missing most fields
        }
        
        metadata = collector.parse_steamspy_data(123456, raw_data)
        
        assert metadata.app_id == 123456
        assert metadata.developer is None
        assert metadata.publisher is None
        assert metadata.positive_reviews is None
        assert metadata.negative_reviews is None
        assert metadata.fetch_status == FetchStatus.SUCCESS.value

    def test_parse_steamspy_data_price_conversion(self):
        """Test proper price conversion from cents to dollars."""
        collector = SteamSpyMetadataCollector()
        
        test_cases = [
            ("0", "Free"),
            ("1999", "19.99"),
            ("2999", "29.99"),
            ("4900", "49.00"),
            ("", None),  # Empty string
            (None, None),  # None value
        ]
        
        for price_input, expected in test_cases:
            raw_data = {"appid": 123456, "price": price_input}
            metadata = collector.parse_steamspy_data(123456, raw_data)
            assert metadata.price == expected

    @pytest.mark.asyncio
    async def test_save_metadata_to_database_new(self, db_session):
        """Test saving new metadata to database."""
        collector = SteamSpyMetadataCollector()
        
        # Create game first
        game = Game(app_id=123456, name="Test Game")
        db_session.add(game)
        db_session.commit()
        
        # Create metadata
        metadata = GameMetadata(
            app_id=123456,
            developer="Test Developer",
            publisher="Test Publisher",
            fetch_status=FetchStatus.SUCCESS.value,
            fetch_attempts=1
        )
        
        result = await collector.save_metadata_to_database([metadata], db_session)
        
        assert result['new_metadata'] == 1
        assert result['updated_metadata'] == 0
        
        # Verify metadata was saved
        saved_metadata = db_session.query(GameMetadata).filter_by(app_id=123456).first()
        assert saved_metadata is not None
        assert saved_metadata.developer == "Test Developer"

    @pytest.mark.asyncio
    async def test_save_metadata_to_database_update_existing(self, db_session):
        """Test updating existing metadata in database."""
        collector = SteamSpyMetadataCollector()
        
        # Create game and existing metadata
        game = Game(app_id=123456, name="Test Game")
        existing_metadata = GameMetadata(
            app_id=123456,
            developer="Old Developer",
            fetch_status=FetchStatus.SUCCESS.value,
            fetch_attempts=1
        )
        db_session.add_all([game, existing_metadata])
        db_session.commit()
        
        # Update metadata
        updated_metadata = GameMetadata(
            app_id=123456,
            developer="New Developer",
            publisher="New Publisher",
            fetch_status=FetchStatus.SUCCESS.value,
            fetch_attempts=2
        )
        
        result = await collector.save_metadata_to_database([updated_metadata], db_session)
        
        assert result['new_metadata'] == 0
        assert result['updated_metadata'] == 1
        
        # Verify metadata was updated
        saved_metadata = db_session.query(GameMetadata).filter_by(app_id=123456).first()
        assert saved_metadata.developer == "New Developer"
        assert saved_metadata.publisher == "New Publisher"

    @pytest.mark.asyncio
    async def test_save_metadata_to_database_failed_status(self, db_session):
        """Test saving metadata with failed status."""
        collector = SteamSpyMetadataCollector()
        
        # Create game first
        game = Game(app_id=123456, name="Test Game")
        db_session.add(game)
        db_session.commit()
        
        # Create failed metadata
        metadata = GameMetadata(
            app_id=123456,
            fetch_status=FetchStatus.FAILED.value,
            fetch_attempts=3
        )
        
        result = await collector.save_metadata_to_database([metadata], db_session)
        
        assert result['new_metadata'] == 1
        
        # Verify failed metadata was saved
        saved_metadata = db_session.query(GameMetadata).filter_by(app_id=123456).first()
        assert saved_metadata.fetch_status == FetchStatus.FAILED.value
        assert saved_metadata.fetch_attempts == 3

    @pytest.mark.asyncio
    async def test_collect_metadata_for_games_batch(self, db_session):
        """Test collecting metadata for a batch of games."""
        collector = SteamSpyMetadataCollector()
        
        # Create games
        games = [
            Game(app_id=10, name="Counter-Strike"),
            Game(app_id=20, name="Team Fortress Classic"),
        ]
        db_session.add_all(games)
        db_session.commit()
        
        # Mock SteamSpy responses
        def mock_steamspy_response(endpoint, url):
            if "appid=10" in url:
                return {
                    "appid": 10,
                    "name": "Counter-Strike",
                    "developer": "Valve",
                    "positive": 50000,
                    "negative": 1000
                }
            elif "appid=20" in url:
                return {
                    "appid": 20,
                    "name": "Team Fortress Classic",
                    "developer": "Valve",
                    "positive": 15000,
                    "negative": 500
                }
            return {}
        
        with patch.object(collector.rate_limiter, 'make_request', side_effect=mock_steamspy_response):
            result = await collector.collect_metadata_for_games(games, db_session)
            
            assert result['total_games_processed'] == 2
            assert result['successful_fetches'] == 2
            assert result['failed_fetches'] == 0
            assert result['not_found'] == 0
            
            # Verify metadata was saved
            metadata_count = db_session.query(GameMetadata).count()
            assert metadata_count == 2

    @pytest.mark.asyncio
    async def test_collect_metadata_for_games_mixed_results(self, db_session):
        """Test collecting metadata with mixed success/failure results."""
        collector = SteamSpyMetadataCollector()
        
        # Create games
        games = [
            Game(app_id=10, name="Valid Game"),
            Game(app_id=20, name="Not Found Game"),
            Game(app_id=30, name="Error Game"),
        ]
        db_session.add_all(games)
        db_session.commit()
        
        # Mock SteamSpy responses with mixed results
        def mock_steamspy_response(endpoint, url):
            if "appid=10" in url:
                return {"appid": 10, "name": "Valid Game", "developer": "Test"}
            elif "appid=20" in url:
                return {}  # Not found
            elif "appid=30" in url:
                raise httpx.HTTPError("API Error")
            return {}
        
        with patch.object(collector.rate_limiter, 'make_request', side_effect=mock_steamspy_response):
            result = await collector.collect_metadata_for_games(games, db_session)
            
            assert result['total_games_processed'] == 3
            assert result['successful_fetches'] == 1
            assert result['failed_fetches'] == 1
            assert result['not_found'] == 1

    @pytest.mark.asyncio
    async def test_collect_metadata_with_progress_tracking(self, db_session):
        """Test metadata collection with progress tracking."""
        collector = SteamSpyMetadataCollector()
        
        # Create multiple games
        games = [Game(app_id=i, name=f"Game {i}") for i in range(1, 6)]
        db_session.add_all(games)
        db_session.commit()
        
        # Mock progress callback
        progress_updates = []
        def mock_progress_callback(current, total, game_name, top_tags, status):
            progress_updates.append((current, total, game_name, top_tags, status))
        
        # Mock SteamSpy responses
        mock_response = {"appid": 1, "name": "Test", "developer": "Test"}
        with patch.object(collector.rate_limiter, 'make_request', return_value=mock_response):
            result = await collector.collect_metadata_for_games(
                games, 
                db_session, 
                progress_callback=mock_progress_callback
            )
            
            assert result['total_games_processed'] == 5
            # Should have received progress updates
            assert len(progress_updates) >= 5

    @pytest.mark.asyncio
    async def test_collect_metadata_respects_rate_limiting(self):
        """Test that metadata collection respects rate limiting."""
        collector = SteamSpyMetadataCollector()
        
        # Mock rate limiter to track calls
        rate_limiter_calls = []
        async def mock_make_request(endpoint, url):
            rate_limiter_calls.append((endpoint, url))
            return {"appid": 123, "name": "Test"}
        
        games = [Game(app_id=123, name="Test Game")]
        
        with patch.object(collector.rate_limiter, 'make_request', side_effect=mock_make_request):
            with patch('sqlalchemy.orm.Session') as mock_session:
                mock_session.return_value.add.return_value = None
                mock_session.return_value.commit.return_value = None
                
                await collector.collect_metadata_for_games(games, mock_session.return_value)
                
                # Verify rate limiter was called with correct endpoint
                assert len(rate_limiter_calls) == 1
                assert rate_limiter_calls[0][0] == APIEndpoint.STEAMSPY_API

    def test_collector_handles_retry_logic(self):
        """Test that collector implements proper retry logic."""
        collector = SteamSpyMetadataCollector()
        
        # Should have configurable retry settings
        assert hasattr(collector, 'max_retries')
        assert collector.max_retries > 0

    @pytest.mark.asyncio
    async def test_collect_metadata_batch_processing(self, db_session):
        """Test that large game lists are processed in batches."""
        collector = SteamSpyMetadataCollector()
        
        # Create many games to test batching
        games = [Game(app_id=i, name=f"Game {i}") for i in range(1, 101)]  # 100 games
        db_session.add_all(games)
        db_session.commit()
        
        # Mock SteamSpy response
        mock_response = {"appid": 1, "name": "Test", "developer": "Test"}
        with patch.object(collector.rate_limiter, 'make_request', return_value=mock_response):
            result = await collector.collect_metadata_for_games(
                games, 
                db_session,
                batch_size=25  # Process in smaller batches
            )
            
            assert result['total_games_processed'] == 100
            # Should process all games regardless of batch size

    def test_steamspy_url_building_edge_cases(self):
        """Test SteamSpy URL building with edge cases."""
        collector = SteamSpyMetadataCollector()
        
        # Test with various app_id types
        url1 = collector.build_steamspy_api_url(123)
        url2 = collector.build_steamspy_api_url("456")
        
        assert "appid=123" in url1
        assert "appid=456" in url2
        
        # Test URL structure
        url = collector.build_steamspy_api_url(123456)
        assert url.startswith("https://steamspy.com/api.php")
        assert "request=appdetails" in url
        assert "appid=123456" in url