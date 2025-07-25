import pytest
import pytest_asyncio
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from models import Base


@pytest.fixture(scope="function")
def db_engine():
    """Create an in-memory SQLite database for testing."""
    engine = create_engine(
        "sqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    
    # Enable foreign key constraints in SQLite
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture(scope="function")
def db_session(db_engine):
    """Create a database session for testing."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def sample_game_data():
    """Sample game data for testing."""
    return {
        "app_id": 123456,
        "name": "Test Game",
    }


@pytest.fixture
def sample_metadata_data():
    """Sample metadata data for testing."""
    return {
        "app_id": 123456,
        "developer": "Test Developer",
        "publisher": "Test Publisher",
        "owners_estimate": "1,000,000 .. 2,000,000",
        "positive_reviews": 1500,
        "negative_reviews": 200,
        "score_rank": 85,
        "average_playtime_forever": 120,
        "average_playtime_2weeks": 30,
        "price": "$19.99",
        "genre": "Action",
        "languages": "English, Spanish, French",
        "tags_json": {"action": 100, "adventure": 80, "indie": 60},
        "fetch_attempts": 1,
        "fetch_status": "success",
    }


@pytest.fixture
def sample_storefront_data():
    """Sample storefront data for testing."""
    return {
        "app_id": 123456,
        "short_description": "A test game description",
        "detailed_description": "This is a detailed description of the test game with lots of information about gameplay and features.",
        "is_free": False,
        "required_age": 0,
        "website": "https://testgame.example.com",
        "header_image": "https://cdn.akamai.steamstatic.com/steam/apps/123456/header.jpg",
        "release_date": "2024-01-15",
        "developers": ["Test Developer Inc"],
        "publishers": ["Test Publisher Corp"],
        "genres": [{"id": "1", "description": "Action"}],
        "categories": [{"id": "2", "description": "Single-player"}],
        "supported_languages": "English<strong>*</strong>, Spanish, French<br><strong>*</strong>languages with full audio support",
        "price_overview": {"currency": "USD", "initial": 1999, "final": 1999, "discount_percent": 0},
        "pc_requirements": {"minimum": "Windows 10", "recommended": "Windows 11"},
        "fetch_attempts": 1,
        "fetch_status": "success",
    }