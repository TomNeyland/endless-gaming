import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from datetime import datetime
import httpx

from collectors.steam_collector import SteamGameListCollector
from models.game import Game
from utils.rate_limiter import APIEndpoint
from tests.conftest import sample_game_data


class TestSteamGameListCollector:
    """Test cases for SteamGameListCollector class."""

    def test_collector_initialization(self):
        """Test that collector initializes correctly."""
        collector = SteamGameListCollector()
        assert collector is not None
        assert hasattr(collector, 'rate_limiter')
        assert hasattr(collector, 'api_key')

    def test_collector_requires_api_key(self):
        """Test that collector requires Steam API key."""
        collector = SteamGameListCollector()
        
        # Should have api_key attribute (even if None initially)
        assert hasattr(collector, 'api_key')
        
    def test_build_steam_api_url(self):
        """Test Steam API URL construction."""
        collector = SteamGameListCollector(api_key="test_key_123")
        
        url = collector.build_steam_api_url()
        
        assert "https://api.steampowered.com/ISteamApps/GetAppList/v2/" in url
        assert "key=test_key_123" in url
        assert "format=json" in url

    @pytest.mark.asyncio
    async def test_fetch_steam_game_list_success(self):
        """Test successful fetching of Steam game list."""
        collector = SteamGameListCollector(api_key="test_key")
        
        # Mock successful API response
        mock_response_data = {
            "applist": {
                "apps": [
                    {"appid": 10, "name": "Counter-Strike"},
                    {"appid": 20, "name": "Team Fortress Classic"},
                    {"appid": 30, "name": "Day of Defeat"}
                ]
            }
        }
        
        with patch.object(collector.rate_limiter, 'make_request', return_value=mock_response_data) as mock_request:
            games = await collector.fetch_steam_game_list()
            
            assert len(games) == 3
            assert games[0]['appid'] == 10
            assert games[0]['name'] == "Counter-Strike"
            assert games[1]['appid'] == 20
            assert games[2]['appid'] == 30
            
            # Verify rate limiter was called with correct endpoint
            mock_request.assert_called_once()
            call_args = mock_request.call_args
            assert call_args[0][0] == APIEndpoint.STEAM_WEB_API

    @pytest.mark.asyncio
    async def test_fetch_steam_game_list_api_error(self):
        """Test handling of API errors during game list fetch."""
        collector = SteamGameListCollector(api_key="test_key")
        
        # Mock API error
        with patch.object(collector.rate_limiter, 'make_request', side_effect=httpx.HTTPError("API Error")) as mock_request:
            with pytest.raises(httpx.HTTPError):
                await collector.fetch_steam_game_list()

    @pytest.mark.asyncio
    async def test_fetch_steam_game_list_invalid_response(self):
        """Test handling of invalid API response structure."""
        collector = SteamGameListCollector(api_key="test_key")
        
        # Mock invalid response (missing expected structure)
        mock_invalid_response = {"error": "Invalid response"}
        
        with patch.object(collector.rate_limiter, 'make_request', return_value=mock_invalid_response):
            with pytest.raises(KeyError):
                await collector.fetch_steam_game_list()

    def test_parse_game_data(self):
        """Test parsing raw Steam API game data into Game objects."""
        collector = SteamGameListCollector()
        
        raw_games = [
            {"appid": 10, "name": "Counter-Strike"},
            {"appid": 20, "name": "Team Fortress Classic"},
            {"appid": 30, "name": "Day of Defeat"}
        ]
        
        parsed_games = collector.parse_game_data(raw_games)
        
        assert len(parsed_games) == 3
        assert all(isinstance(game, Game) for game in parsed_games)
        assert parsed_games[0].app_id == 10
        assert parsed_games[0].name == "Counter-Strike"
        assert parsed_games[1].app_id == 20
        assert parsed_games[2].app_id == 30

    def test_parse_game_data_filters_invalid_entries(self):
        """Test that parsing filters out invalid game entries."""
        collector = SteamGameListCollector()
        
        raw_games = [
            {"appid": 10, "name": "Counter-Strike"},
            {"appid": 20},  # Missing name
            {"name": "No App ID"},  # Missing appid
            {"appid": 30, "name": "Day of Defeat"},
            {"appid": "invalid", "name": "Invalid ID"},  # Non-numeric appid
        ]
        
        parsed_games = collector.parse_game_data(raw_games)
        
        # Should only have 2 valid games
        assert len(parsed_games) == 2
        assert parsed_games[0].app_id == 10
        assert parsed_games[1].app_id == 30

    @pytest.mark.asyncio
    async def test_save_games_to_database_new_games(self, db_session):
        """Test saving new games to database."""
        collector = SteamGameListCollector()
        
        games = [
            Game(app_id=10, name="Counter-Strike"),
            Game(app_id=20, name="Team Fortress Classic"),
        ]
        
        result = await collector.save_games_to_database(games, db_session)
        
        assert result['new_games'] == 2
        assert result['updated_games'] == 0
        assert result['deactivated_games'] == 0
        
        # Verify games were saved
        saved_games = db_session.query(Game).all()
        assert len(saved_games) == 2

    @pytest.mark.asyncio
    async def test_save_games_to_database_update_existing(self, db_session):
        """Test updating existing games in database."""
        collector = SteamGameListCollector()
        
        # Create existing game
        existing_game = Game(app_id=10, name="Counter-Strike Old")
        db_session.add(existing_game)
        db_session.commit()
        
        # Update with new name
        games = [Game(app_id=10, name="Counter-Strike New")]
        
        result = await collector.save_games_to_database(games, db_session)
        
        assert result['new_games'] == 0
        assert result['updated_games'] == 1
        assert result['deactivated_games'] == 0
        
        # Verify name was updated
        updated_game = db_session.query(Game).filter_by(app_id=10).first()
        assert updated_game.name == "Counter-Strike New"

    @pytest.mark.asyncio
    async def test_save_games_to_database_deactivate_missing(self, db_session):
        """Test deactivating games that are no longer in Steam API."""
        collector = SteamGameListCollector()
        
        # Create existing games
        game1 = Game(app_id=10, name="Counter-Strike", is_active=True)
        game2 = Game(app_id=20, name="Team Fortress Classic", is_active=True)
        game3 = Game(app_id=30, name="Day of Defeat", is_active=True)
        db_session.add_all([game1, game2, game3])
        db_session.commit()
        
        # Only provide games 10 and 20 (game 30 should be deactivated)
        games = [
            Game(app_id=10, name="Counter-Strike"),
            Game(app_id=20, name="Team Fortress Classic"),
        ]
        
        result = await collector.save_games_to_database(games, db_session)
        
        assert result['new_games'] == 0
        assert result['updated_games'] == 2  # Names refreshed
        assert result['deactivated_games'] == 1  # Game 30 deactivated
        
        # Verify game 30 was deactivated
        deactivated_game = db_session.query(Game).filter_by(app_id=30).first()
        assert deactivated_game.is_active is False

    @pytest.mark.asyncio
    async def test_collect_and_save_games_full_workflow(self, db_session):
        """Test the complete workflow of collecting and saving games."""
        collector = SteamGameListCollector(api_key="test_key")
        
        # Mock Steam API response
        mock_response_data = {
            "applist": {
                "apps": [
                    {"appid": 10, "name": "Counter-Strike"},
                    {"appid": 20, "name": "Team Fortress Classic"},
                ]
            }
        }
        
        with patch.object(collector.rate_limiter, 'make_request', return_value=mock_response_data):
            result = await collector.collect_and_save_games(db_session)
            
            assert result['total_games_processed'] == 2
            assert result['new_games'] == 2
            assert result['updated_games'] == 0
            assert result['deactivated_games'] == 0
            
            # Verify games were saved to database
            saved_games = db_session.query(Game).all()
            assert len(saved_games) == 2

    @pytest.mark.asyncio
    async def test_collect_and_save_games_with_existing_data(self, db_session):
        """Test collecting games when database already has data."""
        collector = SteamGameListCollector(api_key="test_key")
        
        # Create existing game that will be updated
        existing_game = Game(app_id=10, name="Counter-Strike Old", is_active=True)
        # Create existing game that will be deactivated
        old_game = Game(app_id=999, name="Removed Game", is_active=True)
        db_session.add_all([existing_game, old_game])
        db_session.commit()
        
        # Mock Steam API response with updated data
        mock_response_data = {
            "applist": {
                "apps": [
                    {"appid": 10, "name": "Counter-Strike"},  # Updated name
                    {"appid": 20, "name": "Team Fortress Classic"},  # New game
                    # Note: game 999 is missing, should be deactivated
                ]
            }
        }
        
        with patch.object(collector.rate_limiter, 'make_request', return_value=mock_response_data):
            result = await collector.collect_and_save_games(db_session)
            
            assert result['total_games_processed'] == 2
            assert result['new_games'] == 1  # Game 20
            assert result['updated_games'] == 1  # Game 10 name updated
            assert result['deactivated_games'] == 1  # Game 999 deactivated

    def test_collector_handles_missing_api_key(self):
        """Test collector behavior when API key is not provided."""
        collector = SteamGameListCollector()  # No API key
        
        # Should still initialize, but build_steam_api_url should handle missing key
        assert collector.api_key is None
        
        with pytest.raises((ValueError, TypeError)):
            collector.build_steam_api_url()

    @pytest.mark.asyncio
    async def test_collector_rate_limiting_integration(self):
        """Test that collector properly integrates with rate limiter."""
        collector = SteamGameListCollector(api_key="test_key")
        
        # Mock the rate limiter to verify it's called correctly
        with patch.object(collector.rate_limiter, 'make_request') as mock_request:
            mock_request.return_value = {"applist": {"apps": []}}
            
            await collector.fetch_steam_game_list()
            
            # Verify rate limiter was called with Steam Web API endpoint
            mock_request.assert_called_once()
            args, kwargs = mock_request.call_args
            assert args[0] == APIEndpoint.STEAM_WEB_API

    def test_collector_logging_integration(self):
        """Test that collector integrates with logging system."""
        collector = SteamGameListCollector()
        
        # Should have logger attribute
        assert hasattr(collector, 'logger')
        assert collector.logger is not None