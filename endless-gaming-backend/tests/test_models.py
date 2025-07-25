import pytest
from datetime import datetime
from sqlalchemy.exc import IntegrityError

from models.game import Game
from models.game_metadata import GameMetadata, FetchStatus
from models.storefront_data import StorefrontData


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
        db_session.add(game)
        db_session.commit()
        assert game.is_active is True

    def test_game_timestamps_auto_populate(self, db_session, sample_game_data):
        """Test that timestamps are automatically populated."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        assert game.created_at is not None
        assert game.updated_at is not None
        # Timestamps should be very close (within 1 second)
        time_diff = abs((game.updated_at - game.created_at).total_seconds())
        assert time_diff < 1.0

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
        assert metadata.fetch_status == FetchStatus.SUCCESS.value

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
                fetch_status=status.value,  # Use enum value
                fetch_attempts=1
            )
            db_session.add(metadata)
            db_session.commit()
            
            # Verify the status was stored correctly
            assert metadata.fetch_status == status.value
            
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
        assert metadata.fetch_status == FetchStatus.PENDING.value
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
        assert game.game_metadata is not None
        assert game.game_metadata.app_id == game.app_id
        assert metadata.game == game


class TestFetchStatusEnum:
    """Test cases for FetchStatus enum."""

    def test_fetch_status_values(self):
        """Test that FetchStatus enum has expected values."""
        assert FetchStatus.PENDING.value == "pending"
        assert FetchStatus.SUCCESS.value == "success"
        assert FetchStatus.FAILED.value == "failed"
        assert FetchStatus.NOT_FOUND.value == "not_found"

    def test_fetch_status_from_string(self):
        """Test creating FetchStatus from string values."""
        assert FetchStatus("pending") == FetchStatus.PENDING
        assert FetchStatus("success") == FetchStatus.SUCCESS
        assert FetchStatus("failed") == FetchStatus.FAILED
        assert FetchStatus("not_found") == FetchStatus.NOT_FOUND


class TestStorefrontDataModel:
    """Test cases for the StorefrontData model."""

    def test_create_storefront_data(self, db_session, sample_game_data, sample_storefront_data):
        """Test creating a new storefront data record."""
        # First create a game
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create storefront data
        storefront_data = StorefrontData(**sample_storefront_data)
        db_session.add(storefront_data)
        db_session.commit()
        
        assert storefront_data.app_id == 123456
        assert storefront_data.short_description == "A test game description"
        assert storefront_data.is_free is False
        assert storefront_data.required_age == 0
        assert isinstance(storefront_data.last_updated, datetime)

    def test_storefront_data_foreign_key_constraint(self, db_session, sample_storefront_data):
        """Test that storefront data requires a valid game to exist."""
        # Try to create storefront data without corresponding game
        storefront_data = StorefrontData(**sample_storefront_data)
        db_session.add(storefront_data)
        
        with pytest.raises(IntegrityError):
            db_session.commit()

    def test_storefront_data_json_fields(self, db_session, sample_game_data, sample_storefront_data):
        """Test that JSON fields handle complex data correctly."""
        # Create game first
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create storefront data with JSON fields
        storefront_data = StorefrontData(**sample_storefront_data)
        db_session.add(storefront_data)
        db_session.commit()
        
        # Verify JSON data is stored and retrieved correctly
        assert storefront_data.developers == ["Test Developer Inc"]
        assert storefront_data.publishers == ["Test Publisher Corp"]
        assert storefront_data.genres == [{"id": "1", "description": "Action"}]
        assert storefront_data.categories == [{"id": "2", "description": "Single-player"}]
        assert storefront_data.price_overview == {"currency": "USD", "initial": 1999, "final": 1999, "discount_percent": 0}
        assert storefront_data.pc_requirements == {"minimum": "Windows 10", "recommended": "Windows 11"}

    def test_storefront_data_fetch_status_enum(self, db_session, sample_game_data):
        """Test FetchStatus enum values for StorefrontData."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Test all enum values
        for status in [FetchStatus.PENDING, FetchStatus.SUCCESS, FetchStatus.FAILED, FetchStatus.NOT_FOUND]:
            storefront_data = StorefrontData(
                app_id=123456,
                fetch_status=status.value,
                fetch_attempts=1
            )
            db_session.add(storefront_data)
            db_session.commit()
            
            # Verify the status was stored correctly
            assert storefront_data.fetch_status == status.value
            
            # Clean up for next iteration
            db_session.delete(storefront_data)
            db_session.commit()

    def test_storefront_data_default_values(self, db_session, sample_game_data):
        """Test default values for storefront data fields."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create minimal storefront data
        storefront_data = StorefrontData(app_id=123456)
        db_session.add(storefront_data)
        db_session.commit()
        
        assert storefront_data.fetch_attempts == 0
        assert storefront_data.fetch_status == FetchStatus.PENDING.value
        assert isinstance(storefront_data.last_updated, datetime)

    def test_game_storefront_data_relationship(self, db_session, sample_game_data, sample_storefront_data):
        """Test the relationship between Game and StorefrontData."""
        # Create game
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create storefront data
        storefront_data = StorefrontData(**sample_storefront_data)
        db_session.add(storefront_data)
        db_session.commit()
        
        # Test relationship
        assert game.storefront_data is not None
        assert game.storefront_data.app_id == game.app_id
        assert storefront_data.game == game

    def test_storefront_data_price_free_game(self, db_session, sample_game_data):
        """Test handling of free games with no price_overview."""
        game = Game(**sample_game_data)
        db_session.add(game)
        db_session.commit()
        
        # Create storefront data for free game
        storefront_data = StorefrontData(
            app_id=123456,
            is_free=True,
            price_overview=None  # Free games have no price overview
        )
        db_session.add(storefront_data)
        db_session.commit()
        
        assert storefront_data.is_free is True
        assert storefront_data.price_overview is None