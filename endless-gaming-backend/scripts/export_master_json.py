#!/usr/bin/env python3
"""
Export master.json data to a file.

This script produces the same result as the /discovery/games/master.json endpoint
and writes it to a JSON file at the specified path.

Usage:
    poetry run python scripts/export_master_json.py <output_path>
    
Example:
    poetry run python scripts/export_master_json.py ../endless-gaming-frontend/src/assets/master.json
"""
import sys
import json
import argparse
from pathlib import Path
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import DatabaseError

# Add the parent directory to Python path to import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.game import Game
from models.game_metadata import GameMetadata
from models.storefront_data import StorefrontData
from config import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


def to_game_record(game):
    """
    Convert a Game model instance to a game record dictionary.
    
    Converts snake_case field names to camelCase for frontend compatibility.
    Includes ALL available data from GameMetadata and StorefrontData.
    
    Args:
        game: Game model instance with optional metadata and storefront_data relationships
        
    Returns:
        Dictionary containing game record data in camelCase format
    """
    metadata = game.game_metadata
    storefront = game.storefront_data
    
    # Convert price format from SteamSpy metadata
    price = None
    if metadata and metadata.price:
        if metadata.price == "0":
            price = "Free"
        else:
            price = metadata.price
    
    # Handle tags - ensure we have a dictionary
    tags = {}
    if metadata and metadata.tags_json:
        if isinstance(metadata.tags_json, dict):
            tags = metadata.tags_json
        elif isinstance(metadata.tags_json, str):
            try:
                tags = json.loads(metadata.tags_json)
            except (json.JSONDecodeError, TypeError):
                tags = {}
    
    # Handle genres - convert single genre string to list (SteamSpy genres)
    genres = []
    if metadata and metadata.genre:
        genres = [metadata.genre] if isinstance(metadata.genre, str) else metadata.genre
    
    # Build camelCase record with ALL available fields
    record = {
        "appId": game.app_id,
        "name": game.name,
        
        # Steam Store API fields (primary source for these when available)
        "coverUrl": storefront.header_image if storefront else None,
        "shortDescription": storefront.short_description if storefront else None,
        "detailedDescription": storefront.detailed_description if storefront else None,
        "isFree": storefront.is_free if storefront else None,
        "requiredAge": storefront.required_age if storefront else None,
        "website": storefront.website if storefront else None,
        "releaseDate": storefront.release_date if storefront else None,
        "developers": storefront.developers if storefront else ([metadata.developer] if metadata and metadata.developer else None),
        "publishers": storefront.publishers if storefront else ([metadata.publisher] if metadata and metadata.publisher else None),
        "storeGenres": storefront.genres if storefront else None,
        "categories": storefront.categories if storefront else None,
        "supportedLanguages": storefront.supported_languages if storefront else None,
        "priceData": storefront.price_overview if storefront else None,
        "pcRequirements": storefront.pc_requirements if storefront else None,
        
        # SteamSpy fields (preserved for backwards compatibility and unique data)
        "price": price,
        "developer": metadata.developer if metadata else None,  # Keep for backwards compatibility
        "publisher": metadata.publisher if metadata else None,  # Keep for backwards compatibility
        "tags": tags,
        "genres": genres,  # SteamSpy genres (different from Steam Store genres)
        "reviewPos": metadata.positive_reviews if metadata else None,
        "reviewNeg": metadata.negative_reviews if metadata else None,
    }
    
    return record


def get_master_json_data(session):
    """
    Get the same data as the /discovery/games/master.json endpoint.
    
    Args:
        session: SQLAlchemy session
        
    Returns:
        List of game records for games with 1M+ owners and valid tags
    """
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
    
    # Query all active games with their metadata, filtered for 1M+ owners
    # Also filter out games without tags since they can't contribute to preference learning
    games = (
        session.query(Game)
        .join(Game.game_metadata)
        .filter(Game.is_active.is_(True))
        .filter(GameMetadata.owners_estimate.in_(million_plus_ranges))
        .filter(GameMetadata.tags_json.isnot(None))  # Has tags data
        .filter(GameMetadata.tags_json != '{}')      # Not empty JSON object
        .filter(GameMetadata.tags_json != '')       # Not empty string
        .order_by(GameMetadata.score_rank)
        .limit(1000)
        .options(
            joinedload(Game.game_metadata),
            joinedload(Game.storefront_data)
        )
        .all()
    )
    
    # Convert to game records and filter out any remaining games without valid tags
    game_records = []
    for game in games:
        record = to_game_record(game)
        # Additional client-side check: ensure tags dict has actual content
        if record.get('tags') and len(record['tags']) > 0:
            game_records.append(record)
    
    return game_records


def export_master_json(output_path: str):
    """
    Export master.json data to the specified file path.
    
    Args:
        output_path: Path where the JSON file should be written
    """
    # Get configuration and create database session
    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    try:
        # Get the data
        print(f"Fetching game data...")
        game_records = get_master_json_data(session)
        print(f"Found {len(game_records)} games with 1M+ owners and valid tags")
        
        # Ensure output directory exists
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to file
        print(f"Writing to {output_path}...")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(game_records, f, indent=2, ensure_ascii=False)
        
        print(f"Successfully exported {len(game_records)} games to {output_path}")
        
    except DatabaseError as e:
        print(f"Database error: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        session.close()


def main():
    parser = argparse.ArgumentParser(
        description="Export master.json data to a file",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  poetry run python scripts/export_master_json.py ../endless-gaming-frontend/src/assets/master.json
  poetry run python scripts/export_master_json.py /tmp/master.json
        """
    )
    parser.add_argument(
        'output_path',
        help='Path where the JSON file should be written'
    )
    
    args = parser.parse_args()
    export_master_json(args.output_path)


if __name__ == '__main__':
    main()