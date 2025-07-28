# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Endless Gaming backend is a production-ready Flask API for Steam game data collection and discovery. Built with Poetry, it provides robust data collection from Steam and SteamSpy APIs, plus a discovery API serving game data to frontend applications. Designed for large-scale data collection (30k+ games) with proper rate limiting, error handling, caching, and comprehensive testing.

## Technology Stack

- **Python 3.12+** with Poetry for dependency management
- **Flask** with application factory pattern for API endpoints
- **Flask-Caching** for server-side caching with 24-hour TTL
- **Flask-CORS** for cross-origin resource sharing
- **SQLAlchemy 2.0** with proper relationships and migrations
- **HTTPX + aiolimiter** for async HTTP requests with rate limiting
- **Pydantic Settings** for configuration management
- **PostgreSQL** (psycopg2-binary) or SQLite for database
- **Tenacity** for retry logic with exponential backoff
- **pytest + pytest-asyncio** for comprehensive testing (148 tests)

## Development Commands

### Environment Setup
```bash
poetry install                   # Install dependencies
poetry shell                     # Activate virtual environment
```

### Testing (TDD Approach)
```bash
poetry run pytest                          # Run all 148 tests
poetry run pytest tests/test_models.py     # Run specific test file
poetry run pytest tests/test_rate_limiter.py     # Rate limiter tests
poetry run pytest tests/test_steam_collector.py  # Steam collector tests
poetry run pytest tests/test_steamspy_collector.py # SteamSpy collector tests
poetry run pytest tests/test_steamspy_all_collector.py # SteamSpy /all collector tests
poetry run pytest tests/test_parallel_fetcher.py # Parallel processing tests
poetry run pytest tests/test_discovery_api.py # Discovery API tests
poetry run pytest -v                       # Verbose output
poetry run pytest -k "test_name"          # Run specific test
```

### Flask API Development
```bash
export FLASK_APP=app:create_app         # Set Flask app factory
export FLASK_ENV=development            # Enable debug mode
poetry run flask run                     # Start development server (http://localhost:5000)
poetry run flask run --host=0.0.0.0     # Allow external connections
poetry run flask shell                   # Interactive shell with app context
```

### Data Collection
```bash
# Main data collection CLI with interleaved processing (page -> metadata -> page)
poetry run python scripts/collect_games.py collect                      # Collect games by popularity + metadata
poetry run python scripts/collect_games.py collect --max-pages 5        # Limit to first 5 pages (5000 games)
poetry run python scripts/collect_games.py collect --update-metadata    # Update metadata only for existing games
poetry run python scripts/collect_games.py collect --batch-size 1000    # Override batch size (default: 1000)
poetry run python scripts/collect_games.py status                       # Show database statistics
poetry run python scripts/setup_db.py                                   # Initialize/manage database

# Export master.json data (same as /discovery/games/master.json endpoint)
poetry run python scripts/export_master_json.py master.json
```

### Database Management
```bash
# Alembic migrations
alembic upgrade head                    # Apply all migrations
alembic revision --autogenerate -m "description"  # Create new migration
alembic downgrade -1                   # Rollback one migration
```

## Architecture Overview

### Core Components

```
app/                 # Flask application (production-ready)
├── __init__.py      # Application factory with Flask-Caching/CORS setup
├── config.py        # Configuration classes (dev/test/prod)
├── discovery/       # Discovery API blueprint
└── steam/           # Steam API blueprint

models/               # SQLAlchemy models with full relationships
├── game.py          # Game model (app_id, name, timestamps, active status)
├── game_metadata.py # GameMetadata model (SteamSpy data, fetch status)
└── storefront_data.py # StorefrontData model (Steam Store API data)

collectors/          # Data collection classes (production-ready)
├── steam_collector.py         # SteamGameListCollector - legacy Steam API approach
├── steam_store_collector.py   # SteamStoreCollector - Steam Store API data
├── steamspy_all_collector.py  # SteamSpyAllCollector - popularity-based game collection
└── steamspy_collector.py      # SteamSpyMetadataCollector - fetches individual metadata

workers/             # Parallel processing system
└── parallel_fetcher.py    # ParallelMetadataFetcher - hybrid batch+queue approach

scripts/             # CLI interfaces with rich progress display
├── collect_games.py       # Main data collection CLI
├── setup_db.py           # Database management CLI
└── export_master_json.py # Export master.json data to file

utils/               # Core utilities (robust implementations)
├── rate_limiter.py  # SimpleRateLimiter with aiolimiter integration
├── http_client.py   # HTTPClient with tenacity retry logic
└── steam_api_client.py # Steam API client wrapper

tests/               # Comprehensive test suite (148 tests total)
```

### Key Design Patterns

**Rate Limiting Strategy**: Uses `aiolimiter.AsyncLimiter` with endpoint-specific limits:
- Steam Web API: 100,000/day (legacy, requires `STEAM_API_KEY` environment variable)
- Steam Store API: 200/5 minutes (legacy)
- SteamSpy API: 60/minute (for individual metadata calls)
- SteamSpy /all API: 1/minute (primary collection method, returns 1000 games per page)

**Data Flow Architecture (Interleaved Processing)**: 
1. `SteamSpyAllCollector.fetch_games_page()` - fetches single page of 1000 games from SteamSpy /all
2. `SteamSpyAllCollector.save_games_to_database()` - saves games immediately with upsert logic
3. `SteamSpyMetadataCollector.collect_metadata_for_games()` - fetches metadata for games from that page
4. Each game's metadata is saved individually and displayed immediately: "✅ <gamename> (<top 3 tags>)"
5. Process repeats for next page (interleaved: page → metadata → page → metadata)

**Flask API Architecture**: Application factory pattern with blueprint organization:
- `create_app()` factory function for testability and configuration flexibility
- Flask-Caching with 24-hour TTL for `/games/master.json` endpoint
- Flask-CORS for cross-origin requests from Angular frontend
- Discovery blueprint at `/discovery` prefix for game data endpoints
- Database session management via app context and request teardown
- Environment-specific configurations (development/testing/production)

### Database Models (SQLAlchemy 2.0)

**Game Model** (`models/game.py`):
- Primary key: `app_id` (Steam application ID)
- Core fields: `name`, `is_active`, `created_at`, `updated_at`  
- Relationships: `game_metadata` (one-to-one), `storefront_data` (one-to-one)

**GameMetadata Model** (`models/game_metadata.py`):
- Foreign key: `app_id` → Game
- SteamSpy data: `developer`, `publisher`, `owners_estimate`, reviews, playtime, etc.
- Status tracking: `fetch_status` (pending/success/failed/not_found), `fetch_attempts`
- JSON field: `tags_json` for SteamSpy tag data

**StorefrontData Model** (`models/storefront_data.py`):
- Foreign key: `app_id` → Game
- Steam Store API data: pricing, screenshots, movies, detailed descriptions

## Critical Implementation Details

### SteamSpy All Collector (Primary Collection Method)
The `SteamSpyAllCollector` uses SteamSpy's `/all` endpoint to fetch games in popularity order:
```python
from collectors.steamspy_all_collector import SteamSpyAllCollector

collector = SteamSpyAllCollector()
result = await collector.collect_and_save_games(
    session, 
    max_pages=5,  # Fetch first 5000 games (5 pages × 1000 games)
    progress_callback=my_callback
)
```

**Key Features**:
- Returns games sorted by popularity (owner count)
- 1000 games per page with automatic pagination
- Rate limited to 1 request per minute for /all endpoint
- Upsert logic: creates new games, updates existing, deactivates missing
- Returns statistics: `{'new_games': N, 'updated_games': N, 'deactivated_games': N, 'total_games_processed': N, 'pages_processed': N}`

### Rate Limiter Integration
All collectors use the shared `SimpleRateLimiter` instance with `APIEndpoint` enum:
```python
from utils.rate_limiter import SimpleRateLimiter, APIEndpoint
rate_limiter = SimpleRateLimiter()
await rate_limiter.make_request(APIEndpoint.STEAMSPY_ALL_API, url)  # 1/minute
await rate_limiter.make_request(APIEndpoint.STEAMSPY_API, url)      # 60/minute
```

### Database Session Management
Both collectors expect a SQLAlchemy session to be passed in:
```python
collector = SteamSpyMetadataCollector()
await collector.collect_metadata_for_games(games, session)
```

### Discovery API (Flask Backend)
The Discovery API provides cached game data endpoints for frontend applications:

```python
from app import create_app

app = create_app()
# GET /discovery/games/master.json - returns all active games with metadata
# Cached for 24 hours, includes tags, reviews, pricing, etc.
```

**Key Features**:
- **Caching**: 24-hour server-side cache via Flask-Caching
- **CORS**: Configured for cross-origin requests from Angular frontend  
- **Error Handling**: Graceful database error handling with 503 responses
- **Session Management**: Proper SQLAlchemy session lifecycle management
- **Game Records**: Converts database models to camelCase JSON for frontend consumption

**API Endpoints**:
- `GET /discovery/games/master.json` - All active games with full metadata
- `GET /steam/player/<steam_id>/games` - Player's game library and playtime data
- Cache headers: `Cache-Control: public, max-age=86400` 
- Response format: Array of game records with `appId`, `name`, `tags`, `price`, etc.

## Testing Philosophy

**TDD Approach**: All components built test-first focusing on happy path and critical failures
**Integration Focus**: Tests emphasize real-world scenarios and API integration patterns
**Pragmatic Testing**: Focus on obvious/critical error conditions that provide clear value
**Database Testing**: In-memory SQLite with proper foreign key constraints enabled

### IMPORTANT: TDD Workflow Requirements

This codebase was built using strict Test-Driven Development. When adding new features or components, you MUST follow this exact workflow:

**Step 1: Write Failing Tests First**
- Create test cases that define the expected behavior (focus on happy path)
- Include tests for obvious/critical error conditions that provide clear value
- Ensure tests fail for the right reasons (not due to import errors or syntax issues)

**Step 2: Implement to Make Tests Pass**
- Write the minimal implementation needed to make ALL tests pass
- Follow existing patterns and architectural decisions
- Ensure the implementation is production-ready, not just test-passing

**Never implement code without failing tests first.** This ensures appropriate test coverage for core functionality and validates that tests actually verify the intended behavior.

## Configuration Requirements

### Environment Variables for Production:
- `STEAM_API_KEY`: Optional, only needed for legacy Steam Web API access
- `DATABASE_URL`: SQLAlchemy connection string (defaults to SQLite)
- `SECRET_KEY`: Flask secret key for sessions (defaults to dev key)
- `FLASK_ENV`: Set to `production` for production deployment
- `CORS_ORIGINS`: Comma-separated list of allowed origins (defaults to `*`)
- `CACHE_TYPE`: Cache backend type (`SimpleCache`, `RedisCache`, etc.)
- `REDIS_URL`: Redis connection string when using RedisCache

### Flask Configuration Classes:
- **DevelopmentConfig**: Debug enabled, SimpleCache, SQLite database
- **TestingConfig**: In-memory SQLite, NullCache, CSRF disabled
- **ProductionConfig**: Debug disabled, configurable cache backends

**Note**: The primary collection method now uses SteamSpy's `/all` endpoint, so `STEAM_API_KEY` is no longer required for standard operations.

## Interleaved Collection Architecture

The main CLI implements an interleaved collection pattern optimized for user experience:

```python
async def collect_interleaved(session, max_pages=None, batch_size=1000, max_concurrent=3):
    """
    Interleaved collection: page -> metadata -> page -> metadata
    
    1. Fetch page 1 from SteamSpy /all (1000 games, popularity order)
    2. Immediately collect metadata for all 1000 games
    3. Each game saved and displayed as: "✅ GameName (Tag1, Tag2, Tag3)"
    4. Fetch page 2 and repeat
    
    This provides immediate feedback and ensures games are available
    in the database as soon as they're processed.
    """
```

**Benefits**:
- Real-time progress visibility
- Immediate data availability
- Better error recovery (partial collections still useful)
- Optimal user experience during long-running operations