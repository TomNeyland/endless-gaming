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
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import settings
from models import Base
from models.game import Game
from collectors.steamspy_all_collector import SteamSpyAllCollector
from collectors.steamspy_collector import SteamSpyMetadataCollector
from collectors.steam_store_collector import SteamStoreCollector
from workers.parallel_fetcher import ParallelMetadataFetcher

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
    
    # No Steam API key required since we use SteamSpy /all endpoint
    
    # Test database connection
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
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


async def collect_games_by_popularity(session, max_pages=None, progress_callback=None):
    """Collect games from SteamSpy in popularity order and save to database."""
    collector = SteamSpyAllCollector()
    
    console.print("🎮 Fetching games by popularity from SteamSpy...")
    console.print("⏰ Note: SteamSpy /all API is rate limited to 1 request per minute")
    
    def page_progress_callback(page, total_pages, games_in_page, status):
        console.print(f"📄 Page {page}: {games_in_page} games fetched and saved - {status}")
        if progress_callback:
            progress_callback(f"Page {page}: {games_in_page} games", status)
    
    result = await collector.collect_and_save_games(
        session, 
        max_pages=max_pages,
        progress_callback=page_progress_callback
    )
    
    console.print(Panel(
        f"Games created: {result['new_games']}\n"
        f"Games updated: {result['updated_games']}\n"
        f"Games deactivated: {result['deactivated_games']}\n"
        f"Total processed: {result['total_games_processed']}\n"
        f"Pages processed: {result['pages_processed']}",
        title="Game Collection Results (by Popularity)",
        border_style="green"
    ))
    
    return result['total_games_processed']


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
    steamspy_collector = SteamSpyMetadataCollector()
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
        
        def update_progress(current, total, game_name, top_tags, status):
            progress.update(task, completed=current)
            
            # Format game display with top 3 tags
            tags_display = ", ".join(top_tags) if top_tags else "No tags"
            game_display = f"{game_name} ({tags_display})"
            
            # Show progress for each game immediately
            status_emoji = "✅" if status == "success" else "❌" if status == "failed" else "⚠️"
            progress.console.print(f"{status_emoji} {game_display}")
            
            if current % 100 == 0 or current == total:
                progress.console.print(f"📊 Progress: {current}/{total} total processed")
        
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


async def collect_interleaved(session, max_pages=None, batch_size=1000, max_concurrent=3, skip_storefront=False):
    """
    Collect games and metadata in interleaved fashion: page -> metadata -> storefront -> page -> metadata -> storefront.
    
    This approach processes each page of games immediately after fetching it,
    rather than fetching all pages first then processing metadata.
    """
    console.print("🔄 Starting interleaved collection (page -> metadata -> storefront -> page)")
    
    collector = SteamSpyAllCollector()
    steamspy_metadata_collector = SteamSpyMetadataCollector()
    steam_store_collector = SteamStoreCollector()
    
    total_games_processed = 0
    total_metadata_processed = 0
    total_storefront_processed = 0
    
    page = 0
    while True:
        # Check if we've reached max pages
        if max_pages is not None and page >= max_pages:
            break
            
        console.print(f"\n📄 === Processing Page {page} ===")
        
        if page > 0:
            console.print("⏰ Waiting for rate limit... fetching next page in ~60 seconds")
        
        try:
            # Fetch single page of games
            console.print(f"🎮 Fetching page {page} from SteamSpy...")
            response = await collector.fetch_games_page(page)
            
            if not response:
                console.print("✅ No more games found, collection complete")
                break
                
            # Parse and save games from this page
            games = collector.parse_all_response(response)
            if not games:
                console.print("✅ Empty page received, collection complete")
                break
                
            # Save games to database
            save_result = await collector.save_games_to_database(games, session)
            games_this_page = len(games)
            total_games_processed += games_this_page
            
            console.print(Panel(
                f"Games on page {page}: {games_this_page}\n"
                f"New: {save_result['new_games']}, Updated: {save_result['updated_games']}, Deactivated: {save_result['deactivated_games']}",
                title=f"Page {page} Results",
                border_style="blue"
            ))
            
            # Now collect metadata for games from this page immediately
            console.print(f"🔄 Collecting metadata for {games_this_page} games from page {page}...")
            
            # Create progress callback for this page
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TaskProgressColumn(),
                console=console
            ) as progress:
                task = progress.add_task("Fetching metadata...", total=games_this_page)
                
                def update_progress(current, total, game_name, top_tags, status):
                    progress.update(task, completed=current)
                    
                    # Format game display with top 3 tags
                    tags_display = ", ".join(top_tags) if top_tags else "No tags"
                    game_display = f"{game_name} ({tags_display})"
                    
                    # Show progress for each game immediately
                    status_emoji = "✅" if status == "success" else "❌" if status == "failed" else "⚠️"
                    progress.console.print(f"{status_emoji} {game_display}")
                
                # Collect metadata for games from this page
                metadata_result = await steamspy_metadata_collector.collect_metadata_for_games(
                    games, session, batch_size=batch_size, progress_callback=update_progress
                )
                
                total_metadata_processed += metadata_result['total_games_processed']
            
            console.print(Panel(
                f"Metadata processed: {metadata_result['total_games_processed']}\n"
                f"Success: {metadata_result['successful_fetches']}, Failed: {metadata_result['failed_fetches']}, Not found: {metadata_result['not_found']}",
                title=f"Page {page} Metadata Results",
                border_style="green"
            ))
            
            # Collect Steam Store data if not skipped
            if not skip_storefront:
                console.print(f"🏪 Collecting Steam Store data for {games_this_page} games from page {page}...")
                console.print("⏰ Note: Steam Store API is rate limited to 1 request per second")
                
                # Create progress callback for storefront data
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    BarColumn(),
                    TaskProgressColumn(),
                    console=console
                ) as progress:
                    task = progress.add_task("Fetching storefront data...", total=games_this_page)
                    
                    def storefront_progress_callback(current, total, game_name, status):
                        progress.update(task, completed=current)
                        
                        # Show progress for each game immediately
                        status_emoji = "✅" if status == "success" else "❌" if status == "failed" else "⚠️"
                        progress.console.print(f"{status_emoji} {game_name} (storefront)")
                    
                    # Collect storefront data for games from this page
                    storefront_result = await steam_store_collector.collect_storefront_data_for_games(
                        games, session, batch_size=10, progress_callback=storefront_progress_callback
                    )
                    
                    total_storefront_processed += storefront_result['total_games_processed']
                
                console.print(Panel(
                    f"Storefront data processed: {storefront_result['total_games_processed']}\n"
                    f"Success: {storefront_result['successful_fetches']}, Failed: {storefront_result['failed_fetches']}, Not found: {storefront_result['not_found']}",
                    title=f"Page {page} Storefront Results",
                    border_style="cyan"
                ))
            else:
                console.print("⏭️  Skipping Steam Store data collection (--skip-storefront enabled)")
            
            page += 1
            
        except Exception as e:
            console.print(Panel(
                f"❌ Failed to process page {page}: {str(e)}",
                title="Error",
                border_style="red"
            ))
            break
    
    return total_games_processed, total_metadata_processed, total_storefront_processed


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
    max_pages: int = typer.Option(
        None,
        "--max-pages",
        help="Maximum pages of games to fetch (1000 games per page)"
    ),
    skip_validation: bool = typer.Option(
        False,
        "--skip-validation",
        help="Skip environment validation (for testing)"
    ),
    skip_storefront: bool = typer.Option(
        False,
        "--skip-storefront",
        help="Skip Steam Store data collection (faster collection)"
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
        
        # Use settings defaults if not overridden (1000 batch size for SteamSpy pages)
        _batch_size = batch_size or 1000
        _max_concurrent = max_concurrent or settings.max_workers
        
        console.print(Panel(
            f"Mode: {'Full refresh' if full_refresh else 'Update metadata only' if update_metadata else 'Incremental update'}\n"
            f"Batch size: {_batch_size}\n"
            f"Max concurrent: {_max_concurrent}\n"
            f"Max pages: {max_pages or 'unlimited'}\n"
            f"Skip storefront: {'Yes' if skip_storefront else 'No'}\n"
            f"Database: {settings.database_url}",
            title="Collection Configuration",
            border_style="blue"
        ))
        
        session = create_db_session()
        try:
            total_games = 0
            total_metadata = 0
            total_storefront = 0
            
            if update_metadata:
                # Metadata-only mode: update existing games
                total_metadata = await collect_metadata_parallel(
                    session, _batch_size, _max_concurrent
                )
            else:
                # Interleaved mode: page -> metadata -> storefront -> page -> metadata -> storefront
                total_games, total_metadata, total_storefront = await collect_interleaved(
                    session, max_pages=max_pages, batch_size=_batch_size, max_concurrent=_max_concurrent, skip_storefront=skip_storefront
                )
            
            console.print(Panel(
                f"🎉 Collection completed successfully!\n"
                f"Games processed: {total_games}\n"
                f"Metadata processed: {total_metadata}\n"
                f"Storefront data processed: {total_storefront}",
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
        from models.storefront_data import StorefrontData
        
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
        
        # Get storefront data status counts
        total_storefront = session.query(StorefrontData).count()
        successful_storefront = session.query(StorefrontData).filter(
            StorefrontData.fetch_status == FetchStatus.SUCCESS.value
        ).count()
        pending_storefront = session.query(StorefrontData).filter(
            StorefrontData.fetch_status == FetchStatus.PENDING.value
        ).count()
        failed_storefront = session.query(StorefrontData).filter(
            StorefrontData.fetch_status == FetchStatus.FAILED.value
        ).count()
        
        console.print(Panel(
            f"Total games: {total_games}\n"
            f"Active games: {active_games}\n\n"
            f"Total metadata records: {total_metadata}\n"
            f"Successful metadata: {successful_metadata}\n"
            f"Pending metadata: {pending_metadata}\n"
            f"Failed metadata: {failed_metadata}\n\n"
            f"Total storefront records: {total_storefront}\n"
            f"Successful storefront: {successful_storefront}\n"
            f"Pending storefront: {pending_storefront}\n"
            f"Failed storefront: {failed_storefront}",
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