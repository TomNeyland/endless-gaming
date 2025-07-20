# Steam Data Collection System - Implementation Plan

## Phase 1: Project Foundation & Configuration

### 1.1 Environment & Configuration Setup
- [ ] Create `config.py` with pydantic-settings for environment-based configuration
- [ ] Create `.env.example` template with all required environment variables
- [ ] Set up logging configuration with configurable log levels
- [ ] Validate Poetry dependencies are correctly specified in pyproject.toml

### 1.2 Database Foundation
- [ ] Create `models/__init__.py` with SQLAlchemy setup and database configuration
- [ ] Set up Alembic for database migrations
- [ ] Create initial database connection and session management

## Phase 2: Core Data Models

### 2.1 Game Model
- [ ] Create `models/game.py` with Game model
  - [ ] `app_id` (Primary Key, Integer)
  - [ ] `name` (String)
  - [ ] `created_at` (DateTime)
  - [ ] `updated_at` (DateTime)
  - [ ] `is_active` (Boolean)

### 2.2 GameMetadata Model
- [ ] Create `models/game_metadata.py` with GameMetadata model
  - [ ] `app_id` (Foreign Key to Game)
  - [ ] `developer` (String)
  - [ ] `publisher` (String)
  - [ ] `owners_estimate` (String)
  - [ ] `positive_reviews` (Integer)
  - [ ] `negative_reviews` (Integer)
  - [ ] `score_rank` (Integer)
  - [ ] `average_playtime_forever` (Integer)
  - [ ] `average_playtime_2weeks` (Integer)
  - [ ] `price` (String)
  - [ ] `genre` (String)
  - [ ] `languages` (Text)
  - [ ] `tags_json` (JSON/Text)
  - [ ] `last_updated` (DateTime)
  - [ ] `fetch_attempts` (Integer)
  - [ ] `fetch_status` (Enum: 'pending', 'success', 'failed', 'not_found')

### 2.3 Database Migrations
- [ ] Generate initial Alembic migration for both models
- [ ] Create `scripts/setup_db.py` for database initialization
- [ ] Test database creation and model relationships

## Phase 3: Rate Limiting System

### 3.1 Rate Limiter Core
- [ ] Create `utils/rate_limiter.py` with APIEndpoint enum
  - [ ] `STEAM_WEB_API`: 100,000/day
  - [ ] `STEAM_STORE_API`: 200/5 minutes
  - [ ] `STEAMSPY_API`: 60/minute
- [ ] Implement SimpleRateLimiter class using `limits` library
- [ ] Add `throttle(endpoint)` method that blocks until rate limit allows
- [ ] Add `make_request(endpoint, url, **kwargs)` method with integrated HTTP calls

### 3.2 HTTP Client Integration
- [ ] Create `utils/http_client.py` with basic HTTP client
- [ ] Implement retry logic with exponential backoff
- [ ] Integrate rate limiter with HTTP client
- [ ] Add timeout and error handling

## Phase 4: Data Collection Components

### 4.1 Steam Game List Collector
- [ ] Create `collectors/__init__.py`
- [ ] Create `collectors/steam_collector.py` with SteamGameListCollector class
- [ ] Implement Steam API game list fetching
- [ ] Add logic to update existing games and add new ones
- [ ] Add logic to mark removed games as inactive
- [ ] Integrate with rate limiter for API calls

### 4.2 SteamSpy Metadata Collector
- [ ] Create `collectors/steamspy_collector.py` with SteamSpyMetadataCollector class
- [ ] Implement individual game metadata fetching from SteamSpy API
- [ ] Add data normalization from SteamSpy format to our models
- [ ] Implement retry logic for failed requests
- [ ] Add batch processing capabilities
- [ ] Integrate with rate limiter

## Phase 5: Parallel Processing System

### 5.1 Parallel Metadata Fetcher
- [ ] Create `workers/__init__.py`
- [ ] Create `workers/parallel_fetcher.py` with ParallelMetadataFetcher class
- [ ] Implement asyncio-based concurrent execution
- [ ] Add shared rate limiter across all workers
- [ ] Implement progress tracking with rich progress bars
- [ ] Add batch processing for memory efficiency

### 5.2 Hybrid Batch + Queue Processing
- [ ] Implement hybrid approach: batches for progress, queue within batches
- [ ] Add intermediate database saves between batches
- [ ] Implement resume capability after interruption
- [ ] Add memory usage optimization

## Phase 6: CLI Scripts

### 6.1 Main Collection Script
- [ ] Create `scripts/collect_games.py` with typer CLI
- [ ] Add `--full-refresh` option to rebuild entire database
- [ ] Add `--update-metadata` option for metadata-only updates
- [ ] Add `--batch-size` option to override batch size
- [ ] Integrate progress tracking and logging

### 6.2 Database Setup Script
- [ ] Enhance `scripts/setup_db.py` with environment validation
- [ ] Add database migration running
- [ ] Add initial data validation
- [ ] Add connection testing

## Phase 7: Testing Infrastructure

### 7.1 Test Foundation
- [ ] Create `tests/conftest.py` with shared fixtures
- [ ] Create `tests/fixtures/` directory with sample API responses
- [ ] Add `tests/fixtures/steam_api_response.json`
- [ ] Add `tests/fixtures/steamspy_response.json`

### 7.2 Core Component Tests
- [ ] Create `tests/test_models.py` for data model testing
  - [ ] Model creation and validation
  - [ ] Foreign key relationships
  - [ ] JSON field serialization
  - [ ] Status enum transitions
- [ ] Create `tests/test_rate_limiter.py` for rate limiter testing
  - [ ] Different APIs get different rate limits
  - [ ] Rate limiter + HTTP client integration
  - [ ] Concurrent worker rate limiter sharing

### 7.3 Collection Component Tests
- [ ] Create `tests/test_steam_collector.py`
  - [ ] Steam API response parsing
  - [ ] Game upsert logic (new/existing/inactive)
  - [ ] Rate limiter integration
- [ ] Create `tests/test_steamspy_collector.py`
  - [ ] SteamSpy response parsing
  - [ ] Missing game handling
  - [ ] Data normalization testing

### 7.4 Integration Tests
- [ ] Create `tests/test_parallel_fetcher.py`
  - [ ] Concurrent game processing
  - [ ] Batch processing with saves
  - [ ] Mixed success/failure handling
  - [ ] Progress tracking
- [ ] Create `tests/test_integration.py`
  - [ ] Full collection workflow
  - [ ] Incremental update workflow
  - [ ] Resume after interruption

## Phase 8: Documentation & Deployment Prep

### 8.1 Documentation
- [ ] Create comprehensive README.md with setup and usage instructions
- [ ] Document API rate limits and considerations
- [ ] Add troubleshooting guide
- [ ] Document environment variables and configuration

### 8.2 Deployment Preparation
- [ ] Create production-ready configuration examples
- [ ] Add monitoring and health check capabilities

## Phase 9: Optimization & Polish

### 9.1 Performance Optimization
- [ ] Profile memory usage during large batch processing
- [ ] Optimize database batch operations
- [ ] Fine-tune rate limiter settings based on testing
- [ ] Add connection pooling if needed

### 9.2 Error Handling & Resilience
- [ ] Comprehensive error handling for edge cases
- [ ] Add graceful shutdown handling
- [ ] Implement checkpoint/resume functionality
- [ ] Add data validation and integrity checks

### 9.3 Monitoring & Logging
- [ ] Add detailed progress metrics
- [ ] Implement structured logging
- [ ] Add performance monitoring
- [ ] Create status reporting

## Implementation Notes

### Dependencies Check
Before starting, ensure all required packages are available:
- sqlalchemy, alembic, httpx, pydantic-settings
- limits, tenacity, typer, rich, python-dotenv
- psycopg2-binary (for PostgreSQL)
- pytest, pytest-asyncio, factory-boy (for testing)

### Development Workflow
1. Implement each phase in order - dependencies flow from top to bottom
2. Test each component as it's built before moving to the next phase
3. Use the existing CLAUDE.md for reference during development
4. Mark checklist items as completed during implementation

### Critical Success Factors
- Rate limiter must work correctly with concurrent requests
- Database models must handle the expected data volumes efficiently
- Error handling must be robust for long-running collection jobs
- Progress tracking must provide meaningful feedback during long runs