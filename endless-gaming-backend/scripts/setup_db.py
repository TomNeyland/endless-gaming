#!/usr/bin/env python3
"""
Database setup and initialization script.

This script handles database creation, migration running, environment validation,
and connection testing for the Steam data collection system.
"""
import os
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.text import Text
from sqlalchemy import create_engine, text
from alembic.config import Config
from alembic import command

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import settings
from models import Base

app = typer.Typer(
    name="setup-db",
    help="Database setup and initialization",
    add_completion=False
)
console = Console()


def validate_environment():
    """Validate environment variables and settings."""
    console.print("🔍 Validating environment...")
    
    errors = []
    warnings = []
    
    # Check database URL
    if not settings.database_url:
        errors.append("DATABASE_URL is not set")
    else:
        console.print(f"✅ Database URL: {settings.database_url}")
    
    # Check for Steam API key
    if not os.getenv("STEAM_API_KEY"):
        warnings.append("STEAM_API_KEY is not set (required for Steam Web API)")
    else:
        console.print("✅ Steam API key found")
    
    # Check Python version
    if sys.version_info < (3, 12):
        warnings.append(f"Python 3.12+ recommended, found {sys.version}")
    else:
        console.print(f"✅ Python version: {sys.version}")
    
    # Display results
    if errors:
        console.print(Panel(
            "\n".join(f"❌ {error}" for error in errors),
            title="Environment Validation Failed",
            border_style="red"
        ))
        raise typer.Exit(1)
    
    if warnings:
        console.print(Panel(
            "\n".join(f"⚠️  {warning}" for warning in warnings),
            title="Environment Warnings",
            border_style="yellow"
        ))
    
    console.print("✅ Environment validation completed")


def test_database_connection():
    """Test database connection and basic operations."""
    console.print("🔌 Testing database connection...")
    
    try:
        engine = create_engine(settings.database_url)
        
        # Test basic connection
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            assert result.fetchone()[0] == 1
        
        console.print("✅ Database connection successful")
        
        # Check if tables exist
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        if "games" in tables and "game_metadata" in tables:
            console.print("✅ Required tables found")
            
            # Get table counts
            with engine.connect() as conn:
                result = conn.execute(text("SELECT COUNT(*) FROM games"))
                game_count = result.fetchone()[0]
                
                result = conn.execute(text("SELECT COUNT(*) FROM game_metadata"))
                metadata_count = result.fetchone()[0]
                
                console.print(f"📊 Current data: {game_count} games, {metadata_count} metadata records")
        else:
            console.print("ℹ️  Tables not found (run migrations to create)")
        
        return True
        
    except Exception as e:
        console.print(Panel(
            f"❌ Database connection failed: {str(e)}",
            title="Connection Error",
            border_style="red"
        ))
        return False


def run_migrations():
    """Run Alembic database migrations."""
    console.print("🔄 Running database migrations...")
    
    try:
        # Find alembic.ini in project root
        project_root = Path(__file__).parent.parent
        alembic_ini = project_root / "alembic.ini"
        
        if not alembic_ini.exists():
            console.print(Panel(
                f"❌ alembic.ini not found at {alembic_ini}",
                title="Migration Error",
                border_style="red"
            ))
            return False
        
        # Create Alembic config
        alembic_cfg = Config(str(alembic_ini))
        
        # Override database URL in config
        alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)
        
        # Run migrations
        command.upgrade(alembic_cfg, "head")
        
        console.print("✅ Database migrations completed")
        return True
        
    except Exception as e:
        console.print(Panel(
            f"❌ Migration failed: {str(e)}",
            title="Migration Error",
            border_style="red"
        ))
        return False


def create_database_tables():
    """Create database tables using SQLAlchemy (alternative to migrations)."""
    console.print("🏗️  Creating database tables...")
    
    try:
        engine = create_engine(settings.database_url)
        Base.metadata.create_all(bind=engine)
        
        console.print("✅ Database tables created")
        return True
        
    except Exception as e:
        console.print(Panel(
            f"❌ Table creation failed: {str(e)}",
            title="Table Creation Error",
            border_style="red"
        ))
        return False


@app.command()
def init(
    skip_validation: bool = typer.Option(
        False,
        "--skip-validation",
        help="Skip environment validation"
    ),
    use_create_all: bool = typer.Option(
        False,
        "--use-create-all",
        help="Use SQLAlchemy create_all instead of Alembic migrations"
    )
):
    """
    Initialize database with full setup process.
    
    This command runs environment validation, database connection testing,
    and migrations to set up a complete working database.
    """
    console.print(Panel(
        "🚀 Initializing Steam Data Collection Database",
        border_style="blue"
    ))
    
    # Step 1: Environment validation
    if not skip_validation:
        validate_environment()
    
    # Step 2: Database connection test
    if not test_database_connection():
        console.print("💡 If this is a new database, continue with setup...")
    
    # Step 3: Run migrations or create tables
    if use_create_all:
        success = create_database_tables()
    else:
        success = run_migrations()
    
    if not success:
        raise typer.Exit(1)
    
    # Step 4: Final connection test
    if test_database_connection():
        console.print(Panel(
            "🎉 Database initialization completed successfully!\n\n"
            "Next steps:\n"
            "1. Set STEAM_API_KEY environment variable\n"
            "2. Run: python scripts/collect_games.py collect\n"
            "3. Check status: python scripts/collect_games.py status",
            title="Setup Complete",
            border_style="green"
        ))
    else:
        raise typer.Exit(1)


@app.command()
def migrate():
    """Run database migrations only."""
    if run_migrations():
        console.print("✅ Migrations completed successfully")
    else:
        raise typer.Exit(1)


@app.command()
def test_connection():
    """Test database connection only."""
    if test_database_connection():
        console.print("✅ Database connection test passed")
    else:
        raise typer.Exit(1)


@app.command()
def validate():
    """Validate environment only."""
    validate_environment()


@app.command()
def reset(
    confirm: bool = typer.Option(
        False,
        "--confirm",
        help="Confirm database reset (required)"
    )
):
    """
    Reset database by dropping and recreating all tables.
    
    ⚠️  WARNING: This will delete all data!
    """
    if not confirm:
        console.print(Panel(
            "❌ Database reset requires confirmation.\n"
            "Use: python scripts/setup_db.py reset --confirm",
            title="Confirmation Required",
            border_style="red"
        ))
        raise typer.Exit(1)
    
    console.print("⚠️  Resetting database...")
    
    try:
        engine = create_engine(settings.database_url)
        
        # Drop all tables
        Base.metadata.drop_all(bind=engine)
        console.print("🗑️  Dropped all tables")
        
        # Recreate all tables
        Base.metadata.create_all(bind=engine)
        console.print("🏗️  Recreated all tables")
        
        console.print(Panel(
            "✅ Database reset completed successfully",
            title="Reset Complete",
            border_style="green"
        ))
        
    except Exception as e:
        console.print(Panel(
            f"❌ Database reset failed: {str(e)}",
            title="Reset Error",
            border_style="red"
        ))
        raise typer.Exit(1)


if __name__ == "__main__":
    app()