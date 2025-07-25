# Multi-stage build for JSON export service
FROM python:3.12-slim as builder

# Set environment variables for Poetry
ENV POETRY_NO_INTERACTION=1 \
    POETRY_VENV_IN_PROJECT=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.8.5

# Set work directory
WORKDIR /app

# Copy Poetry configuration files
COPY endless-gaming-backend/pyproject.toml ./
COPY endless-gaming-backend/poetry.lock* ./

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
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app"

# Install runtime dependencies including cron and GitHub CLI
RUN apt-get update && apt-get install -y \
    cron \
    curl \
    jq \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy virtual environment from builder stage
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY endless-gaming-backend/ .

# Copy Docker support files
COPY docker/export_and_push.sh /app/export_and_push.sh
COPY docker/health_server.py /app/health_server.py

# Make scripts executable
RUN chmod +x /app/export_and_push.sh /app/health_server.py

# Set up cron job (daily at 4 AM UTC)
RUN echo "0 4 * * * /app/export_and_push.sh >> /var/log/cron.log 2>&1" > /etc/cron.d/json-export \
    && chmod 0644 /etc/cron.d/json-export \
    && crontab /etc/cron.d/json-export \
    && touch /var/log/cron.log

# Expose port for health checks
EXPOSE 8080

# Health check for Docker/DigitalOcean
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Default environment variables
ENV GITHUB_REPO="" \
    GITHUB_TOKEN="" \
    PORT="8080"

# Start the service
CMD ["python", "/app/health_server.py"]