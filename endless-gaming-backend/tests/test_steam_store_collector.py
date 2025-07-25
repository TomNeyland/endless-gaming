import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import httpx

from collectors.steam_store_collector import SteamStoreCollector
from models.game import Game
from models.storefront_data import StorefrontData
from models.game_metadata import FetchStatus
from utils.rate_limiter import APIEndpoint


class TestSteamStoreCollector:
    """Test cases for SteamStoreCollector class."""

    def test_collector_initialization(self):
        """Test that collector initializes correctly."""
        collector = SteamStoreCollector()
        assert collector is not None
        assert hasattr(collector, 'rate_limiter')
        assert hasattr(collector, 'logger')

    def test_build_steam_store_api_url(self):
        """Test Steam Store API URL construction."""
        collector = SteamStoreCollector()
        
        url = collector.build_steam_store_api_url(123456)
        
        assert "https://store.steampowered.com/api/appdetails" in url
        assert "appids=123456" in url

    @pytest.mark.asyncio
    async def test_fetch_storefront_data_success(self):
        """Test successful fetching of storefront data from Steam Store API."""
        collector = SteamStoreCollector()
        
        # Mock successful Steam Store API response (based on actual API structure)
        mock_response_data = {
            "123456": {
                "success": True,
                "data": {
                    "steam_appid": 123456,
                    "name": "Test Game",
                    "short_description": "A test game description",
                    "detailed_description": "This is a detailed description of the test game.",
                    "is_free": False,
                    "required_age": 0,
                    "website": "https://testgame.example.com",
                    "header_image": "https://cdn.akamai.steamstatic.com/steam/apps/123456/header.jpg",
                    "release_date": {"date": "15 Jan, 2024"},
                    "developers": ["Test Developer Inc"],
                    "publishers": ["Test Publisher Corp"],
                    "genres": [{"id": "1", "description": "Action"}],
                    "categories": [{"id": "2", "description": "Single-player"}],
                    "supported_languages": "English<strong>*</strong>, Spanish, French<br><strong>*</strong>languages with full audio support",
                    "price_overview": {"currency": "USD", "initial": 1999, "final": 1999, "discount_percent": 0},
                    "pc_requirements": {"minimum": "Windows 10", "recommended": "Windows 11"}
                }
            }
        }
        
        with patch.object(collector.rate_limiter, 'make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response_data
            
            result = await collector.fetch_storefront_data(123456)
            
            # Verify API call was made correctly
            mock_request.assert_called_once()
            args, kwargs = mock_request.call_args
            assert args[0] == APIEndpoint.STEAM_STORE_APPDETAILS_API
            assert "appids=123456" in args[1]
            
            # Verify StorefrontData object was created correctly
            assert isinstance(result, StorefrontData)
            assert result.app_id == 123456
            assert result.short_description == "A test game description"
            assert result.is_free == False
            assert result.required_age == 0
            assert result.fetch_status == FetchStatus.SUCCESS.value

    @pytest.mark.asyncio
    async def test_fetch_storefront_data_not_found(self):
        """Test handling of games not found in Steam Store API."""
        collector = SteamStoreCollector()
        
        # Mock Steam Store API response for non-existent game
        mock_response_data = {
            "999999": {
                "success": False
            }
        }
        
        with patch.object(collector.rate_limiter, 'make_request', new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response_data
            
            result = await collector.fetch_storefront_data(999999)
            
            assert isinstance(result, StorefrontData)
            assert result.app_id == 999999
            assert result.fetch_status == FetchStatus.NOT_FOUND.value
            assert result.fetch_attempts == 1

    @pytest.mark.asyncio
    async def test_fetch_storefront_data_api_error(self):
        """Test handling of API errors during storefront data fetching."""
        collector = SteamStoreCollector()
        
        with patch.object(collector.rate_limiter, 'make_request', new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = httpx.HTTPError("API error")
            
            result = await collector.fetch_storefront_data(123456)
            
            assert isinstance(result, StorefrontData)
            assert result.app_id == 123456
            assert result.fetch_status == FetchStatus.FAILED.value
            assert result.fetch_attempts == 1

    def test_parse_steam_store_data_complete(self):
        """Test parsing complete Steam Store API data."""
        collector = SteamStoreCollector()
        
        raw_data = {
            "steam_appid": 123456,
            "name": "Test Game",
            "short_description": "A test game description",
            "detailed_description": "This is a detailed description of the test game.",
            "is_free": False,
            "required_age": 13,
            "website": "https://testgame.example.com",
            "header_image": "https://cdn.akamai.steamstatic.com/steam/apps/123456/header.jpg",
            "release_date": {"date": "15 Jan, 2024"},
            "developers": ["Test Developer Inc"],
            "publishers": ["Test Publisher Corp"],
            "genres": [{"id": "1", "description": "Action"}],
            "categories": [{"id": "2", "description": "Single-player"}],
            "supported_languages": "English<strong>*</strong>, Spanish, French<br><strong>*</strong>languages with full audio support",
            "price_overview": {"currency": "USD", "initial": 1999, "final": 1499, "discount_percent": 25},
            "pc_requirements": {"minimum": "Windows 10", "recommended": "Windows 11"}
        }
        
        result = collector.parse_steam_store_data(123456, raw_data)
        
        assert result.app_id == 123456
        assert result.short_description == "A test game description"
        assert result.detailed_description == "This is a detailed description of the test game."
        assert result.is_free == False
        assert result.required_age == 13
        assert result.website == "https://testgame.example.com"
        assert result.header_image == "https://cdn.akamai.steamstatic.com/steam/apps/123456/header.jpg"
        assert result.release_date == "15 Jan, 2024"
        assert result.developers == ["Test Developer Inc"]
        assert result.publishers == ["Test Publisher Corp"]
        assert result.genres == [{"id": "1", "description": "Action"}]
        assert result.categories == [{"id": "2", "description": "Single-player"}]
        assert result.price_overview == {"currency": "USD", "initial": 1999, "final": 1499, "discount_percent": 25}
        assert result.pc_requirements == {"minimum": "Windows 10", "recommended": "Windows 11"}
        assert result.fetch_status == FetchStatus.SUCCESS.value

    def test_parse_steam_store_data_minimal(self):
        """Test parsing minimal Steam Store API data with missing fields."""
        collector = SteamStoreCollector()
        
        raw_data = {
            "steam_appid": 123456,
            "name": "Minimal Game",
            "is_free": True
        }
        
        result = collector.parse_steam_store_data(123456, raw_data)
        
        assert result.app_id == 123456
        assert result.is_free == True
        assert result.short_description is None
        assert result.detailed_description is None
        assert result.required_age is None
        assert result.developers is None
        assert result.publishers is None
        assert result.price_overview is None
        assert result.fetch_status == FetchStatus.SUCCESS.value

    @pytest.mark.asyncio
    async def test_save_storefront_data_to_database_new(self, db_session, sample_game_data):
        """Test saving new storefront data to database."""
        collector = SteamStoreCollector()
        
        # Create a game first
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create storefront data
        storefront_data = StorefrontData(
            app_id=123456,
            short_description="Test description",
            is_free=False,
            fetch_status=FetchStatus.SUCCESS.value
        )
        
        result = await collector.save_storefront_data_to_database([storefront_data], db_session)
        
        assert result['new_storefront_data'] == 1
        assert result['updated_storefront_data'] == 0

    @pytest.mark.asyncio
    async def test_save_storefront_data_to_database_update(self, db_session, sample_game_data):
        """Test updating existing storefront data in database."""
        collector = SteamStoreCollector()
        
        # Create a game first
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create initial storefront data
        initial_data = StorefrontData(
            app_id=123456,
            short_description="Initial description",
            is_free=False,
            fetch_status=FetchStatus.SUCCESS.value
        )
        db_session.add(initial_data)
        db_session.commit()
        
        # Update with new data
        updated_data = StorefrontData(
            app_id=123456,
            short_description="Updated description",
            is_free=True,
            fetch_status=FetchStatus.SUCCESS.value,
            fetch_attempts=1
        )
        
        result = await collector.save_storefront_data_to_database([updated_data], db_session)
        
        assert result['new_storefront_data'] == 0
        assert result['updated_storefront_data'] == 1
        
        # Verify the data was actually updated
        saved_data = db_session.query(StorefrontData).filter_by(app_id=123456).first()
        assert saved_data.short_description == "Updated description"
        assert saved_data.is_free == True

    @pytest.mark.asyncio
    async def test_collect_storefront_data_for_games(self, db_session, sample_game_data):
        """Test collecting storefront data for a list of games."""
        collector = SteamStoreCollector()
        
        # Create games
        games = []
        for i in range(3):
            game_data = sample_game_data.copy()
            game_data['app_id'] = 123456 + i
            game_data['name'] = f"Test Game {i}"
            game = Game(**game_data)
            games.append(game)
            db_session.add(game)
        db_session.commit()
        
        # Mock successful API responses
        def mock_fetch_data(app_id):
            return StorefrontData(
                app_id=app_id,
                short_description=f"Description for game {app_id}",
                is_free=False,
                fetch_status=FetchStatus.SUCCESS.value
            )
        
        with patch.object(collector, 'fetch_storefront_data', side_effect=mock_fetch_data):
            progress_calls = []
            
            def progress_callback(current, total, game_name, status):
                progress_calls.append((current, total, game_name, status))
            
            result = await collector.collect_storefront_data_for_games(
                games, db_session, progress_callback=progress_callback
            )
            
            assert result['total_games_processed'] == 3
            assert result['successful_fetches'] == 3
            assert result['failed_fetches'] == 0
            assert result['not_found'] == 0
            
            # Verify progress callback was called
            assert len(progress_calls) == 3
            assert progress_calls[0] == (1, 3, "Test Game 0", FetchStatus.SUCCESS.value)
            assert progress_calls[1] == (2, 3, "Test Game 1", FetchStatus.SUCCESS.value)
            assert progress_calls[2] == (3, 3, "Test Game 2", FetchStatus.SUCCESS.value)