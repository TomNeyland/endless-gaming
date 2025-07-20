"""
Tests for the Discovery API endpoints.

These tests follow TDD principles - they are written first and should fail
until the actual implementation is complete.
"""
import pytest
import json
from unittest.mock import patch, MagicMock
from flask import Flask
from sqlalchemy.exc import DatabaseError

from app import create_app
from app.config import TestingConfig
from models.game import Game
from models.game_metadata import GameMetadata, FetchStatus


class TestFlaskAppFactory:
    """Test the Flask application factory pattern."""

    def test_create_app_returns_flask_instance(self):
        """Test that create_app returns a Flask application instance."""
        app = create_app('testing')
        assert isinstance(app, Flask)
        assert app.config['TESTING'] is True

    def test_discovery_blueprint_registered(self):
        """Test that discovery blueprint is registered with the app."""
        app = create_app('testing')
        
        # Check that the blueprint is registered
        blueprint_names = [bp.name for bp in app.blueprints.values()]
        assert 'discovery' in blueprint_names

    def test_discovery_routes_accessible(self):
        """Test that discovery routes are accessible."""
        app = create_app('testing')
        
        with app.test_client() as client:
            # This should return a response (even if it's an error)
            # We're testing routing, not implementation
            response = client.get('/discovery/games/master.json')
            assert response is not None


class TestMasterJsonEndpoint:
    """Test the GET /discovery/games/master.json endpoint."""

    @pytest.fixture
    def client(self, db_engine):
        """Create test client with test database."""
        app = create_app('testing')
        # Override the app's database engine with the test engine
        app.db_engine = db_engine
        from sqlalchemy.orm import sessionmaker
        app.db_session_factory = sessionmaker(bind=db_engine)
        return app.test_client()

    @pytest.fixture
    def sample_games_with_metadata(self, db_session):
        """Create sample games with metadata for testing."""
        # Create active game with metadata
        game1 = Game(app_id=730, name="Counter-Strike: Global Offensive", is_active=True)
        metadata1 = GameMetadata(
            app_id=730,
            developer="Valve",
            publisher="Valve",
            owners_estimate="50,000,000 .. 100,000,000",
            positive_reviews=1000000,
            negative_reviews=100000,
            price="Free",
            genre="Action",
            tags_json={"FPS": 91172, "Shooter": 65634, "Multiplayer": 45123},
            fetch_status=FetchStatus.SUCCESS.value
        )
        
        # Create inactive game (should be excluded)
        game2 = Game(app_id=570, name="Dota 2", is_active=False)
        metadata2 = GameMetadata(
            app_id=570,
            developer="Valve",
            publisher="Valve",
            positive_reviews=500000,
            negative_reviews=50000,
            fetch_status=FetchStatus.SUCCESS.value
        )
        
        # Create active game with metadata (TF2)
        game3 = Game(app_id=440, name="Team Fortress 2", is_active=True)
        metadata3 = GameMetadata(
            app_id=440,
            developer="Valve",
            publisher="Valve",
            price="Free",
            positive_reviews=750000,
            negative_reviews=75000,
            fetch_status=FetchStatus.SUCCESS.value
        )
        
        db_session.add_all([game1, game2, game3, metadata1, metadata2, metadata3])
        db_session.commit()
        
        return [game1, game2, game3]

    def test_endpoint_returns_200_status(self, client):
        """Test that the endpoint returns 200 status code."""
        # This test will initially fail due to NotImplementedError
        response = client.get('/discovery/games/master.json')
        # We expect this to eventually return 200, but will fail initially
        # This is intentional for TDD
        assert response.status_code == 200

    def test_response_is_valid_json_array(self, client, sample_games_with_metadata):
        """Test that response is a valid JSON array."""
        response = client.get('/discovery/games/master.json')
        
        # Should return valid JSON
        data = json.loads(response.data)
        assert isinstance(data, list)

    def test_only_active_games_included(self, client, sample_games_with_metadata):
        """Test that only active games are included in response."""
        response = client.get('/discovery/games/master.json')
        data = json.loads(response.data)
        
        # Should only include active games with metadata (CS:GO and TF2, not Dota 2)
        app_ids = [game['appId'] for game in data]
        assert 730 in app_ids  # CS:GO (active, has metadata)
        assert 440 in app_ids  # TF2 (active, has metadata)
        assert 570 not in app_ids  # Dota 2 (inactive)

    def test_game_record_format_camel_case(self, client, sample_games_with_metadata):
        """Test that game records use camelCase field names."""
        response = client.get('/discovery/games/master.json')
        data = json.loads(response.data)
        
        if data:  # If we have games
            game = data[0]
            # Check camelCase field names
            assert 'appId' in game
            assert 'name' in game
            assert 'coverUrl' in game
            assert 'reviewPos' in game
            assert 'reviewNeg' in game
            # Check that snake_case fields are NOT present
            assert 'app_id' not in game
            assert 'positive_reviews' not in game

    def test_tags_format_correct(self, client, sample_games_with_metadata):
        """Test that tags are formatted correctly as object with vote counts."""
        response = client.get('/discovery/games/master.json')
        data = json.loads(response.data)
        
        # Find CS:GO which has tags
        csgo = next((g for g in data if g['appId'] == 730), None)
        if csgo:
            assert 'tags' in csgo
            assert isinstance(csgo['tags'], dict)
            # Should have tag names as keys and vote counts as values
            assert 'FPS' in csgo['tags']
            assert isinstance(csgo['tags']['FPS'], int)

    def test_price_formatting(self, client, sample_games_with_metadata):
        """Test that price is formatted correctly."""
        response = client.get('/discovery/games/master.json')
        data = json.loads(response.data)
        
        # Find CS:GO which should be "Free"
        csgo = next((g for g in data if g['appId'] == 730), None)
        if csgo:
            assert csgo['price'] == "Free"

    def test_database_error_returns_503(self, client):
        """Test that database errors return 503 status."""
        # This will test error handling once implemented
        # For now, will fail due to NotImplementedError
        response = client.get('/discovery/games/master.json')
        # Implementation should catch DB errors and return 503
        # Initially will fail with 500 due to NotImplementedError

    def test_caching_behavior(self, client):
        """Test that responses are cached correctly."""
        # This will test caching behavior once implemented
        # First request
        response1 = client.get('/discovery/games/master.json')
        
        # Second request should use cache
        response2 = client.get('/discovery/games/master.json')
        
        # In development/testing, caching may be disabled
        # This test validates the caching setup works when enabled

    def test_cache_headers_present(self, client):
        """Test that appropriate cache headers are set."""
        response = client.get('/discovery/games/master.json')
        
        # Should have cache control headers for browser caching
        # Implementation will add these headers


class TestGameRecordConversion:
    """Test the game record conversion utility function."""

    def test_to_game_record_with_full_metadata(self, db_session):
        """Test converting game with full metadata to record format."""
        from app.discovery.utils import to_game_record
        
        # Create test game with metadata
        game = Game(app_id=730, name="Counter-Strike: Global Offensive", is_active=True)
        metadata = GameMetadata(
            app_id=730,
            developer="Valve",
            publisher="Valve",
            price="Free",
            tags_json={"FPS": 91172, "Shooter": 65634},
            positive_reviews=1000000,
            negative_reviews=100000,
            fetch_status=FetchStatus.SUCCESS.value
        )
        
        db_session.add_all([game, metadata])
        db_session.commit()
        
        # This will initially fail due to NotImplementedError
        # Once implemented, should convert properly
        record = to_game_record(game)
        
        assert record['appId'] == 730
        assert record['name'] == "Counter-Strike: Global Offensive"
        assert record['developer'] == "Valve"
        assert record['price'] == "Free"
        assert isinstance(record['tags'], dict)

    def test_to_game_record_without_metadata(self, db_session):
        """Test converting game without metadata to record format."""
        from app.discovery.utils import to_game_record
        
        # Create game without metadata
        game = Game(app_id=440, name="Team Fortress 2", is_active=True)
        db_session.add(game)
        db_session.commit()
        
        record = to_game_record(game)
        
        assert record['appId'] == 440
        assert record['name'] == "Team Fortress 2"
        # Fields without metadata should be None or empty
        assert record['developer'] is None
        assert record['tags'] == {}

    def test_price_conversion_free(self):
        """Test that price '0' converts to 'Free'."""
        # Will test price conversion logic once implemented
        pass

    def test_price_conversion_paid(self):
        """Test that price in cents converts to dollar format."""
        # Will test price conversion logic once implemented
        pass