FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Configure Poetry
RUN poetry config virtualenvs.create false

# Copy Poetry files
COPY pyproject.toml poetry.lock ./

# Install dependencies only (don't install the project itself)
RUN poetry install --only=main --no-root

# Install gunicorn
RUN pip install gunicorn

# Copy application code
COPY . .

# Expose port (App Platform sets $PORT)
EXPOSE 8080

# Start the application (use $PORT from App Platform)
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-8080} --workers 2 'app:create_app()'"]