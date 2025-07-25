#!/usr/bin/env python3
"""
Generate master.json directly from APIs without database.

This script fetches game data directly from SteamSpy APIs and produces
the master.json file that the frontend expects, without requiring a database.
Perfect for CI/CD pipelines and serverless deployments.

Usage:
    poetry run python scripts/generate_master_json_direct.py <output_path> [options]
    
Example:
    poetry run python scripts/generate_master_json_direct.py master.json --max-pages 15
"""
import sys
import json
import asyncio
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

# Add the parent directory to Python path to import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.rate_limiter import SimpleRateLimiter, APIEndpoint


class DirectGameDataCollector:
    """
    Collects game data directly from APIs and produces master.json format.
    
    Combines functionality from SteamSpyAllCollector and SteamSpyMetadataCollector
    without requiring database storage.
    """
    
    def __init__(self):
        """Initialize direct collector."""
        self.rate_limiter = SimpleRateLimiter()
        self.logger = logging.getLogger(__name__)
        
    async def fetch_games_page(self, page: int) -> Dict[str, Any]:
        """
        Fetch a single page of games from SteamSpy /all endpoint.
        
        Args:
            page: Page number to fetch (starts at 0)
            
        Returns:
            Dictionary of games from SteamSpy API
        """
        url = f"https://steamspy.com/api.php?request=all&page={page}"
        self.logger.info(f"Fetching SteamSpy page {page}...")
        
        try:
            response = await self.rate_limiter.make_request(
                APIEndpoint.STEAMSPY_ALL_API, url
            )
            self.logger.info(f"Successfully fetched {len(response)} games from page {page}")
            return response
            
        except Exception as e:
            self.logger.error(f"Failed to fetch SteamSpy page {page}: {e}")
            raise
    
    async def fetch_game_metadata(self, app_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch metadata for a single game from SteamSpy API.
        
        Args:
            app_id: Steam application ID
            
        Returns:
            Game metadata dict or None if not found/failed
        """
        url = f"https://steamspy.com/api.php?request=appdetails&appid={app_id}"
        
        try:
            response_data = await self.rate_limiter.make_request(
                APIEndpoint.STEAMSPY_API, url
            )
            
            # Check if game was found (SteamSpy returns empty dict for not found)
            if not response_data or not response_data.get('appid'):
                return None
                
            return response_data
            
        except Exception as e:
            self.logger.warning(f"Failed to fetch metadata for app_id {app_id}: {e}")
            return None
    
    def convert_price(self, price_cents: Any) -> Optional[str]:
        """
        Convert price from cents to dollar string format.
        
        Args:
            price_cents: Price in cents (string, int, or None)
            
        Returns:
            Formatted price string or None
        """
        if not price_cents:
            return None
            
        try:
            cents = int(price_cents)
            if cents == 0:
                return "Free"
            
            dollars = cents / 100
            return f"{dollars:.2f}"
            
        except (ValueError, TypeError):
            return None
    
    def to_game_record(self, basic_game_data: Dict[str, Any], metadata: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Convert game data to master.json format.
        
        Args:
            basic_game_data: Basic game data from /all endpoint
            metadata: Detailed metadata from individual API call
            
        Returns:
            Game record in master.json format or None if invalid
        """
        app_id = basic_game_data.get('appid') or (metadata and metadata.get('appid'))
        name = basic_game_data.get('name') or (metadata and metadata.get('name'))
        
        if not app_id or not name:
            return None
        
        # Use metadata if available, otherwise basic data
        data_source = metadata if metadata else basic_game_data
        
        # Convert price format
        price = self.convert_price(data_source.get('price'))
        
        # Handle tags - ensure we have a dictionary with meaningful content
        tags = {}
        if metadata and metadata.get('tags'):
            if isinstance(metadata['tags'], dict):
                tags = metadata['tags']
        
        # Skip games without tags (can't contribute to preference learning)
        if not tags or len(tags) == 0:
            return None
        
        # Handle genres - convert single genre string to list
        genres = []
        if data_source.get('genre'):
            genre = data_source['genre']
            genres = [genre] if isinstance(genre, str) else genre
        
        # Build camelCase record (matching frontend expectations)
        record = {
            "appId": int(app_id),
            "name": name,
            "coverUrl": None,  # Not implemented yet - would need Steam store data
            "price": price,
            "developer": data_source.get('developer'),
            "publisher": data_source.get('publisher'),
            "tags": tags,
            "genres": genres,
            "reviewPos": data_source.get('positive'),
            "reviewNeg": data_source.get('negative'),
        }
        
        return record
    
    def filter_for_million_plus_owners(self, games_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Filter games to only include those with 1M+ owners.
        
        Args:
            games_data: Raw games data from SteamSpy /all
            
        Returns:
            List of games with 1M+ owners
        """
        million_plus_ranges = [
            "1,000,000 .. 2,000,000",
            "2,000,000 .. 5,000,000", 
            "5,000,000 .. 10,000,000",
            "10,000,000 .. 20,000,000",
            "20,000,000 .. 50,000,000",
            "50,000,000 .. 100,000,000",
            "100,000,000 .. 200,000,000"
        ]
        
        filtered_games = []
        
        for app_id_str, game_data in games_data.items():
            if not isinstance(game_data, dict):
                continue
                
            owners = game_data.get('owners')
            if owners in million_plus_ranges:
                filtered_games.append(game_data)
        
        return filtered_games
    
    async def collect_game_data(
        self, 
        max_pages: Optional[int] = None,
        batch_size: int = 50,
        max_games: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Collect complete game data directly from APIs.
        
        Args:
            max_pages: Maximum number of pages to fetch from /all endpoint
            batch_size: Number of concurrent metadata requests
            max_games: Maximum number of games to include in final output
            
        Returns:
            List of complete game records ready for JSON export
        """
        self.logger.info("Starting direct game data collection")
        
        all_games = []
        page = 0
        
        # Step 1: Collect basic game data from /all endpoint
        while True:
            if max_pages is not None and page >= max_pages:
                break
                
            if page > 0:
                print(f"⏰ Waiting for rate limit... fetching page {page} in ~60 seconds")
            
            try:
                # Fetch games page
                games_data = await self.fetch_games_page(page)
                
                # Stop if empty response
                if not games_data:
                    self.logger.info(f"No more data at page {page}, stopping collection")
                    break
                
                # Filter for 1M+ owners
                million_plus_games = self.filter_for_million_plus_owners(games_data)
                self.logger.info(f"Page {page}: {len(million_plus_games)} games with 1M+ owners")
                
                all_games.extend(million_plus_games)
                page += 1
                
                # Stop if we have enough games
                if len(all_games) >= max_games:
                    self.logger.info(f"Reached max games limit ({max_games}), stopping collection")
                    all_games = all_games[:max_games]
                    break
                    
            except Exception as e:
                self.logger.error(f"Error fetching page {page}: {e}")
                break
        
        self.logger.info(f"Collected {len(all_games)} games from {page} pages")
        
        # Step 2: Fetch detailed metadata for each game
        self.logger.info("Starting metadata collection...")
        complete_records = []
        
        for i in range(0, len(all_games), batch_size):
            batch = all_games[i:i + batch_size]
            batch_start = i + 1
            batch_end = min(i + batch_size, len(all_games))
            
            print(f"📊 Processing metadata batch {batch_start}-{batch_end} of {len(all_games)}")
            
            # Create tasks for concurrent metadata fetching
            tasks = []
            for game_data in batch:
                app_id = game_data.get('appid')
                if app_id:
                    task = self.fetch_game_metadata(int(app_id))
                    tasks.append((game_data, task))
            
            # Execute batch concurrently
            results = await asyncio.gather(*[task for _, task in tasks])
            
            # Process results and build complete records
            for (basic_data, _), metadata in zip(tasks, results):
                record = self.to_game_record(basic_data, metadata)
                
                if record:
                    complete_records.append(record)
                    
                    # Show progress with game name and top tags
                    top_tags = []
                    if record.get('tags'):
                        sorted_tags = sorted(record['tags'].items(), key=lambda x: x[1], reverse=True)
                        top_tags = [tag[0] for tag in sorted_tags[:3]]
                    
                    tags_display = ", ".join(top_tags) if top_tags else "No tags"
                    print(f"✅ {record['name']} ({tags_display})")
                    
                    # Exit early if we've reached max_games limit
                    if len(complete_records) >= max_games:
                        self.logger.info(f"Reached max_games limit ({max_games}), stopping metadata collection")
                        break
            
            # Break out of outer batch loop if we've reached the limit
            if len(complete_records) >= max_games:
                break
        
        self.logger.info(f"Generated {len(complete_records)} complete game records")
        
        # Step 3: Sort by popularity (score_rank if available, otherwise by owners estimate)
        # SteamSpy /all already returns in popularity order, so maintain that order
        return complete_records[:max_games]


async def generate_master_json(
    output_path: str,
    max_pages: Optional[int] = None,
    batch_size: int = 50,
    max_games: int = 1000
):
    """
    Generate master.json file directly from APIs.
    
    Args:
        output_path: Path where JSON file should be written
        max_pages: Maximum pages to fetch from SteamSpy /all
        batch_size: Concurrent requests for metadata
        max_games: Maximum games in output
    """
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    collector = DirectGameDataCollector()
    
    try:
        # Collect game data
        print(f"🎮 Starting direct collection (max_pages={max_pages}, max_games={max_games})")
        game_records = await collector.collect_game_data(
            max_pages=max_pages,
            batch_size=batch_size,
            max_games=max_games
        )
        
        # Ensure output directory exists
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Write to file
        print(f"💾 Writing {len(game_records)} games to {output_path}...")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(game_records, f, indent=2, ensure_ascii=False)
        
        # Calculate file size
        file_size = output_file.stat().st_size
        file_size_mb = file_size / (1024 * 1024)
        
        print(f"✅ Successfully generated master.json")
        print(f"📊 Games: {len(game_records)}")
        print(f"📁 Size: {file_size_mb:.1f} MB")
        print(f"📍 Path: {output_path}")
        
    except Exception as e:
        print(f"❌ Error generating master.json: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Generate master.json directly from SteamSpy APIs",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate with default settings (15 pages, ~1000 games)
  poetry run python scripts/generate_master_json_direct.py master.json
  
  # Generate smaller dataset for testing
  poetry run python scripts/generate_master_json_direct.py master.json --max-pages 5 --max-games 500
  
  # Generate full dataset for production
  poetry run python scripts/generate_master_json_direct.py master.json --max-pages 30 --max-games 2000
        """
    )
    
    parser.add_argument(
        'output_path',
        help='Path where the JSON file should be written'
    )
    parser.add_argument(
        '--max-pages',
        type=int,
        default=15,
        help='Maximum number of pages to fetch from SteamSpy /all (default: 15)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=50,
        help='Number of concurrent metadata requests (default: 50)'
    )
    parser.add_argument(
        '--max-games',
        type=int,
        default=1000,
        help='Maximum number of games in output (default: 1000)'
    )
    
    args = parser.parse_args()
    
    # Run async main function
    asyncio.run(generate_master_json(
        args.output_path,
        args.max_pages,
        args.batch_size,
        args.max_games
    ))


if __name__ == '__main__':
    main()