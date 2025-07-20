# Multi-stage build for production-ready Steam game data collector
FROM python:3.12-slim as builder

# Set environment variables for Poetry
ENV POETRY_NO_INTERACTION=1 \
    POETRY_VENV_IN_PROJECT=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.8.5

# Set work directory
WORKDIR /app

# Copy Poetry configuration files
COPY pyproject.toml ./
COPY poetry.lock* ./

# Configure poetry and install dependencies
RUN poetry config virtualenvs.in-project true && \
    poetry config virtualenvs.create true && \
    poetry lock --no-update || true && \
    poetry install --only=main --no-root && \
    rm -rf $POETRY_CACHE_DIR

# Production stage
FROM python:3.12-slim as production

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH"

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set work directory
WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port (if needed for future web interface)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

# Default command - shows available commands
CMD ["python", "scripts/collect_games.py", "--help"]