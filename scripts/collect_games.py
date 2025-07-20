#!/usr/bin/env python3
"""
Main CLI script for collecting Steam game data.

This script provides options for full data collection, metadata-only updates,
and various configuration overrides. Uses the ParallelMetadataFetcher for
efficient processing of large game datasets.
"""
import asyncio
import os
import sys
from typing import Optional

import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from rich.panel import Panel
from rich.text import Text
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import settings
from models import Base
from models.game import Game
from collectors.steam_collector import SteamGameListCollector
from collectors.steamspy_collector import SteamSpyMetadataCollector
from workers.parallel_fetcher import ParallelMetadataFetcher
from utils.rate_limiter import SimpleRateLimiter

app = typer.Typer(
    name="collect-games",
    help="Collect Steam game data and metadata",
    add_completion=False
)
console = Console()


def create_db_session():
    """Create database session."""
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def validate_environment():
    """Validate required environment variables and settings."""
    errors = []
    
    # Check for Steam API key if using Steam Web API
    if not os.getenv("STEAM_API_KEY"):
        errors.append("STEAM_API_KEY environment variable is required")
    
    # Test database connection
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute("SELECT 1")
    except Exception as e:
        errors.append(f"Database connection failed: {e}")
    
    if errors:
        console.print(Panel(
            "\n".join(f"❌ {error}" for error in errors),
            title="Environment Validation Failed",
            border_style="red"
        ))
        raise typer.Exit(1)
    
    console.print("✅ Environment validation passed")


async def collect_steam_games(session, progress_callback=None):
    """Collect Steam game list and save to database."""
    rate_limiter = SimpleRateLimiter()
    collector = SteamGameListCollector(rate_limiter=rate_limiter)
    
    console.print("🎮 Fetching Steam game list...")
    games_created, games_updated, games_deactivated = await collector.collect_and_save_games(session)
    
    console.print(Panel(
        f"Games created: {games_created}\n"
        f"Games updated: {games_updated}\n"
        f"Games deactivated: {games_deactivated}",
        title="Steam Collection Results",
        border_style="green"
    ))
    
    return games_created + games_updated


async def collect_metadata_parallel(session, batch_size: int, max_concurrent: int, progress_callback=None):
    """Collect metadata for all games using parallel processing."""
    # Get all active games that need metadata updates
    games = session.query(Game).filter(Game.is_active == True).all()
    
    if not games:
        console.print("ℹ️  No games found to process")
        return 0
    
    console.print(f"🔄 Processing metadata for {len(games)} games...")
    console.print(f"📦 Batch size: {batch_size}, Max concurrent: {max_concurrent}")
    
    # Set up collectors and parallel fetcher
    rate_limiter = SimpleRateLimiter()
    steamspy_collector = SteamSpyMetadataCollector(rate_limiter=rate_limiter)
    parallel_fetcher = ParallelMetadataFetcher(
        steamspy_collector=steamspy_collector,
        batch_size=batch_size,
        max_concurrent=max_concurrent
    )
    
    # Process games with progress tracking
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console
    ) as progress:
        task = progress.add_task("Fetching metadata...", total=len(games))
        
        def update_progress(current, total, status):
            progress.update(task, completed=current)
            if current % 100 == 0 or current == total:
                progress.console.print(f"📊 Progress: {current}/{total} ({status})")
        
        completed_batches = await parallel_fetcher.process_games_parallel(
            games, session, progress_callback=update_progress
        )
    
    total_processed = sum(len(batch) for batch in completed_batches)
    console.print(Panel(
        f"Processed: {total_processed} games\n"
        f"Batches: {len(completed_batches)}",
        title="Metadata Collection Results",
        border_style="green"
    ))
    
    return total_processed


@app.command()
def collect(
    full_refresh: bool = typer.Option(
        False, 
        "--full-refresh", 
        help="Rebuild entire database (Steam games + all metadata)"
    ),
    update_metadata: bool = typer.Option(
        False,
        "--update-metadata", 
        help="Update metadata only for existing games"
    ),
    batch_size: int = typer.Option(
        None,
        "--batch-size",
        help="Override batch size for metadata collection"
    ),
    max_concurrent: int = typer.Option(
        None,
        "--max-concurrent", 
        help="Override maximum concurrent requests"
    ),
    skip_validation: bool = typer.Option(
        False,
        "--skip-validation",
        help="Skip environment validation (for testing)"
    )
):
    """
    Collect Steam game data and metadata.
    
    By default, performs incremental updates. Use --full-refresh to rebuild
    the entire database, or --update-metadata to only update metadata.
    """
    async def main():
        # Validate environment unless skipped
        if not skip_validation:
            validate_environment()
        
        # Use settings defaults if not overridden
        _batch_size = batch_size or settings.batch_size
        _max_concurrent = max_concurrent or settings.max_workers
        
        console.print(Panel(
            f"Mode: {'Full refresh' if full_refresh else 'Update metadata only' if update_metadata else 'Incremental update'}\n"
            f"Batch size: {_batch_size}\n"
            f"Max concurrent: {_max_concurrent}\n"
            f"Database: {settings.database_url}",
            title="Collection Configuration",
            border_style="blue"
        ))
        
        session = create_db_session()
        try:
            total_games = 0
            total_metadata = 0
            
            # Collect Steam games (unless metadata-only mode)
            if not update_metadata:
                total_games = await collect_steam_games(session)
            
            # Collect metadata for all games
            total_metadata = await collect_metadata_parallel(
                session, _batch_size, _max_concurrent
            )
            
            console.print(Panel(
                f"🎉 Collection completed successfully!\n"
                f"Games processed: {total_games}\n"
                f"Metadata processed: {total_metadata}",
                title="Final Results",
                border_style="green"
            ))
            
        except Exception as e:
            console.print(Panel(
                f"❌ Collection failed: {str(e)}",
                title="Error",
                border_style="red"
            ))
            raise typer.Exit(1)
        finally:
            session.close()
    
    # Run the async function
    asyncio.run(main())


@app.command()
def status():
    """Show current database status and collection statistics."""
    try:
        session = create_db_session()
        
        # Get game counts
        total_games = session.query(Game).count()
        active_games = session.query(Game).filter(Game.is_active == True).count()
        
        # Get metadata status counts
        from models.game_metadata import GameMetadata, FetchStatus
        total_metadata = session.query(GameMetadata).count()
        successful_metadata = session.query(GameMetadata).filter(
            GameMetadata.fetch_status == FetchStatus.SUCCESS.value
        ).count()
        pending_metadata = session.query(GameMetadata).filter(
            GameMetadata.fetch_status == FetchStatus.PENDING.value
        ).count()
        failed_metadata = session.query(GameMetadata).filter(
            GameMetadata.fetch_status == FetchStatus.FAILED.value
        ).count()
        
        console.print(Panel(
            f"Total games: {total_games}\n"
            f"Active games: {active_games}\n"
            f"Total metadata records: {total_metadata}\n"
            f"Successful metadata: {successful_metadata}\n"
            f"Pending metadata: {pending_metadata}\n"
            f"Failed metadata: {failed_metadata}",
            title="Database Status",
            border_style="blue"
        ))
        
        session.close()
        
    except Exception as e:
        console.print(Panel(
            f"❌ Failed to get status: {str(e)}",
            title="Error",
            border_style="red"
        ))
        raise typer.Exit(1)


if __name__ == "__main__":
    app()