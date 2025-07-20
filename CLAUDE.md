# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready Python system for collecting comprehensive game data from Steam and SteamSpy APIs, storing it in a database, and maintaining it through scheduled updates. Built with Poetry for dependency management and designed for large-scale data collection (23k+ games) with proper rate limiting and error handling.

## Technology Stack

- **Python 3.12+** with Poetry for dependency management
- **SQLAlchemy 2.0** with proper relationships and migrations
- **HTTPX + aiolimiter** for async HTTP requests with rate limiting
- **Pydantic Settings** for configuration management
- **PostgreSQL** (psycopg2-binary) or SQLite for database
- **Tenacity** for retry logic with exponential backoff
- **pytest + pytest-asyncio** for comprehensive testing (62 tests)

## Development Commands

### Environment Setup
```bash
poetry install                    # Install dependencies
poetry shell                     # Activate virtual environment
```

### Testing (TDD Approach)
```bash
poetry run pytest                          # Run all 62 tests
poetry run pytest tests/test_models.py     # Run specific test file (14 tests)
poetry run pytest tests/test_rate_limiter.py     # Rate limiter tests (14 tests)
poetry run pytest tests/test_steam_collector.py  # Steam collector tests (16 tests)
poetry run pytest tests/test_steamspy_collector.py # SteamSpy collector tests (18 tests)
poetry run pytest -v                       # Verbose output
poetry run pytest -k "test_name"          # Run specific test
```

### Data Collection (When CLI is implemented)
```bash
# These commands are planned but CLI scripts not yet implemented
python scripts/collect_games.py                    # Collect all game data
python scripts/collect_games.py --full-refresh     # Rebuild entire database
python scripts/collect_games.py --update-metadata  # Update metadata only
python scripts/collect_games.py --batch-size 100   # Override batch size
```

## Architecture Overview

### Core Components (All Implemented)
```
models/               # SQLAlchemy models with full relationships
├── game.py          # Game model (app_id, name, timestamps, active status)
└── game_metadata.py # GameMetadata model (SteamSpy data, fetch status)

collectors/          # Data collection classes (production-ready)
├── steam_collector.py     # SteamGameListCollector - fetches game lists
└── steamspy_collector.py  # SteamSpyMetadataCollector - fetches individual metadata

utils/               # Core utilities (robust implementations)
├── rate_limiter.py  # SimpleRateLimiter with aiolimiter integration
└── http_client.py   # HTTPClient with tenacity retry logic

tests/               # Comprehensive test suite (62 tests total)
├── test_models.py          # Database model tests (14 tests)
├── test_rate_limiter.py    # Rate limiting tests (14 tests) 
├── test_steam_collector.py # Steam API tests (16 tests)
└── test_steamspy_collector.py # SteamSpy API tests (18 tests)
```

### Key Design Patterns (Production Implementation)

**Rate Limiting Strategy**: Uses `aiolimiter.AsyncLimiter` with endpoint-specific limits:
- Steam Web API: 100,000/day (requires `STEAM_API_KEY` environment variable)
- Steam Store API: 200/5 minutes  
- SteamSpy API: 60/minute (most restrictive - handles 23k+ calls over ~6.4 hours)

**Data Flow Architecture**: 
1. `SteamGameListCollector.collect_and_save_games()` - fetches complete game list from Steam
2. `SteamSpyMetadataCollector.collect_metadata_for_games()` - fetches individual metadata for each game
3. Database operations use upsert logic (create new, update existing, deactivate missing)

**Concurrency Pattern**: Hybrid batch + asyncio.gather approach:
- Process games in configurable batches (default 50) for progress tracking
- Within each batch, use `asyncio.gather()` for concurrent API calls
- Rate limiter automatically throttles requests across all concurrent workers

### Database Models (SQLAlchemy 2.0)

**Game Model** (`models/game.py`):
- Primary key: `app_id` (Steam application ID)
- Core fields: `name`, `is_active`, `created_at`, `updated_at`  
- Relationship: `game_metadata` (one-to-one with GameMetadata)

**GameMetadata Model** (`models/game_metadata.py`):
- Foreign key: `app_id` → Game
- SteamSpy data: `developer`, `publisher`, `owners_estimate`, reviews, playtime, etc.
- Status tracking: `fetch_status` (pending/success/failed/not_found), `fetch_attempts`
- JSON field: `tags_json` for SteamSpy tag data

### Error Handling Strategy

**Network Level**: `HTTPClient` with tenacity retry (3 attempts, exponential backoff)
**Rate Limiting**: Automatic throttling via `AsyncLimiter` - requests block until allowed
**Data Validation**: Robust parsing with graceful handling of missing/invalid fields
**Status Tracking**: Each metadata fetch tracked with success/failure status for monitoring

## Critical Implementation Details

### Rate Limiter Integration
All collectors use the shared `SimpleRateLimiter` instance with `APIEndpoint` enum:
```python
from utils.rate_limiter import SimpleRateLimiter, APIEndpoint
rate_limiter = SimpleRateLimiter()
await rate_limiter.make_request(APIEndpoint.STEAMSPY_API, url)
```

### Database Session Management
Both collectors expect a SQLAlchemy session to be passed in:
```python
collector = SteamSpyMetadataCollector()
await collector.collect_metadata_for_games(games, session)
```

### Price Conversion Logic
SteamSpy returns prices in cents - automatic conversion to dollar strings:
- `"0"` → `"Free"`
- `"1999"` → `"19.99"`  
- `""` or `None` → `None`

### Progress Tracking
`SteamSpyMetadataCollector` supports optional progress callbacks:
```python
def progress_callback(current, total, status):
    print(f"Progress: {current}/{total} - Status: {status}")

await collector.collect_metadata_for_games(games, session, progress_callback=progress_callback)
```

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
- Commit these failing tests with a descriptive message like:
  ```
  Add failing tests for [ComponentName]
  
  - Test [specific behavior 1]
  - Test [specific behavior 2] 
  - Test [critical error condition if applicable]
  - All tests currently fail as expected (implementation pending)
  ```

**Step 2: Implement to Make Tests Pass**
- Write the minimal implementation needed to make ALL tests pass
- Follow existing patterns and architectural decisions
- Ensure the implementation is production-ready, not just test-passing
- Commit the working implementation with a message like:
  ```
  Implement [ComponentName], all tests passing
  
  - [Brief description of key functionality]
  - [Integration points or architectural notes]
  - All [X] tests passing with [brief validation note]
  ```

**Never implement code without failing tests first.** This ensures appropriate test coverage for core functionality and validates that tests actually verify the intended behavior. Focus on testing what matters, not exhaustive edge case coverage.

## Configuration Requirements

Set environment variables for production:
- `STEAM_API_KEY`: Required for Steam Web API access
- `DATABASE_URL`: SQLAlchemy connection string (defaults to SQLite)

All other settings have sensible defaults via `config.py` with pydantic-settings.