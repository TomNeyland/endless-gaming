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

# Install dependencies
RUN poetry install --only=main

# Install gunicorn
RUN pip install gunicorn

# Copy application code
COPY . .

# Create empty SQLite database (will be initialized at runtime)
RUN touch app.db

# Expose port
EXPOSE 8080

# Start the application
CMD ["sh", "-c", "python scripts/setup_db.py && gunicorn --bind 0.0.0.0:8080 --workers 2 'app:create_app()'"]