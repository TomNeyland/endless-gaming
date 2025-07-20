# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Endless Gaming is a comprehensive Steam gaming platform with a production-ready data collection engine as its foundation. The current implementation focuses on collecting and processing game data from Steam and SteamSpy APIs, with future plans for game recommendation and discovery features. Built with Poetry for dependency management and designed for large-scale data collection (30k+ games) with proper rate limiting, error handling, and multiple deployment options.

## Project Structure

The project is organized with a clean separation between backend and frontend:

```
endless-gaming/
├── endless-gaming-backend/     # Python backend (current implementation)
│   ├── models/                 # SQLAlchemy database models
│   ├── collectors/             # Data collection components
│   ├── utils/                  # Shared utilities (rate limiter, HTTP client)
│   ├── workers/                # Parallel processing workers
│   ├── scripts/                # CLI scripts for data collection
│   ├── tests/                  # Comprehensive test suite (89 tests)
│   ├── alembic/                # Database migrations
│   ├── config.py               # Application configuration
│   ├── pyproject.toml          # Poetry dependency management
│   └── alembic.ini             # Alembic migration configuration
└── endless-gaming-frontend/    # Angular frontend (in development)
    ├── src/app/                # Angular application components
    ├── public/                 # Static assets
    ├── angular.json           # Angular CLI configuration
    ├── package.json           # NPM dependencies
    └── GAME_PICKER_SPEC.md    # Frontend UX specification
```

**Important**: All Python commands must be run from the `endless-gaming-backend/` directory.

## Technology Stack

- **Python 3.12+** with Poetry for dependency management
- **SQLAlchemy 2.0** with proper relationships and migrations
- **HTTPX + aiolimiter** for async HTTP requests with rate limiting
- **Pydantic Settings** for configuration management
- **PostgreSQL** (psycopg2-binary) or SQLite for database
- **Tenacity** for retry logic with exponential backoff
- **pytest + pytest-asyncio** for comprehensive testing (89 tests)

### Frontend Stack
- **Angular 20.1.0** (latest version with standalone components)
- **TypeScript 5.8.2** with strict configuration
- **SCSS** for component styling
- **RxJS** for reactive programming and state management
- **Angular Signals** for modern reactive state handling

## Development Commands

### Backend Environment Setup
```bash
cd endless-gaming-backend        # Navigate to backend directory
poetry install                   # Install dependencies
poetry shell                     # Activate virtual environment
```

### Frontend Environment Setup
```bash
cd endless-gaming-frontend       # Navigate to frontend directory
npm install                      # Install dependencies
```

### Backend Testing (TDD Approach)
```bash
cd endless-gaming-backend               # All backend commands from this directory
poetry run pytest                          # Run all 89 tests
poetry run pytest tests/test_models.py     # Run specific test file (14 tests)
poetry run pytest tests/test_rate_limiter.py     # Rate limiter tests (14 tests)
poetry run pytest tests/test_steam_collector.py  # Steam collector tests (16 tests)
poetry run pytest tests/test_steamspy_collector.py # SteamSpy collector tests (18 tests)
poetry run pytest tests/test_steamspy_all_collector.py # SteamSpy /all collector tests (16 tests)
poetry run pytest tests/test_parallel_fetcher.py # Parallel processing tests (11 tests)
poetry run pytest -v                       # Verbose output
poetry run pytest -k "test_name"          # Run specific test
```

### Frontend Development & Testing
```bash
cd endless-gaming-frontend              # All frontend commands from this directory
npm start                               # Start development server (http://localhost:4200)
npm run build                           # Build for production
npm test                                # Run unit tests with Karma
npm run watch                           # Build in watch mode for development
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

# Docker deployment
docker-compose run --rm endless-gaming python scripts/collect_games.py collect --max-pages 2

# DigitalOcean App Platform deployment (scheduled cron jobs)
doctl apps create --spec .do/app.yaml                          # Development environment
doctl apps create --spec .do/app-production.yaml              # Production environment
```

### Database Management
```bash
# Alembic migrations
alembic upgrade head                    # Apply all migrations
alembic revision --autogenerate -m "description"  # Create new migration
alembic downgrade -1                   # Rollback one migration

# Direct database operations
poetry run python -c "from models import Base; from sqlalchemy import create_engine; Base.metadata.create_all(create_engine('sqlite:///steam_games.db'))"
```

## Architecture Overview

### Core Components (All Implemented)
```
models/               # SQLAlchemy models with full relationships
├── game.py          # Game model (app_id, name, timestamps, active status)
└── game_metadata.py # GameMetadata model (SteamSpy data, fetch status)

collectors/          # Data collection classes (production-ready)
├── steam_collector.py         # SteamGameListCollector - legacy Steam API approach
├── steamspy_all_collector.py  # SteamSpyAllCollector - popularity-based game collection
└── steamspy_collector.py      # SteamSpyMetadataCollector - fetches individual metadata

workers/             # Parallel processing system
└── parallel_fetcher.py    # ParallelMetadataFetcher - hybrid batch+queue approach

scripts/             # CLI interfaces with rich progress display
├── collect_games.py       # Main data collection CLI
└── setup_db.py           # Database management CLI

utils/               # Core utilities (robust implementations)
├── rate_limiter.py  # SimpleRateLimiter with aiolimiter integration
└── http_client.py   # HTTPClient with tenacity retry logic

tests/               # Comprehensive test suite (89 tests total)
├── test_models.py                 # Database model tests (14 tests)
├── test_rate_limiter.py           # Rate limiting tests (14 tests) 
├── test_steam_collector.py        # Steam API tests (16 tests)
├── test_steamspy_collector.py     # SteamSpy API tests (18 tests)
├── test_steamspy_all_collector.py # SteamSpy /all API tests (16 tests)
└── test_parallel_fetcher.py       # Parallel processing tests (11 tests)
```

### Key Design Patterns (Production Implementation)

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

**Concurrency Pattern**: Hybrid batch + immediate save approach:
- Fetch games in pages of 1000 (matches SteamSpy page size)
- Within metadata collection, use `asyncio.gather()` for concurrent API calls
- Each game saved to database immediately after metadata fetch (not batched)
- Rate limiter automatically throttles requests across all concurrent workers
- Real-time progress display with game names and top 3 tags

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

### Price Conversion Logic
SteamSpy returns prices in cents - automatic conversion to dollar strings:
- `"0"` → `"Free"`
- `"1999"` → `"19.99"`  
- `""` or `None` → `None`

### Progress Tracking
`SteamSpyMetadataCollector` supports enhanced progress callbacks with game names and tags:
```python
def progress_callback(current, total, game_name, top_tags, status):
    tags_display = ", ".join(top_tags[:3]) if top_tags else "No tags"
    print(f"[{current}/{total}] {game_name} ({tags_display}) - {status}")

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

## Important Development Guidelines

**Code Quality Standards**:
- Follow existing code conventions and patterns in the codebase
- Mimic code style, use existing libraries and utilities
- **NEVER assume libraries are available** - check package.json/pyproject.toml first
- **NEVER include sensitive information** (API keys, tokens) in code or commits

## Configuration Requirements

Set environment variables for production:
- `STEAM_API_KEY`: Optional, only needed for legacy Steam Web API access
- `DATABASE_URL`: SQLAlchemy connection string (defaults to SQLite)

**Note**: The primary collection method now uses SteamSpy's `/all` endpoint, so `STEAM_API_KEY` is no longer required for standard operations.

All other settings have sensible defaults via `config.py` with pydantic-settings.

## Deployment Patterns

### Local Development
```bash
# Initialize database and collect sample data
poetry run python scripts/setup_db.py
poetry run python scripts/collect_games.py collect --max-pages 2

# Watch real-time progress
# Output: "Counter-Strike: Global Offensive (FPS, Shooter, Multiplayer)"
```

### Docker Deployment
```bash
# Build and run with docker-compose
docker-compose up --build
docker-compose run --rm endless-gaming python scripts/collect_games.py collect --max-pages 5

# Production with PostgreSQL
docker-compose --profile production up -d postgres
docker-compose run --rm endless-gaming python scripts/setup_db.py
docker-compose --profile production up endless-gaming
```

### DigitalOcean App Platform (Production)
The platform uses **scheduled cron jobs** for cost-effective data collection:

**Development Environment** (`.do/app.yaml`):
- Daily collection at 6 AM UTC: ~15,000 games (15 pages)
- Basic-xxs instances for cost optimization
- Managed PostgreSQL with automatic backups

**Production Environment** (`.do/app-production.yaml`):
- Daily collection at 2 AM UTC: ~30,000 games (30 pages)  
- Weekly maintenance checks on Sundays
- Larger instances (basic-s) for faster processing
- Enhanced database configuration

**Key Commands**:
```bash
# Deploy to DigitalOcean
doctl apps create --spec .do/app.yaml
doctl apps logs <APP_ID> --follow

# Monitor scheduled jobs
doctl apps logs <APP_ID> --type job
```

### CI/CD Integration
GitHub Actions provides comprehensive testing and deployment:

**Test Pipeline** (`.github/workflows/test.yml`):
- Matrix testing across Python versions
- Comprehensive test suite execution
- Coverage reporting

**CI/CD Pipeline** (`.github/workflows/ci.yml`):
- Linting with ruff (if available)
- Type checking with mypy (if available)
- Docker build verification
- Security scanning with bandit/safety
- Auto-deployment ready (commented sections for production)

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

## Frontend Architecture

### Angular Application Structure

The frontend is built with Angular 20.1.0 using modern patterns:

```
src/app/
├── app.ts              # Main component using Angular Signals
├── app.config.ts       # Application configuration (providers, routing)
├── app.routes.ts       # Route definitions
├── app.html           # Main template
└── [planned components based on GAME_PICKER_SPEC.md]
```

### Planned Game Picker Architecture

Based on `/endless-gaming-frontend/GAME_PICKER_SPEC.md`, the frontend will implement a MaxDiff-style game discovery system:

**Core UX Flow**:
1. **Pairwise Comparison** - Show two games, user picks preferred one or skips
2. **Preference Learning** - Each choice updates an internal preference model using Steam tags
3. **Live Feedback** - Real-time display of learned preferences (liked/disliked tags)
4. **Smart Recommendations** - Generate personalized top 100 game list

**Planned Service Architecture**:
```
services/
├── game-data.service.ts      # Load master.json, cache GameRecord data
├── vector.service.ts         # Tag normalization, sparse vector conversion
├── preference.service.ts     # Weight vector management, SGD updates
├── pair.service.ts           # Uncertainty sampling for game pairs
└── choice-api.service.ts     # Offline queue, analytics logging
```

**Data Flow**:
```
master.json (≈500KB) → IndexedDB → Sparse Vectors → Preference Model → Recommendations
```

**Key Technical Features**:
- **Client-side ML** - Logistic SGD for preference learning
- **Offline-first** - IndexedDB caching with offline choice queue
- **Performance** - Sparse vectors, priority queues for top-K games
- **Real-time updates** - Angular Signals for reactive preference display

### Frontend Development Notes

**Important**: Frontend commands must be run from the `endless-gaming-frontend/` directory.

**Modern Angular Patterns**:
- Uses **standalone components** (no NgModules)
- **Angular Signals** for reactive state management
- **SCSS** for component styling with Angular CLI optimization
- **TypeScript 5.8.2** with strict configuration

**Recommended Libraries** (from spec):
- **Dexie.js** - IndexedDB wrapper for offline data storage
- **fastpriorityqueue** - Efficient top-K game ranking
- **vectorious** - Typed-array vector operations for ML
```

## Testing and Test Updates

- Updating tests is acceptable if the updates still reflect testing the core implementation
- Tests should evolve with the implementation to maintain meaningful test coverage
- Focus on avoiding trivial tests that only serve to pass but do not provide substantive validation
- When updating tests, ensure they continue to verify critical functionality and edge cases
- Prioritize tests that validate the actual behavior and requirements of the component or feature
