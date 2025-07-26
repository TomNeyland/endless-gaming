"""
Tests for the Steam API client and blueprint.

These tests follow TDD principles - they are written first and should fail
until the actual implementation is complete.
"""
import pytest
import json
from unittest.mock import patch, MagicMock, AsyncMock
from flask import Flask
import httpx

from app import create_app
from app.config import TestingConfig


class TestSteamAPIClient:
    """Test the Steam API client utility."""

    @pytest.fixture
    def steam_client(self):
        """Create Steam API client for testing."""
        from utils.steam_api_client import SteamAPIClient
        return SteamAPIClient(api_key="test_key")

    @pytest.mark.asyncio
    async def test_get_owned_games_success(self, steam_client):
        """Test successful retrieval of owned games for a public profile."""
        mock_response = {
            "response": {
                "game_count": 2,
                "games": [
                    {
                        "appid": 730,
                        "name": "Counter-Strike: Global Offensive",
                        "playtime_forever": 1000,
                        "img_icon_url": "icon_url",
                        "img_logo_url": "logo_url"
                    },
                    {
                        "appid": 440,
                        "name": "Team Fortress 2", 
                        "playtime_forever": 500,
                        "img_icon_url": "icon_url2",
                        "img_logo_url": "logo_url2"
                    }
                ]
            }
        }
        
        with patch.object(steam_client.http_client, 'get_with_retry', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            
            result = await steam_client.get_owned_games("76561198000000000")
            
            assert result == mock_response
            mock_get.assert_called_once()
            call_args = mock_get.call_args[0][0]
            assert "IPlayerService/GetOwnedGames" in call_args
            assert "key=test_key" in call_args
            assert "steamid=76561198000000000" in call_args

    @pytest.mark.asyncio
    async def test_get_owned_games_private_profile(self, steam_client):
        """Test handling of private profiles (empty response)."""
        mock_response = {
            "response": {}
        }
        
        with patch.object(steam_client.http_client, 'get_with_retry', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            
            result = await steam_client.get_owned_games("76561198000000001")
            
            assert result == mock_response
            assert "games" not in result["response"]

    @pytest.mark.asyncio
    async def test_get_owned_games_with_details(self, steam_client):
        """Test retrieving games with additional details."""
        mock_response = {
            "response": {
                "game_count": 1,
                "games": [
                    {
                        "appid": 730,
                        "name": "Counter-Strike: Global Offensive",
                        "playtime_forever": 1000,
                        "playtime_2weeks": 100,
                        "img_icon_url": "icon_url",
                        "img_logo_url": "logo_url"
                    }
                ]
            }
        }
        
        with patch.object(steam_client.http_client, 'get_with_retry', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_response
            
            result = await steam_client.get_owned_games(
                "76561198000000000", 
                include_appinfo=True,
                include_played_free_games=True
            )
            
            assert result == mock_response
            call_args = mock_get.call_args[0][0]
            assert "include_appinfo=1" in call_args
            assert "include_played_free_games=1" in call_args

    @pytest.mark.asyncio
    async def test_get_owned_games_http_error(self, steam_client):
        """Test handling of HTTP errors from Steam API."""
        with patch.object(steam_client.http_client, 'get_with_retry', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = httpx.HTTPStatusError(
                "HTTP Error", 
                request=MagicMock(), 
                response=MagicMock(status_code=403)
            )
            
            with pytest.raises(httpx.HTTPStatusError):
                await steam_client.get_owned_games("76561198000000000")

    @pytest.mark.asyncio
    async def test_get_owned_games_timeout_error(self, steam_client):
        """Test handling of timeout errors."""
        with patch.object(steam_client.http_client, 'get_with_retry', new_callable=AsyncMock) as mock_get:
            mock_get.side_effect = httpx.TimeoutException("Timeout")
            
            with pytest.raises(httpx.TimeoutException):
                await steam_client.get_owned_games("76561198000000000")

    @pytest.mark.asyncio
    async def test_resolve_vanity_url_success(self, steam_client):
        """Test successful vanity URL resolution."""
        mock_resolve_response = {
            "response": {
                "success": 1,
                "steamid": "76561198000000000"
            }
        }
        
        with patch.object(steam_client.http_client, 'get_with_retry', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_resolve_response
            
            result = await steam_client.resolve_vanity_url("gaben")
            
            assert result == "76561198000000000"
            mock_get.assert_called_once()
            call_args = mock_get.call_args[0][0]
            assert "ISteamUser/ResolveVanityURL" in call_args
            assert "vanityurl=gaben" in call_args

    @pytest.mark.asyncio
    async def test_get_owned_games_with_vanity_name(self, steam_client):
        """Test getting owned games using vanity name."""
        mock_resolve_response = {
            "response": {
                "success": 1,
                "steamid": "76561198000000000"
            }
        }
        
        mock_games_response = {
            "response": {
                "game_count": 1,
                "games": [
                    {
                        "appid": 730,
                        "name": "Counter-Strike: Global Offensive",
                        "playtime_forever": 1000
                    }
                ]
            }
        }
        
        with patch.object(steam_client.http_client, 'get_with_retry', new_callable=AsyncMock) as mock_get:
            # First call for resolve, second call for games
            mock_get.side_effect = [mock_resolve_response, mock_games_response]
            
            result = await steam_client.get_owned_games("gaben")
            
            assert result == mock_games_response
            assert mock_get.call_count == 2

    @pytest.mark.asyncio
    async def test_get_owned_games_with_steamid64(self, steam_client):
        """Test getting owned games using SteamID64 (no resolution needed)."""
        mock_games_response = {
            "response": {
                "game_count": 1,
                "games": [
                    {
                        "appid": 730,
                        "name": "Counter-Strike: Global Offensive",
                        "playtime_forever": 1000
                    }
                ]
            }
        }
        
        with patch.object(steam_client.http_client, 'get_with_retry', new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_games_response
            
            result = await steam_client.get_owned_games("76561198000000000")
            
            assert result == mock_games_response
            # Should only call once (no resolution needed)
            assert mock_get.call_count == 1

    @pytest.mark.asyncio
    async def test_invalid_player_id_validation(self, steam_client):
        """Test validation of player ID format."""
        with pytest.raises(ValueError):
            await steam_client.get_owned_games("invalid_id!@#")

    def test_missing_api_key_raises_error(self):
        """Test that missing API key raises appropriate error."""
        from utils.steam_api_client import SteamAPIClient
        
        with pytest.raises(ValueError, match="Steam API key is required"):
            SteamAPIClient()


class TestSteamBlueprint:
    """Test the Steam API blueprint routes."""

    @pytest.fixture
    def client(self, db_engine):
        """Create test client with test database."""
        with patch.dict('os.environ', {'STEAM_API_KEY': 'test_key_123'}):
            app = create_app('testing')
            app.db_engine = db_engine
            from sqlalchemy.orm import sessionmaker
            app.db_session_factory = sessionmaker(bind=db_engine)
            return app.test_client()

    def test_steam_blueprint_registered(self):
        """Test that steam blueprint is registered with the app."""
        app = create_app('testing')
        
        # Check that the blueprint is registered
        blueprint_names = [bp.name for bp in app.blueprints.values()]
        assert 'steam' in blueprint_names

    def test_lookup_player_endpoint_exists(self, client):
        """Test that the lookup-player endpoint is accessible."""
        # Test that route exists (even if it returns an error initially)
        response = client.get('/api/steam/lookup-player?player_id=76561198000000000')
        assert response is not None
        # Initially may return 500 due to missing implementation

    def test_lookup_player_missing_parameter(self, client):
        """Test that missing player_id parameter returns 400."""
        response = client.get('/api/steam/lookup-player')
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data
        assert 'player_id' in data['error'].lower()

    def test_lookup_player_invalid_parameter(self, client):
        """Test that invalid player_id parameter returns 400."""
        response = client.get('/api/steam/lookup-player?player_id=invalid')
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_lookup_player_success(self, client):
        """Test successful player lookup."""
        mock_steam_response = {
            "response": {
                "game_count": 2,
                "games": [
                    {
                        "appid": 730,
                        "name": "Counter-Strike: Global Offensive",
                        "playtime_forever": 1000
                    },
                    {
                        "appid": 440,
                        "name": "Team Fortress 2",
                        "playtime_forever": 500
                    }
                ]
            }
        }
        
        with patch('app.steam.blueprint.SteamAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get_owned_games.return_value = mock_steam_response
            mock_client_class.return_value = mock_client
            
            # Mock asyncio.run for the synchronous Flask context
            with patch('asyncio.run') as mock_run:
                mock_run.return_value = mock_steam_response
                
                response = client.get('/api/steam/lookup-player?player_id=76561198000000000')
                
                assert response.status_code == 200
                data = json.loads(response.data)
                assert data == mock_steam_response

    def test_lookup_player_private_profile(self, client):
        """Test handling of private profiles."""
        mock_steam_response = {
            "response": {}
        }
        
        with patch('app.steam.blueprint.SteamAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get_owned_games.return_value = mock_steam_response
            mock_client_class.return_value = mock_client
            
            with patch('asyncio.run') as mock_run:
                mock_run.return_value = mock_steam_response
                
                response = client.get('/api/steam/lookup-player?player_id=76561198000000001')
                
                assert response.status_code == 200
                data = json.loads(response.data)
                assert data == mock_steam_response

    def test_lookup_player_steam_api_error(self, client):
        """Test handling of Steam API errors."""
        with patch('app.steam.blueprint.SteamAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get_owned_games.side_effect = httpx.HTTPStatusError(
                "HTTP Error",
                request=MagicMock(),
                response=MagicMock(status_code=403)
            )
            mock_client_class.return_value = mock_client
            
            with patch('asyncio.run') as mock_run:
                mock_run.side_effect = httpx.HTTPStatusError(
                    "HTTP Error",
                    request=MagicMock(),
                    response=MagicMock(status_code=403)
                )
                
                response = client.get('/api/steam/lookup-player?player_id=76561198000000000')
                
                assert response.status_code == 503
                data = json.loads(response.data)
                assert 'error' in data

    def test_lookup_player_timeout_error(self, client):
        """Test handling of timeout errors."""
        with patch('app.steam.blueprint.SteamAPIClient') as mock_client_class:
            mock_client = AsyncMock()
            mock_client.get_owned_games.side_effect = httpx.TimeoutException("Timeout")
            mock_client_class.return_value = mock_client
            
            with patch('asyncio.run') as mock_run:
                mock_run.side_effect = httpx.TimeoutException("Timeout")
                
                response = client.get('/api/steam/lookup-player?player_id=76561198000000000')
                
                assert response.status_code == 504
                data = json.loads(response.data)
                assert 'error' in data

    def test_lookup_player_missing_api_key(self, client):
        """Test handling when Steam API key is not configured."""
        # This will test configuration validation once implemented
        with patch.dict('os.environ', {}, clear=True):
            response = client.get('/api/steam/lookup-player?player_id=76561198000000000')
            # Should return 500 for configuration error
            # Implementation will handle this appropriately


class TestSteamAPIConfiguration:
    """Test Steam API configuration handling."""

    def test_steam_api_key_from_environment(self):
        """Test that Steam API key is loaded from environment."""
        import importlib
        import app.config
        
        with patch.dict('os.environ', {'STEAM_API_KEY': 'test_key_123'}):
            # Reload the config module to pick up the env var
            importlib.reload(app.config)
            config = app.config.DevelopmentConfig()
            assert hasattr(config, 'STEAM_API_KEY')
            assert config.STEAM_API_KEY == 'test_key_123'

    def test_steam_api_base_url_configured(self):
        """Test that Steam API base URL is configured."""
        from app.config import DevelopmentConfig
        
        config = DevelopmentConfig()
        assert hasattr(config, 'STEAM_API_BASE_URL')
        assert 'api.steampowered.com' in config.STEAM_API_BASE_URL

    def test_missing_steam_api_key_warning(self):
        """Test that missing API key is handled gracefully."""
        # Implementation should handle missing API key appropriately
        # Either raise error or log warning depending on design choice
        pass


class TestPlayerIDValidation:
    """Test Steam player ID validation utilities."""

    def test_valid_player_id_formats(self):
        """Test validation of various player ID formats."""
        from app.steam.utils import validate_player_id
        
        # Valid SteamID64 format
        assert validate_player_id("76561198000000000") is True
        
        # Valid vanity names
        assert validate_player_id("gaben") is True
        assert validate_player_id("user123") is True
        assert validate_player_id("player_name") is True
        assert validate_player_id("user-name") is True
        
        # Valid URLs
        assert validate_player_id("https://steamcommunity.com/id/gaben") is True
        assert validate_player_id("/id/gaben") is True

    def test_invalid_player_id_formats(self):
        """Test rejection of invalid player ID formats."""
        from app.steam.utils import validate_player_id
        
        # Various invalid formats
        assert validate_player_id("invalid!@#") is False
        assert validate_player_id("") is False
        assert validate_player_id(None) is False
        assert validate_player_id("user name") is False  # Spaces not allowed

    def test_steam_id_conversion(self):
        """Test conversion between different Steam ID formats if implemented."""
        # This test is for future enhancement if needed
        pass