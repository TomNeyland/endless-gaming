import pytest
from datetime import datetime
from sqlalchemy.exc import IntegrityError

from models.game import Game
from models.game_metadata import GameMetadata, FetchStatus


class TestGameModel:
    """Test cases for the Game model."""

    def test_create_game(self, db_session, sample_game_data):
        """Test creating a new game record."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        assert game.app_id == 123456
        assert game.name == "Test Game"
        assert game.is_active is True
        assert isinstance(game.created_at, datetime)
        assert isinstance(game.updated_at, datetime)

    def test_game_app_id_primary_key(self, db_session, sample_game_data):
        """Test that app_id is the primary key and must be unique."""
        game1 = Game(**sample_game_data)
        db_session.add(game1)
        db_session.commit()
        
        # Try to create another game with the same app_id
        game2 = Game(**sample_game_data)
        db_session.add(game2)
        
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_game_name_required(self, db_session):
        """Test that name is required."""
        game = Game(app_id=123456)  # Missing name
        db_session.add(game)
        
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_game_default_active_status(self, db_session, sample_game_data):
        """Test that games are active by default."""
        game = Game(**sample_game_data)
        assert game.is_active is True

    def test_game_timestamps_auto_populate(self, db_session, sample_game_data):
        """Test that timestamps are automatically populated."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        assert game.created_at is not None
        assert game.updated_at is not None
        assert game.created_at == game.updated_at

    def test_game_updated_at_changes(self, db_session, sample_game_data):
        """Test that updated_at changes when game is modified."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        original_updated = game.updated_at
        
        # Update the game
        game.name = "Updated Game Name"
        db_session.commit()
        
        assert game.updated_at > original_updated


class TestGameMetadataModel:
    """Test cases for the GameMetadata model."""

    def test_create_game_metadata(self, db_session, sample_game_data, sample_metadata_data):
        """Test creating game metadata."""
        # First create a game
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create metadata
        metadata = GameMetadata(**sample_metadata_data)
        db_session.add(metadata)
        db_session.commit()
        
        assert metadata.app_id == 123456
        assert metadata.developer == "Test Developer"
        assert metadata.publisher == "Test Publisher"
        assert metadata.owners_estimate == "1,000,000 .. 2,000,000"
        assert metadata.positive_reviews == 1500
        assert metadata.negative_reviews == 200
        assert metadata.fetch_status == FetchStatus.SUCCESS

    def test_metadata_foreign_key_constraint(self, db_session, sample_metadata_data):
        """Test that metadata requires a valid game to exist."""
        # Try to create metadata without corresponding game
        metadata = GameMetadata(**sample_metadata_data)
        db_session.add(metadata)
        
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_metadata_json_field(self, db_session, sample_game_data, sample_metadata_data):
        """Test that tags_json field handles JSON data correctly."""
        # Create game first
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create metadata with JSON tags
        metadata = GameMetadata(**sample_metadata_data)
        db_session.add(metadata)
        db_session.commit()
        
        # Verify JSON data is stored and retrieved correctly
        assert metadata.tags_json == {"action": 100, "adventure": 80, "indie": 60}

    def test_fetch_status_enum(self, db_session, sample_game_data):
        """Test FetchStatus enum values."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Test all enum values
        for status in [FetchStatus.PENDING, FetchStatus.SUCCESS, FetchStatus.FAILED, FetchStatus.NOT_FOUND]:
            metadata = GameMetadata(
                app_id=123456,
                fetch_status=status,
                fetch_attempts=1
            )
            db_session.add(metadata)
            db_session.commit()
            
            # Clean up for next iteration
            db_session.delete(metadata)
            db_session.commit()

    def test_metadata_default_values(self, db_session, sample_game_data):
        """Test default values for metadata fields."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create minimal metadata
        metadata = GameMetadata(app_id=123456)
        db_session.add(metadata)
        db_session.commit()
        
        assert metadata.fetch_attempts == 0
        assert metadata.fetch_status == FetchStatus.PENDING
        assert isinstance(metadata.last_updated, datetime)

    def test_game_metadata_relationship(self, db_session, sample_game_data, sample_metadata_data):
        """Test the relationship between Game and GameMetadata."""
        # Create game
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create metadata
        metadata = GameMetadata(**sample_metadata_data)
        db_session.add(metadata)
        db_session.commit()
        
        # Test relationship
        assert game.metadata is not None
        assert game.metadata.app_id == game.app_id
        assert metadata.game == game


class TestFetchStatusEnum:
    """Test cases for FetchStatus enum."""

    def test_fetch_status_values(self):
        """Test that FetchStatus enum has expected values."""
        assert FetchStatus.PENDING == "pending"
        assert FetchStatus.SUCCESS == "success"
        assert FetchStatus.FAILED == "failed"
        assert FetchStatus.NOT_FOUND == "not_found"

    def test_fetch_status_from_string(self):
        """Test creating FetchStatus from string values."""
        assert FetchStatus("pending") == FetchStatus.PENDING
        assert FetchStatus("success") == FetchStatus.SUCCESS
        assert FetchStatus("failed") == FetchStatus.FAILED
        assert FetchStatus("not_found") == FetchStatus.NOT_FOUND