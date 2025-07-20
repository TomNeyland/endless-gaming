#!/usr/bin/env python3
"""
Database inspection script for analyzing Steam game data.

This script provides various functions for inspecting database characteristics,
analyzing metadata distributions, and generating reports on the collected data.
"""
import os
import sys
from typing import Dict, List, Tuple, Optional
from collections import Counter

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from sqlalchemy import create_engine, func, text
from sqlalchemy.orm import sessionmaker

# Add project root to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from config import settings
from models import Base
from models.game import Game
from models.game_metadata import GameMetadata, FetchStatus

app = typer.Typer(
    name="inspect-db",
    help="Inspect and analyze Steam game database",
    add_completion=False
)
console = Console()


def create_db_session():
    """Create database session."""
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return SessionLocal()


def validate_database():
    """Validate database connection and tables exist."""
    try:
        engine = create_engine(settings.database_url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            
        # Check if tables exist
        session = create_db_session()
        session.query(Game).first()
        session.query(GameMetadata).first()
        session.close()
        
    except Exception as e:
        console.print(Panel(
            f"❌ Database validation failed: {e}",
            title="Database Error",
            border_style="red"
        ))
        raise typer.Exit(1)
    
    console.print("✅ Database connection validated")


def analyze_owners_distribution(session) -> List[Tuple[str, int]]:
    """
    Analyze the distribution of owner estimates.
    
    Returns:
        List of tuples (owners_estimate, count) ordered by count descending
    """
    console.print("📊 Analyzing owners estimate distribution...")
    
    # Query for owners_estimate and count of app_ids
    results = session.query(
        GameMetadata.owners_estimate,
        func.count(GameMetadata.app_id).label('game_count')
    ).filter(
        GameMetadata.owners_estimate.isnot(None)
    ).group_by(
        GameMetadata.owners_estimate
    ).order_by(
        func.count(GameMetadata.app_id).desc()
    ).all()
    
    return [(owners_estimate, count) for owners_estimate, count in results]


@app.command()
def owners_distribution():
    """Show distribution of owner estimates across all games."""
    try:
        validate_database()
        session = create_db_session()
        
        distribution = analyze_owners_distribution(session)
        
        if not distribution:
            console.print(Panel(
                "No owner estimate data found in database",
                title="No Data",
                border_style="yellow"
            ))
            return
        
        # Create a rich table
        table = Table(title="Owner Estimates Distribution")
        table.add_column("Owner Estimate Range", style="cyan", no_wrap=True)
        table.add_column("Number of Games", style="magenta", justify="right")
        table.add_column("Percentage", style="green", justify="right")
        
        total_games = sum(count for _, count in distribution)
        
        for owners_estimate, count in distribution:
            percentage = (count / total_games) * 100
            table.add_row(
                owners_estimate or "Unknown",
                str(count),
                f"{percentage:.1f}%"
            )
        
        console.print(table)
        console.print(f"\n📈 Total games with owner data: {total_games}")
        
        session.close()
        
    except Exception as e:
        console.print(Panel(
            f"❌ Analysis failed: {str(e)}",
            title="Error",
            border_style="red"
        ))
        raise typer.Exit(1)


@app.command()
def metadata_status():
    """Show metadata fetch status distribution."""
    try:
        validate_database()
        session = create_db_session()
        
        console.print("📊 Analyzing metadata fetch status...")
        
        # Get status distribution
        status_counts = session.query(
            GameMetadata.fetch_status,
            func.count(GameMetadata.app_id).label('count')
        ).group_by(
            GameMetadata.fetch_status
        ).order_by(
            func.count(GameMetadata.app_id).desc()
        ).all()
        
        # Create table
        table = Table(title="Metadata Fetch Status Distribution")
        table.add_column("Status", style="cyan")
        table.add_column("Count", style="magenta", justify="right")
        table.add_column("Percentage", style="green", justify="right")
        
        total = sum(count for _, count in status_counts)
        
        for status, count in status_counts:
            percentage = (count / total) * 100 if total > 0 else 0
            table.add_row(
                status,
                str(count),
                f"{percentage:.1f}%"
            )
        
        console.print(table)
        console.print(f"\n📈 Total metadata records: {total}")
        
        session.close()
        
    except Exception as e:
        console.print(Panel(
            f"❌ Analysis failed: {str(e)}",
            title="Error",
            border_style="red"
        ))
        raise typer.Exit(1)


@app.command()
def top_games(
    limit: int = typer.Option(10, help="Number of top games to show"),
    sort_by: str = typer.Option("owners", help="Sort by: owners, reviews, playtime")
):
    """Show top games by various metrics."""
    try:
        validate_database()
        session = create_db_session()
        
        console.print(f"🏆 Top {limit} games by {sort_by}...")
        
        query = session.query(
            Game.app_id,
            Game.name,
            GameMetadata.owners_estimate,
            GameMetadata.positive_reviews,
            GameMetadata.negative_reviews,
            GameMetadata.average_playtime_forever
        ).join(GameMetadata, Game.app_id == GameMetadata.app_id).filter(
            GameMetadata.fetch_status == FetchStatus.SUCCESS.value
        )
        
        if sort_by == "owners":
            # For owners, we'll need to sort by the string ranges
            # This is a simplified sort - in practice you might want to convert to numbers
            query = query.filter(GameMetadata.owners_estimate.isnot(None))
            results = query.all()
            # Sort by extracting the upper bound of the range
            results = sorted(results, key=lambda x: extract_upper_bound(x.owners_estimate), reverse=True)
            results = results[:limit]
        elif sort_by == "reviews":
            query = query.filter(GameMetadata.positive_reviews.isnot(None))
            query = query.order_by(GameMetadata.positive_reviews.desc())
            results = query.limit(limit).all()
        elif sort_by == "playtime":
            query = query.filter(GameMetadata.average_playtime_forever.isnot(None))
            query = query.order_by(GameMetadata.average_playtime_forever.desc())
            results = query.limit(limit).all()
        else:
            console.print(f"❌ Invalid sort option: {sort_by}")
            return
        
        # Create table
        table = Table(title=f"Top {limit} Games by {sort_by.title()}")
        table.add_column("App ID", style="dim")
        table.add_column("Game Name", style="cyan")
        table.add_column("Owner Estimate", style="green")
        table.add_column("Positive Reviews", style="blue", justify="right")
        table.add_column("Avg Playtime (min)", style="magenta", justify="right")
        
        for result in results:
            table.add_row(
                str(result.app_id),
                result.name[:50] + "..." if len(result.name) > 50 else result.name,
                result.owners_estimate or "Unknown",
                str(result.positive_reviews) if result.positive_reviews else "N/A",
                str(result.average_playtime_forever) if result.average_playtime_forever else "N/A"
            )
        
        console.print(table)
        
        session.close()
        
    except Exception as e:
        console.print(Panel(
            f"❌ Analysis failed: {str(e)}",
            title="Error",
            border_style="red"
        ))
        raise typer.Exit(1)


def extract_upper_bound(owners_estimate: str) -> int:
    """Extract upper bound from owners estimate string for sorting."""
    if not owners_estimate:
        return 0
    
    try:
        # Handle formats like "1,000,000 .. 2,000,000"
        if ".." in owners_estimate:
            upper = owners_estimate.split("..")[1].strip()
        else:
            upper = owners_estimate
        
        # Remove commas and convert to int
        return int(upper.replace(",", ""))
    except (ValueError, IndexError):
        return 0


@app.command()
def summary():
    """Show overall database summary with key statistics."""
    try:
        validate_database()
        session = create_db_session()
        
        console.print("📊 Generating database summary...")
        
        # Basic counts
        total_games = session.query(Game).count()
        active_games = session.query(Game).filter(Game.is_active == True).count()
        total_metadata = session.query(GameMetadata).count()
        
        # Metadata status
        successful_metadata = session.query(GameMetadata).filter(
            GameMetadata.fetch_status == FetchStatus.SUCCESS.value
        ).count()
        
        # Games with owner data
        games_with_owners = session.query(GameMetadata).filter(
            GameMetadata.owners_estimate.isnot(None)
        ).count()
        
        # Average reviews for successful fetches
        avg_positive_reviews = session.query(
            func.avg(GameMetadata.positive_reviews)
        ).filter(
            GameMetadata.fetch_status == FetchStatus.SUCCESS.value,
            GameMetadata.positive_reviews.isnot(None)
        ).scalar()
        
        # Most common owner range
        top_owner_range = session.query(
            GameMetadata.owners_estimate,
            func.count(GameMetadata.app_id).label('count')
        ).filter(
            GameMetadata.owners_estimate.isnot(None)
        ).group_by(
            GameMetadata.owners_estimate
        ).order_by(
            func.count(GameMetadata.app_id).desc()
        ).first()
        
        # Create summary panel
        summary_text = f"""Total Games: {total_games:,}
Active Games: {active_games:,}
Total Metadata Records: {total_metadata:,}
Successful Metadata: {successful_metadata:,}
Games with Owner Data: {games_with_owners:,}
Average Positive Reviews: {avg_positive_reviews:.1f if avg_positive_reviews else 'N/A'}
Most Common Owner Range: {top_owner_range[0] if top_owner_range else 'N/A'} ({top_owner_range[1]:,} games)"""
        
        console.print(Panel(
            summary_text,
            title="Database Summary",
            border_style="blue"
        ))
        
        session.close()
        
    except Exception as e:
        console.print(Panel(
            f"❌ Summary generation failed: {str(e)}",
            title="Error",
            border_style="red"
        ))
        raise typer.Exit(1)


@app.command()
def million_plus_owners():
    """Show games with 1M+ estimated owners."""
    try:
        validate_database()
        session = create_db_session()
        
        console.print("🎮 Analyzing games with 1M+ owners...")
        
        # Define owner ranges that indicate 1M+ owners
        million_plus_ranges = [
            "1,000,000 .. 2,000,000",
            "2,000,000 .. 5,000,000", 
            "5,000,000 .. 10,000,000",
            "10,000,000 .. 20,000,000",
            "20,000,000 .. 50,000,000",
            "50,000,000 .. 100,000,000",
            "100,000,000 .. 200,000,000"
        ]
        
        # Get count and distribution of 1M+ owner games
        results = session.query(
            GameMetadata.owners_estimate,
            func.count(GameMetadata.app_id).label('game_count')
        ).filter(
            GameMetadata.owners_estimate.in_(million_plus_ranges)
        ).group_by(
            GameMetadata.owners_estimate
        ).order_by(
            func.count(GameMetadata.app_id).desc()
        ).all()
        
        if not results:
            console.print(Panel(
                "No games found with 1M+ owners",
                title="No Data",
                border_style="yellow"
            ))
            return
        
        # Create table
        table = Table(title="Games with 1M+ Estimated Owners")
        table.add_column("Owner Estimate Range", style="cyan", no_wrap=True)
        table.add_column("Number of Games", style="magenta", justify="right")
        table.add_column("Percentage of Total", style="green", justify="right")
        
        total_million_plus = sum(count for _, count in results)
        total_all_games = session.query(GameMetadata).filter(
            GameMetadata.owners_estimate.isnot(None)
        ).count()
        
        for owners_estimate, count in results:
            percentage = (count / total_all_games) * 100
            table.add_row(
                owners_estimate,
                str(count),
                f"{percentage:.2f}%"
            )
        
        console.print(table)
        console.print(f"\n📈 Total games with 1M+ owners: {total_million_plus:,}")
        console.print(f"📊 Percentage of all games: {(total_million_plus/total_all_games)*100:.2f}%")
        
        session.close()
        
    except Exception as e:
        console.print(Panel(
            f"❌ Analysis failed: {str(e)}",
            title="Error",
            border_style="red"
        ))
        raise typer.Exit(1)


if __name__ == "__main__":
    app()
