# Endless Gaming

[![Tests](https://github.com/TomNeyland/endless-gaming/actions/workflows/test.yml/badge.svg)](https://github.com/TomNeyland/endless-gaming/actions/workflows/test.yml)
[![CI/CD](https://github.com/TomNeyland/endless-gaming/actions/workflows/ci.yml/badge.svg)](https://github.com/TomNeyland/endless-gaming/actions/workflows/ci.yml)
[![Docker Build](https://img.shields.io/docker/automated/tomneyland/endless-gaming)](https://hub.docker.com/r/tomneyland/endless-gaming)

A comprehensive Steam gaming platform that helps you discover, track, and decide what to play next.

## What is Endless Gaming?

Endless Gaming is a full-stack application designed to solve the age-old gamer problem: "I have hundreds of games, but I don't know what to play!" 

### Current Features

**Data Collection Engine** (Production Ready)
- **Popularity-based game discovery** - Collects games ordered by player count from SteamSpy
- **Comprehensive metadata** - Game details, tags, reviews, pricing, and player statistics  
- **Real-time progress tracking** - Live updates showing games being processed with names and tags
- **Intelligent rate limiting** - Respects API limits while maximizing throughput
- **Production deployment** - Docker containers with PostgreSQL support
- **89 comprehensive tests** - Extensive test coverage with CI/CD validation

### Planned Features

**Game Discovery & Recommendation**
- **Smart game picker** - AI-powered recommendations based on your library and preferences
- **Tag-based filtering** - Find games by mood, genre, playtime, or any combination
- **Trending discovery** - See what's popular in your preferred genres
- **Personal rating system** - Track what you've played and rate your experiences

**Library Management**
- **Steam library integration** - Import and sync your Steam games
- **Random game selector** - "Surprise me!" feature for decision paralysis
- **Play history tracking** - Keep track of what you've played and when
- **Achievement progress** - Monitor completion status across your library

**Social Features** (Future)
- **Friend recommendations** - See what your friends are playing and recommend
- **Gaming events** - Coordinate multiplayer sessions
- **Community insights** - Aggregate stats and trends from the gaming community

## Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/TomNeyland/endless-gaming.git
cd endless-gaming

# Start data collection (first 5000 games)
docker-compose run --rm endless-gaming \
  python scripts/collect_games.py collect --max-pages 5

# Check collection status
docker-compose run --rm endless-gaming \
  python scripts/collect_games.py status
```

### Local Development

```bash
# Install dependencies
poetry install
poetry shell

# Initialize database
python scripts/setup_db.py

# Start collecting game data
python scripts/collect_games.py collect --max-pages 2

# Run tests
pytest
```

## Data Collection

The heart of Endless Gaming is a robust data collection system that gathers comprehensive game information:

```bash
# Collect games by popularity (most played first)
python scripts/collect_games.py collect --max-pages 10

# Update metadata for existing games only  
python scripts/collect_games.py collect --update-metadata

# View current database statistics
python scripts/collect_games.py status
```

### What Gets Collected

- **Game Metadata**: Name, developer, publisher, release date
- **Player Statistics**: Owner estimates, player counts, review scores
- **Categorization**: Steam tags with vote counts, genres, features
- **Pricing**: Current price, historical data, regional pricing
- **Reviews**: Positive/negative ratios, recent trends

### Live Progress Tracking

Watch as games are processed in real-time:

```
Counter-Strike: Global Offensive (FPS, Shooter, Multiplayer)
Apex Legends (Free to Play, Battle Royale, Multiplayer)  
PUBG: BATTLEGROUNDS (Survival, Shooter, Battle Royale)
Palworld (Open World, Survival, Creature Collector)
```

## Architecture

### Current (Data Collection)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   SteamSpy API  │───▶│  Data Collectors │───▶│   PostgreSQL    │
│   (/all + /app) │    │  (Rate Limited)  │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Rich CLI       │
                       │  (Progress UI)   │
                       └──────────────────┘
```

### Planned (Full Stack)
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     React       │◀───│   FastAPI        │◀───│   Data Layer    │
│   Frontend      │    │   Backend        │    │ (Existing CLI)  │
│                 │    │                  │    │                 │
│ • Game Picker   │    │ • Recommendations│    │ • Game Metadata │
│ • Library Mgmt  │    │ • User Prefs     │    │ • Steam Integration│
│ • Discovery     │    │ • Social Features│    │ • Real-time Sync │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Deployment

### Production Deployment

```bash
# With PostgreSQL (recommended for production)
docker-compose --profile production up -d postgres

# Initialize database
docker-compose run --rm endless-gaming python scripts/setup_db.py

# Start data collection  
docker-compose --profile production up endless-gaming
```

### Configuration

Environment variables for production:

```bash
# Database
DATABASE_URL=postgresql://user:password@postgres:5432/endless_gaming

# Rate limiting (optional)
MAX_WORKERS=3

# Steam API (optional, for legacy features)
STEAM_API_KEY=your_steam_api_key_here
```

See [README.Docker.md](README.Docker.md) for complete deployment guide.

## Testing

Comprehensive test suite with 89 tests covering all functionality:

```bash
# Run all tests
poetry run pytest

# Run with coverage
poetry run pytest --cov=. --cov-report=html

# Run specific test categories
poetry run pytest tests/test_steamspy_collector.py
poetry run pytest tests/test_models.py
```

### Test Categories
- **Models** (14 tests) - Database models and relationships
- **Rate Limiting** (14 tests) - API throttling and retry logic  
- **Data Collection** (50+ tests) - SteamSpy API integration and parsing
- **Parallel Processing** (11 tests) - Concurrent data fetching

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Follow TDD**: Write failing tests first, then implement
4. **Run the test suite**: `poetry run pytest`
5. **Commit changes**: Follow conventional commit format
6. **Push and create PR**: Include description of changes

### Development Workflow

This project follows strict **Test-Driven Development (TDD)**:

1. Write failing tests that define the expected behavior
2. Implement minimal code to make tests pass
3. Refactor while keeping tests green
4. Commit with descriptive messages

## Project Status

### Completed (v0.1.0)
- [x] SteamSpy data collection engine
- [x] PostgreSQL/SQLite database models  
- [x] Rate-limited API integration
- [x] Real-time progress tracking
- [x] Docker containerization
- [x] CI/CD pipeline with GitHub Actions
- [x] Comprehensive test suite (89 tests)

### In Development
- [ ] Web frontend (React + TypeScript)
- [ ] REST API backend (FastAPI)
- [ ] Game recommendation algorithm
- [ ] Steam library integration
- [ ] User authentication system

### Future Plans
- [ ] Mobile app (React Native)
- [ ] Social features and friend recommendations
- [ ] Advanced analytics and insights
- [ ] Integration with other gaming platforms
- [ ] Community features and reviews

## License

License TBD - see repository for updates.

