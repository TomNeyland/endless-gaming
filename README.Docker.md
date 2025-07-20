# Docker Deployment Guide

This document explains how to run the Steam Game Data Collector using Docker.

## Quick Start

### 1. Build the Docker Image

```bash
docker build -t endless-gaming .
```

### 2. Run with Docker Compose (Recommended)

```bash
# Create data directory
mkdir -p ./data

# Run the collector
docker-compose run --rm endless-gaming python scripts/collect_games.py collect --max-pages 2
```

### 3. Direct Docker Run

```bash
# Create a data volume for persistence
docker volume create endless-gaming-data

# Run the collector
docker run --rm -v endless-gaming-data:/app/data endless-gaming \
  python scripts/collect_games.py collect --max-pages 5
```

## Configuration

### Environment Variables

Set these in `docker-compose.yml` or pass with `-e`:

```bash
# Database (SQLite - default)
DATABASE_URL=sqlite:///data/steam_games.db

# Database (PostgreSQL - production)
DATABASE_URL=postgresql://user:password@postgres:5432/endless_gaming

# Optional: Steam API key (for legacy Steam collector)
STEAM_API_KEY=your_steam_api_key_here

# Rate limiting
MAX_WORKERS=3
```

### Volume Mounts

- `/app/data` - Database and persistent data
- `/app/config` - Configuration files (optional)

## Common Commands

### Collection Commands

```bash
# Collect first 5 pages (5000 games) with metadata
docker-compose run --rm endless-gaming \
  python scripts/collect_games.py collect --max-pages 5

# Metadata-only update for existing games
docker-compose run --rm endless-gaming \
  python scripts/collect_games.py collect --update-metadata

# Check database status
docker-compose run --rm endless-gaming \
  python scripts/collect_games.py status

# Initialize/setup database
docker-compose run --rm endless-gaming \
  python scripts/setup_db.py
```

### Database Management

```bash
# Run tests
docker-compose run --rm endless-gaming \
  poetry run pytest

# Interactive shell
docker-compose run --rm endless-gaming bash

# View logs
docker-compose logs endless-gaming
```

## Production Setup

### With PostgreSQL

1. Update `docker-compose.yml`:

```yaml
services:
  endless-gaming:
    environment:
      - DATABASE_URL=postgresql://gamedata:secure_password_here@postgres:5432/endless_gaming
    depends_on:
      - postgres

  postgres:
    # ... (see docker-compose.yml)
```

2. Start services:

```bash
docker-compose --profile production up -d postgres
docker-compose run --rm endless-gaming python scripts/setup_db.py
docker-compose --profile production up endless-gaming
```

### Scheduled Collection

Use cron or a scheduler to run periodic collection:

```bash
# Crontab example - collect every 6 hours
0 */6 * * * cd /path/to/endless-gaming && docker-compose run --rm endless-gaming python scripts/collect_games.py collect --max-pages 10
```

## Data Persistence

- **SQLite**: Mount `/app/data` volume to persist `steam_games.db`
- **PostgreSQL**: Use named volume for `/var/lib/postgresql/data`

## Monitoring

### Health Checks

```bash
# Check container health
docker-compose ps

# Container logs
docker-compose logs -f endless-gaming

# Resource usage
docker stats
```

### Database Status

```bash
# Quick status check
docker-compose run --rm endless-gaming \
  python scripts/collect_games.py status
```

## Troubleshooting

### Common Issues

1. **Permission denied**: Ensure proper volume permissions
   ```bash
   sudo chown -R 1000:1000 ./data
   ```

2. **Database locked**: Only run one collector instance at a time
   ```bash
   docker-compose down
   docker-compose run --rm endless-gaming python scripts/collect_games.py collect
   ```

3. **Rate limiting**: SteamSpy /all API is limited to 1 request/minute
   - This is normal behavior
   - Use `--max-pages` to limit collection scope for testing

### Debug Mode

```bash
# Run with verbose logging
docker-compose run --rm endless-gaming \
  python scripts/collect_games.py collect --max-pages 1 --skip-validation
```

## Development

### Building for Development

```bash
# Build development image
docker build -t endless-gaming:dev --target builder .

# Run tests in container
docker run --rm endless-gaming:dev poetry run pytest
```

### Local Development with Docker

```bash
# Mount source code for development
docker run --rm -v $(pwd):/app -w /app endless-gaming:dev \
  poetry run pytest
```