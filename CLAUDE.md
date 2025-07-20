# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Python system for collecting comprehensive game data from Steam and SteamSpy APIs, storing it in a database, and maintaining it through scheduled updates. Built with Poetry for dependency management and designed for hobby use with simple deployment.

## Technology Stack

- **Python 3.12+** with Poetry for dependency management
- **SQLAlchemy 2.0** with Alembic for database migrations
- **HTTPX** for async HTTP requests
- **Pydantic Settings** for configuration management
- **PostgreSQL** (psycopg2-binary) or SQLite for database
- **Typer** for CLI interface with Rich for progress bars
- **pytest** with pytest-asyncio for testing

## Development Commands

### Environment Setup
```bash
poetry install                    # Install dependencies
poetry shell                     # Activate virtual environment
```

### Database Operations
```bash
python scripts/setup_db.py       # Initialize database and run migrations
alembic upgrade head             # Run database migrations
alembic revision --autogenerate  # Generate new migration
```

### Data Collection
```bash
python scripts/collect_games.py                    # Collect all game data
python scripts/collect_games.py --full-refresh     # Rebuild entire database
python scripts/collect_games.py --update-metadata  # Update metadata only
python scripts/collect_games.py --batch-size 100   # Override batch size
```

### Testing
```bash
pytest                          # Run all tests
pytest tests/test_models.py     # Run specific test file
pytest -v                       # Verbose output
pytest -k "test_name"          # Run specific test
```

## Architecture Overview

### Core Components Structure
```
models/               # SQLAlchemy models (Game, GameMetadata)
collectors/           # Data collection classes (Steam, SteamSpy APIs)
utils/               # Rate limiter, HTTP client utilities
workers/             # Parallel processing for metadata fetching
scripts/             # CLI scripts for data collection and setup
migrations/          # Alembic database migrations
```

### Key Design Patterns

**Rate Limiting Strategy**: Multi-API rate limiter with different limits per endpoint:
- Steam Web API: 100,000/day
- Steam Store API: 200/5 minutes  
- SteamSpy API: 60/minute

**Data Flow**: Steam game list → Individual SteamSpy metadata calls → Database storage with batch processing

**Concurrency**: Hybrid batch + queue approach - process in batches for progress tracking, but queue all tasks within each batch for efficiency

### Database Models

**Game**: Core game information (app_id, name, timestamps, is_active flag)
**GameMetadata**: Extended SteamSpy data (reviews, playtime, pricing, tags as JSON, fetch status tracking)

### API Integration

The system handles ~23,000 individual API calls to SteamSpy (6+ hours at rate limits). Uses shared rate limiter across async workers with automatic throttling - requests block until rate limit allows, ensuring all calls eventually succeed.

### Error Handling

- Network errors: 3 retries with exponential backoff
- Rate limits: Automatic throttling via rate limiter
- Missing data: Log and skip, continue processing
- Batch failures: Rollback failed batches, continue with next

## Configuration

Uses `pydantic-settings` with environment variables. Key settings:
- `DATABASE_URL`: Database connection string
- API rate limits, worker counts, batch sizes
- Retry attempts and logging levels

## Testing Approach

Light TDD focusing on integration points and core workflows:
- Rate limiter + HTTP client integration
- Data model validation and relationships  
- API response parsing and data normalization
- Parallel processing with mixed success/failure
- End-to-end collection workflow

Uses `factory-boy` for test data generation and pytest fixtures for shared setup.