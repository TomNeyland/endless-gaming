# Steam Game Data Collection System - MVP Specification

## Overview
Build a Python system to collect comprehensive game data from Steam and SteamSpy APIs, store it in a database, and maintain it through scheduled updates. Designed for hobby use with simple deployment to a small Digital Ocean droplet.

## Architecture Components

### 1. Database Models (`models/`)

**File: `models/game.py`**
- `Game` model: Core game information from Steam API
  - `app_id` (Primary Key, Integer)
  - `name` (String)
  - `created_at` (DateTime)
  - `updated_at` (DateTime)
  - `is_active` (Boolean) - for handling delisted games

**File: `models/game_metadata.py`**
- `GameMetadata` model: Extended data from SteamSpy
  - `app_id` (Foreign Key to Game)
  - `developer` (String)
  - `publisher` (String)
  - `owners_estimate` (String) - SteamSpy format: "1,000,000 .. 2,000,000"
  - `positive_reviews` (Integer)
  - `negative_reviews` (Integer)
  - `score_rank` (Integer)
  - `average_playtime_forever` (Integer)
  - `average_playtime_2weeks` (Integer)
  - `price` (String)
  - `genre` (String)
  - `languages` (Text)
  - `tags_json` (JSON/Text) - Store tag dictionary
  - `last_updated` (DateTime)
  - `fetch_attempts` (Integer) - Track retry attempts
  - `fetch_status` (Enum: 'pending', 'success', 'failed', 'not_found')

**File: `models/__init__.py`**
- Database configuration
- SQLAlchemy setup with environment-based connection strings

### 2. Simple Multi-API Rate Limiter (`utils/rate_limiter.py`)

#### Design Philosophy
The rate limiter acts as a **throttle/gate** - when rate limits are hit, requests **wait/block** until allowed, ensuring all calls eventually succeed while respecting API limits.

#### Core Components

**APIEndpoint Enum:**
- `STEAM_WEB_API`: Official Steam Web API (with key) - 100,000/day
- `STEAM_STORE_API`: Steam Store API (no key) - 200 requests/5 minutes
- `STEAMSPY_API`: SteamSpy API - 10 requests/minute (conservative)

**SimpleRateLimiter Class:**
- Uses `limits` library with in-memory storage only
- Maintains separate rate limit tracking per API endpoint
- Provides both direct throttling and integrated HTTP client methods

#### Key Methods

**`throttle(endpoint)` Method:**
- Blocks execution until rate limit allows next request
- No errors thrown, just waits
- Uses endpoint-specific rate limits

**`make_request(endpoint, url, **kwargs)` Method:**
- Combines throttling with HTTP request
- Basic retry logic for network errors
- Returns JSON response or raises HTTP errors

#### Rate Limit Configuration
- **Steam Web API**: "100000/day" (with API key)
- **Steam Store API**: "200/5minutes" (per IP, no key required)
- **SteamSpy API**: "60/minute" (documented limit)

### 3. Data Collection System

**File: `collectors/steam_collector.py`**
- `SteamGameListCollector` class
  - Fetches complete game list from Steam API
  - Uses rate limiter for API calls
  - Updates existing games and adds new ones
  - Marks removed games as inactive

**File: `collectors/steamspy_collector.py`**
- `SteamSpyMetadataCollector` class
  - Fetches detailed metadata for individual games
  - Uses rate limiter for API calls
  - Basic retry logic for failed requests
  - Batch processing to avoid overwhelming APIs

### 4. HTTP Client & Retry Logic (`utils/http_client.py`)

#### Simple HTTP Client
- **Primary Client**: `httpx.AsyncClient` with timeout
- **Basic Retry**: Simple retry decorator for network errors
- **Rate Limiting**: Integrated with rate limiter

#### Basic Retry Strategy
- **Max Attempts**: 3 retries
- **Backoff**: Simple exponential backoff
- **Retry On**: Network errors, 5xx status codes
- **No Retry**: 4xx client errors, data validation errors

### 5. Parallel Processing (`workers/parallel_fetcher.py`)

**File: `workers/parallel_fetcher.py`**
- `ParallelMetadataFetcher` class
- Uses `asyncio` for concurrent execution
- Shared rate limiter across all workers
- Simple progress tracking
- Batch processing for memory efficiency

#### Simple Concurrency
- **Shared Rate Limiter**: All workers use same instance
- **Basic Semaphore**: Limit concurrent requests
- **Progress Bar**: Simple progress tracking with `rich`

### 6. Configuration (`config.py`)

#### Simple Settings with Environment Variables
```python
class Settings:
    # Database
    database_url: str = "sqlite:///steam_games.db"
    
    # Rate Limits
    steam_web_api_limit: str = "100000/day"
    steam_store_api_limit: str = "200/5minutes" 
    steamspy_api_limit: str = "60/minute"
    
    # Processing
    max_workers: int = 3
    batch_size: int = 50
    
    # Retry
    retry_attempts: int = 3
    
    # Logging
    log_level: str = "INFO"
```

### 7. Main Scripts

**File: `scripts/collect_games.py`**
- Main script with simple CLI using `typer`
- Options:
  - `--full-refresh`: Rebuild entire database
  - `--update-metadata`: Update metadata only
  - `--batch-size`: Override batch size

**File: `scripts/setup_db.py`**
- Database setup and migrations
- Simple environment validation

## Data Flow

### Collection Process
1. **Setup**: Initialize rate limiter and database
2. **Game List**: Fetch from Steam API through rate limiter
3. **Metadata**: Process games in batches with shared rate limiter
4. **Storage**: Save results to database

### Rate Limiting in Action
```
Game 1: API call → Rate limiter allows → Fetch → Success
Game 2: API call → Rate limiter allows → Fetch → Success  
Game 3: API call → Rate limiter BLOCKS → Wait → Fetch → Success
```

## Error Handling

### Simple Error Strategy
- **Network Errors**: Retry 3 times with backoff
- **Rate Limits**: Rate limiter handles automatically
- **Missing Data**: Log and skip
- **API Errors**: Log and continue

## Job Dispatch & Workflow

### The Challenge: Steam → SteamSpy Pipeline
1. **Steam Game List**: Single API call returns ~23,000 games
2. **SteamSpy Metadata**: Requires 23,000 individual API calls at 60/minute
3. **Total Time**: ~6.4 hours of API calls (23,000 ÷ 60 = 383 minutes)

### Dispatch Patterns (Choose One)

#### Option A: Queue All Tasks (Recommended)
```python
# Queue all 23k tasks at once, let rate limiter handle throttling
async def collect_all_metadata(app_ids):
    tasks = []
    for app_id in app_ids:
        task = fetch_steamspy_data(app_id)  # Rate limiter blocks inside here
        tasks.append(task)
    
    # This creates 23k pending coroutines (minimal memory overhead)
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

**Pros:**
- Simple to code and understand
- asyncio efficiently handles thousands of pending coroutines
- Rate limiter naturally throttles requests
- All failures collected at the end

**Cons:**
- Can't easily pause/resume midway
- No intermediate progress saves to database

#### Option B: Batch Processing (Alternative)
```python
# Process in batches with intermediate saves
async def collect_metadata_in_batches(app_ids, batch_size=100):
    for i in range(0, len(app_ids), batch_size):
        batch = app_ids[i:i + batch_size]
        
        # Process this batch
        tasks = [fetch_steamspy_data(app_id) for app_id in batch]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Save batch results to database
        save_batch_to_db(results)
        
        # Optional: Progress update
        print(f"Completed batch {i//batch_size + 1}")
```

**Pros:**
- Can pause/resume between batches
- Intermediate saves to database
- Better progress tracking
- Memory usage more predictable

**Cons:**
- More complex code
- Still waits for slowest request in each batch

#### Option C: Producer/Consumer (Overkill for This Use Case)
```python
# Separate producer/consumer queues
async def producer(queue, app_ids):
    for app_id in app_ids:
        await queue.put(app_id)

async def consumer(queue, rate_limiter):
    while True:
        app_id = await queue.get()
        result = await fetch_steamspy_data(app_id)
        save_to_db(result)
        queue.task_done()
```

**When to Use:** Only if you need complex flow control or want to add/remove work dynamically.

### Recommended Approach: Hybrid Batch + Queue

**Best of Both Worlds:**
```python
async def collect_metadata_hybrid(app_ids, batch_size=500):
    """
    Process in batches for progress tracking,
    but queue all tasks within each batch for efficiency
    """
    total_batches = len(app_ids) // batch_size + 1
    
    with Progress() as progress:
        task = progress.add_task("Fetching metadata...", total=len(app_ids))
        
        for i, batch_start in enumerate(range(0, len(app_ids), batch_size)):
            batch = app_ids[batch_start:batch_start + batch_size]
            
            # Queue all tasks in this batch (rate limiter handles throttling)
            tasks = [fetch_steamspy_data(app_id) for app_id in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Save batch to database
            save_batch_to_db(batch_results)
            
            # Update progress
            progress.advance(task, len(batch))
            print(f"Completed batch {i+1}/{total_batches}")
```

### Memory & Performance Considerations

#### Why Queueing 23k Tasks is Fine:
- **Coroutine Overhead**: ~1KB per pending coroutine = ~23MB total
- **Rate Limiter**: Blocks coroutines efficiently without consuming CPU
- **asyncio**: Designed to handle thousands of concurrent operations

#### Database Strategy:
- **Batch Commits**: Save every 100-500 records instead of individually
- **Upsert Logic**: Handle duplicate app_ids gracefully
- **Transaction Management**: Rollback failed batches, continue processing

#### Progress Tracking Strategy:
```python
# Track progress with meaningful updates
total_games = len(app_ids)
completed = 0
start_time = time.time()

# Update every 100 completions
if completed % 100 == 0:
    elapsed = time.time() - start_time
    rate = completed / elapsed * 60  # per minute
    eta = (total_games - completed) / rate if rate > 0 else 0
    print(f"Progress: {completed}/{total_games} ({rate:.1f}/min, ETA: {eta:.1f} min)")
```

## Testing Strategy (Light TDD)

### Core Testing Philosophy
- **Test our logic, not library functionality** - Trust that `limits`, `httpx`, `sqlalchemy` work
- **Focus on integration points** - Where our components interact
- **Happy path emphasis** - Core workflows work correctly

### Essential Tests by Component

**Rate Limiter Integration (`test_rate_limiter.py`):**
- Verify different APIs get different rate limits
- Test rate limiter + HTTP client integration
- Ensure concurrent workers share rate limiter

**Data Models (`test_models.py`):**
- Model creation and validation
- Foreign key relationships
- JSON field serialization (tags)
- Status enum transitions

**Steam Collector (`test_steam_collector.py`):**
- Parse Steam API response into Game objects
- Upsert logic (new/existing/inactive games)
- Rate limiter integration

**SteamSpy Collector (`test_steamspy_collector.py`):**
- Parse SteamSpy response into GameMetadata objects
- Handle missing games gracefully
- Data normalization (SteamSpy format → our models)

**Parallel Processing (`test_parallel_fetcher.py`):**
- Process multiple games concurrently
- Batch processing with intermediate saves
- Mixed success/failure handling
- Progress tracking

**End-to-End (`test_integration.py`):**
- Full collection workflow (Steam → SteamSpy → Database)
- Incremental update workflow
- Resume after interruption

### What We're NOT Testing
- Rate limiting algorithms (trust `limits` library)
- HTTP handling (trust `httpx`)
- Database connections (trust `sqlalchemy`)
- Every possible error scenario

### Test Organization
```
tests/
├── conftest.py              # Shared fixtures
├── test_models.py
├── test_rate_limiter.py
├── test_steam_collector.py
├── test_steamspy_collector.py
├── test_parallel_fetcher.py
├── test_integration.py
└── fixtures/
    ├── steam_api_response.json
    └── steamspy_response.json
```

## Required Libraries

### Core Dependencies
```
sqlalchemy
alembic
httpx
pydantic-settings
limits
tenacity
typer
rich
python-dotenv
```

### Testing Dependencies
```
pytest
pytest-asyncio
factory-boy
```

### Database Drivers
```
# For SQLite (included in Python)
# For PostgreSQL
psycopg2-binary
```

## File Structure
```
steam_collector/
├── models/
│   ├── __init__.py
│   ├── game.py
│   └── game_metadata.py
├── collectors/
│   ├── __init__.py
│   ├── steam_collector.py
│   └── steamspy_collector.py
├── utils/
│   ├── __init__.py
│   ├── rate_limiter.py
│   └── http_client.py
├── workers/
│   ├── __init__.py
│   └── parallel_fetcher.py
├── scripts/
│   ├── collect_games.py
│   └── setup_db.py
├── migrations/
├── config.py
├── requirements.txt
├── .env.example
└── README.md
```

This design keeps things simple while maintaining the core benefits of proper rate limiting and good API citizenship, with efficient handling of large-scale API collection jobs.