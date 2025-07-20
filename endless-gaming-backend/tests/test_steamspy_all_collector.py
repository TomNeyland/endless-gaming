"""
Tests for SteamSpy All collector functionality.
"""
import asyncio
import pytest
from unittest.mock import Mock, AsyncMock, patch
from sqlalchemy.orm import Session

from collectors.steamspy_all_collector import SteamSpyAllCollector
from models.game import Game
from utils.rate_limiter import SimpleRateLimiter, APIEndpoint


class TestSteamSpyAllCollector:
    """Test the SteamSpyAllCollector class."""
    
    def test_collector_initialization(self):
        """Test that SteamSpyAllCollector initializes correctly."""
        collector = SteamSpyAllCollector()
        
        assert collector.rate_limiter is not None
        assert isinstance(collector.rate_limiter, SimpleRateLimiter)
        assert collector.logger is not None
    
    def test_build_steamspy_all_url(self):
        """Test URL building for SteamSpy /all endpoint."""
        collector = SteamSpyAllCollector()
        
        # Test page 0
        url = collector.build_steamspy_all_url(0)
        expected = "https://steamspy.com/api.php?request=all&page=0"
        assert url == expected
        
        # Test page 5
        url = collector.build_steamspy_all_url(5)
        expected = "https://steamspy.com/api.php?request=all&page=5"
        assert url == expected
    
    @pytest.mark.asyncio
    async def test_fetch_games_page_success(self):
        """Test successful fetching of a games page."""
        collector = SteamSpyAllCollector()
        
        # Mock response data (simplified)
        mock_response = {
            "730": {
                "appid": 730,
                "name": "Counter-Strike: Global Offensive",
                "developer": "Valve",
                "publisher": "Valve",
                "owners": "100,000,000 .. 200,000,000",
                "price": "0"
            },
            "440": {
                "appid": 440,
                "name": "Team Fortress 2",
                "developer": "Valve",
                "publisher": "Valve", 
                "owners": "50,000,000 .. 100,000,000",
                "price": "0"
            }
        }
        
        with patch.object(collector.rate_limiter, 'make_request', 
                         new_callable=AsyncMock) as mock_request:
            mock_request.return_value = mock_response
            
            result = await collector.fetch_games_page(0)
            
            assert result == mock_response
            mock_request.assert_called_once_with(
                APIEndpoint.STEAMSPY_ALL_API,
                "https://steamspy.com/api.php?request=all&page=0"
            )
    
    @pytest.mark.asyncio
    async def test_fetch_games_page_api_error(self):
        """Test handling of API errors when fetching games page."""
        collector = SteamSpyAllCollector()
        
        with patch.object(collector.rate_limiter, 'make_request', 
                         new_callable=AsyncMock) as mock_request:
            mock_request.side_effect = Exception("API Error")
            
            with pytest.raises(Exception, match="API Error"):
                await collector.fetch_games_page(0)
    
    def test_parse_all_response_success(self):
        """Test parsing of SteamSpy /all response into Game objects."""
        collector = SteamSpyAllCollector()
        
        response_data = {
            "730": {
                "appid": 730,
                "name": "Counter-Strike: Global Offensive",
                "developer": "Valve",
                "publisher": "Valve",
                "owners": "100,000,000 .. 200,000,000"
            },
            "440": {
                "appid": 440,
                "name": "Team Fortress 2",
                "developer": "Valve",
                "publisher": "Valve", 
                "owners": "50,000,000 .. 100,000,000"
            }
        }
        
        games = collector.parse_all_response(response_data)
        
        assert len(games) == 2
        
        # Check first game
        game1 = games[0]
        assert game1.app_id == 730
        assert game1.name == "Counter-Strike: Global Offensive"
        assert game1.is_active == True
        
        # Check second game
        game2 = games[1]
        assert game2.app_id == 440
        assert game2.name == "Team Fortress 2"
        assert game2.is_active == True
    
    def test_parse_all_response_empty(self):
        """Test parsing of empty response."""
        collector = SteamSpyAllCollector()
        
        games = collector.parse_all_response({})
        assert games == []
    
    def test_parse_all_response_invalid_data(self):
        """Test parsing response with invalid/missing data."""
        collector = SteamSpyAllCollector()
        
        response_data = {
            "123": {
                "appid": 123,
                # Missing name
                "developer": "Test Dev"
            },
            "456": {
                # Missing appid
                "name": "Test Game",
                "developer": "Test Dev"
            },
            "789": {
                "appid": 789,
                "name": "Valid Game",
                "developer": "Test Dev"
            }
        }
        
        games = collector.parse_all_response(response_data)
        
        # Should only get the valid game
        assert len(games) == 1
        assert games[0].app_id == 789
        assert games[0].name == "Valid Game"
    
    @pytest.mark.asyncio
    async def test_save_games_to_database_new_games(self, db_session):
        """Test saving new games to database."""
        collector = SteamSpyAllCollector()
        
        games = [
            Game(app_id=1, name="Game 1"),
            Game(app_id=2, name="Game 2")
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
        collector = SteamSpyAllCollector()
        
        # Create existing game
        existing_game = Game(app_id=1, name="Old Name", is_active=True)
        db_session.add(existing_game)
        db_session.commit()
        
        # Update with new name
        games = [Game(app_id=1, name="New Name")]
        
        result = await collector.save_games_to_database(games, db_session)
        
        assert result['new_games'] == 0
        assert result['updated_games'] == 1
        assert result['deactivated_games'] == 0
        
        # Verify game was updated
        updated_game = db_session.query(Game).filter(Game.app_id == 1).first()
        assert updated_game.name == "New Name"
    
    @pytest.mark.asyncio 
    async def test_save_games_to_database_deactivate_missing(self, db_session):
        """Test deactivating games not in current response."""
        collector = SteamSpyAllCollector()
        
        # Create existing games
        game1 = Game(app_id=1, name="Game 1", is_active=True)
        game2 = Game(app_id=2, name="Game 2", is_active=True)
        db_session.add_all([game1, game2])
        db_session.commit()
        
        # Only provide game 1 in new response
        games = [Game(app_id=1, name="Game 1")]
        
        result = await collector.save_games_to_database(games, db_session, deactivate_missing=True)
        
        assert result['new_games'] == 0
        assert result['updated_games'] == 1  # Game 1 updated
        assert result['deactivated_games'] == 1  # Game 2 deactivated
        
        # Verify game 2 was deactivated
        game2_updated = db_session.query(Game).filter(Game.app_id == 2).first()
        assert game2_updated.is_active == False
    
    @pytest.mark.asyncio
    async def test_collect_and_save_games_single_page(self, db_session):
        """Test complete collection workflow for single page."""
        collector = SteamSpyAllCollector()
        
        mock_response = {
            "730": {
                "appid": 730,
                "name": "Counter-Strike: Global Offensive",
                "developer": "Valve",
                "publisher": "Valve",
                "owners": "100,000,000 .. 200,000,000"
            }
        }
        
        with patch.object(collector, 'fetch_games_page', 
                         new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            result = await collector.collect_and_save_games(db_session, max_pages=1)
            
            assert result['total_games_processed'] == 1
            assert result['new_games'] == 1
            assert result['pages_processed'] == 1
            
            mock_fetch.assert_called_once_with(0)
    
    @pytest.mark.asyncio
    async def test_collect_and_save_games_multiple_pages(self, db_session):
        """Test collection workflow for multiple pages."""
        collector = SteamSpyAllCollector()
        
        # Mock different responses for different pages
        responses = [
            {"730": {"appid": 730, "name": "CS:GO", "developer": "Valve"}},
            {"440": {"appid": 440, "name": "TF2", "developer": "Valve"}},
            {}  # Empty response (end of data)
        ]
        
        with patch.object(collector, 'fetch_games_page',
                         new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = responses
            
            result = await collector.collect_and_save_games(db_session, max_pages=3)
            
            assert result['total_games_processed'] == 2
            assert result['new_games'] == 2
            assert result['pages_processed'] == 3
            
            # Should have called fetch for pages 0, 1, 2
            assert mock_fetch.call_count == 3
    
    @pytest.mark.asyncio
    async def test_collect_and_save_games_with_progress_callback(self, db_session):
        """Test collection with progress callback."""
        collector = SteamSpyAllCollector()
        progress_calls = []
        
        def progress_callback(page, total_pages, games_in_page, status):
            progress_calls.append((page, total_pages, games_in_page, status))
        
        mock_response = {
            "730": {"appid": 730, "name": "CS:GO", "developer": "Valve"}
        }
        
        with patch.object(collector, 'fetch_games_page',
                         new_callable=AsyncMock) as mock_fetch:
            mock_fetch.return_value = mock_response
            
            await collector.collect_and_save_games(
                db_session, 
                max_pages=1, 
                progress_callback=progress_callback
            )
            
            assert len(progress_calls) == 1
            assert progress_calls[0] == (0, 1, 1, "success")
    
    @pytest.mark.asyncio
    async def test_rate_limiting_integration(self):
        """Test that rate limiting is properly applied."""
        collector = SteamSpyAllCollector()
        
        with patch.object(collector.rate_limiter, 'make_request',
                         new_callable=AsyncMock) as mock_request:
            mock_request.return_value = {}
            
            await collector.fetch_games_page(0)
            
            # Verify correct endpoint was used
            mock_request.assert_called_with(
                APIEndpoint.STEAMSPY_ALL_API,
                "https://steamspy.com/api.php?request=all&page=0"
            )
    
    @pytest.mark.asyncio
    async def test_pagination_stops_on_empty_response(self, db_session):
        """Test that pagination stops when empty response is received."""
        collector = SteamSpyAllCollector()
        
        responses = [
            {"730": {"appid": 730, "name": "CS:GO", "developer": "Valve"}},
            {}  # Empty response should stop pagination
        ]
        
        with patch.object(collector, 'fetch_games_page',
                         new_callable=AsyncMock) as mock_fetch:
            mock_fetch.side_effect = responses
            
            result = await collector.collect_and_save_games(db_session, max_pages=10)
            
            # Should only call pages 0 and 1, then stop
            assert mock_fetch.call_count == 2
            assert result['pages_processed'] == 2
            assert result['total_games_processed'] == 1
    
    def test_collector_handles_malformed_response(self):
        """Test collector gracefully handles malformed API responses."""
        collector = SteamSpyAllCollector()
        
        # Test with various malformed data
        malformed_responses = [
            None,
            "not a dict",
            {"invalid": "structure"},
            {"123": None},  # None game data
            {"456": "not a dict"}  # String instead of dict
        ]
        
        for response in malformed_responses:
            # Should not raise exception
            games = collector.parse_all_response(response)
            assert isinstance(games, list)
            assert len(games) == 0


@pytest.fixture
def sample_steamspy_all_response():
    """Sample SteamSpy /all response for testing."""
    return {
        "730": {
            "appid": 730,
            "name": "Counter-Strike: Global Offensive",
            "developer": "Valve",
            "publisher": "Valve",
            "score_rank": "",
            "positive": 7642084,
            "negative": 1173003,
            "userscore": 0,
            "owners": "100,000,000 .. 200,000,000",
            "average_forever": 31199,
            "average_2weeks": 793,
            "median_forever": 5245,
            "median_2weeks": 312,
            "price": "0",
            "initialprice": "0",
            "discount": "0",
            "ccu": 1013936
        },
        "440": {
            "appid": 440,
            "name": "Team Fortress 2",
            "developer": "Valve",
            "publisher": "Valve",
            "score_rank": "",
            "positive": 668053,
            "negative": 326926,
            "userscore": 0,
            "owners": "50,000,000 .. 100,000,000",
            "average_forever": 9778,
            "average_2weeks": 741,
            "median_forever": 715,
            "median_2weeks": 272,
            "price": "0",
            "initialprice": "0",
            "discount": "0",
            "ccu": 124262
        }
    }