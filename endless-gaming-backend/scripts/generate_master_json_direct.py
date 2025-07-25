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
    
    async def fetch_storefront_data(self, app_id: int) -> Optional[Dict[str, Any]]:
        """
        Fetch storefront data for a single game from Steam Store API.
        
        Args:
            app_id: Steam application ID
            
        Returns:
            Game storefront data dict or None if not found/failed
        """
        url = f"https://store.steampowered.com/api/appdetails?appids={app_id}"
        
        try:
            response_data = await self.rate_limiter.make_request(
                APIEndpoint.STEAM_STORE_APPDETAILS_API, url
            )
            
            # Steam Store API returns data in format: {"app_id": {"success": bool, "data": {...}}}
            app_data = response_data.get(str(app_id))
            if not app_data or not app_data.get('success'):
                return None
                
            return app_data.get('data', {})
            
        except Exception as e:
            self.logger.warning(f"Failed to fetch storefront data for app_id {app_id}: {e}")
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
    
    def to_game_record(self, basic_game_data: Dict[str, Any], metadata: Optional[Dict[str, Any]], storefront_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        Convert game data to master.json format.
        
        Args:
            basic_game_data: Basic game data from /all endpoint
            metadata: Detailed metadata from individual API call
            storefront_data: Storefront data from Steam Store API
            
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
        
        # Extract release date from storefront data
        release_date = None
        if storefront_data and storefront_data.get('release_date') and storefront_data['release_date'].get('date'):
            release_date = storefront_data['release_date']['date']
        
        # Build camelCase record (matching frontend expectations) with ALL available fields
        record = {
            "appId": int(app_id),
            "name": name,
            # Steam Store API fields
            "coverUrl": storefront_data.get('header_image') if storefront_data else None,
            "shortDescription": storefront_data.get('short_description') if storefront_data else None,
            "detailedDescription": storefront_data.get('detailed_description') if storefront_data else None,
            "isFree": storefront_data.get('is_free') if storefront_data else None,
            "requiredAge": storefront_data.get('required_age') if storefront_data else None,
            "website": storefront_data.get('website') if storefront_data else None,
            "releaseDate": release_date,
            "developers": storefront_data.get('developers') if storefront_data else [data_source.get('developer')] if data_source.get('developer') else None,
            "publishers": storefront_data.get('publishers') if storefront_data else [data_source.get('publisher')] if data_source.get('publisher') else None,
            "storeGenres": storefront_data.get('genres') if storefront_data else None,
            "categories": storefront_data.get('categories') if storefront_data else None,
            "supportedLanguages": storefront_data.get('supported_languages') if storefront_data else None,
            "priceData": storefront_data.get('price_overview') if storefront_data else None,
            "pcRequirements": storefront_data.get('pc_requirements') if storefront_data else None,
            "screenshots": storefront_data.get('screenshots') if storefront_data else None,
            "movies": storefront_data.get('movies') if storefront_data else None,
            # SteamSpy fields (preserved)
            "price": price,
            "developer": data_source.get('developer'),  # Keep for backwards compatibility
            "publisher": data_source.get('publisher'),  # Keep for backwards compatibility
            "tags": tags,
            "genres": genres,  # SteamSpy genres (different from Steam Store genres)
            "reviewPos": data_source.get('positive'),
            "reviewNeg": data_source.get('negative'),
        }
        
        return record
    
    
    async def collect_game_data(
        self, 
        max_pages: Optional[int] = None,
        batch_size: int = 50,
        max_games: int = 1000,
        skip_storefront: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Collect complete game data directly from APIs.
        
        Args:
            max_pages: Maximum number of pages to fetch from /all endpoint
            batch_size: Number of concurrent metadata requests
            max_games: Maximum number of games to include in final output
            skip_storefront: Skip Steam Store data collection (faster)
            
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
                
                # Convert to list and take all games from this page
                page_games = list(games_data.values())
                self.logger.info(f"Page {page}: {len(page_games)} games fetched")
                
                all_games.extend(page_games)
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
        
        # Step 2: Fetch detailed metadata and storefront data for each game
        self.logger.info("Starting metadata and storefront data collection...")
        complete_records = []
        
        for i in range(0, len(all_games), batch_size):
            batch = all_games[i:i + batch_size]
            batch_start = i + 1
            batch_end = min(i + batch_size, len(all_games))
            
            print(f"📊 Processing batch {batch_start}-{batch_end} of {len(all_games)}")
            
            # Create tasks for concurrent metadata and storefront data fetching
            metadata_tasks = []
            storefront_tasks = []
            
            for game_data in batch:
                app_id = game_data.get('appid')
                if app_id:
                    # Metadata task (SteamSpy)
                    metadata_task = self.fetch_game_metadata(int(app_id))
                    metadata_tasks.append((game_data, metadata_task))
                    
                    # Storefront data task (Steam Store API) - if not skipped
                    if not skip_storefront:
                        storefront_task = self.fetch_storefront_data(int(app_id))
                        storefront_tasks.append((game_data, storefront_task))
                    else:
                        storefront_tasks.append((game_data, None))
            
            # Execute metadata batch concurrently
            print(f"🔄 Fetching SteamSpy metadata for {len(metadata_tasks)} games...")
            metadata_results = await asyncio.gather(*[task for _, task in metadata_tasks])
            
            # Execute storefront data batch concurrently (if not skipped)
            storefront_results = []
            if not skip_storefront:
                print(f"🏪 Fetching Steam Store data for {len(storefront_tasks)} games...")
                print("⏰ Note: Steam Store API is rate limited to 1 request per second")
                storefront_results = await asyncio.gather(*[task for _, task in storefront_tasks if task is not None])
            else:
                storefront_results = [None] * len(metadata_results)
            
            # Process results and build complete records
            for (basic_data, _), metadata, storefront_data in zip(metadata_tasks, metadata_results, storefront_results):
                record = self.to_game_record(basic_data, metadata, storefront_data)
                
                if record:
                    complete_records.append(record)
                    
                    # Show progress with game name and top tags
                    top_tags = []
                    if record.get('tags'):
                        sorted_tags = sorted(record['tags'].items(), key=lambda x: x[1], reverse=True)
                        top_tags = [tag[0] for tag in sorted_tags[:3]]
                    
                    tags_display = ", ".join(top_tags) if top_tags else "No tags"
                    storefront_status = " + storefront" if storefront_data else ""
                    print(f"✅ {record['name']} ({tags_display}){storefront_status}")
                    
                    # Exit early if we've reached max_games limit
                    if len(complete_records) >= max_games:
                        self.logger.info(f"Reached max_games limit ({max_games}), stopping data collection")
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
    max_games: int = 1000,
    skip_storefront: bool = False
):
    """
    Generate master.json file directly from APIs.
    
    Args:
        output_path: Path where JSON file should be written
        max_pages: Maximum pages to fetch from SteamSpy /all
        batch_size: Concurrent requests for metadata
        max_games: Maximum games in output
        skip_storefront: Skip Steam Store data collection (faster)
    """
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    collector = DirectGameDataCollector()
    
    try:
        # Collect game data
        storefront_msg = " (skip storefront)" if skip_storefront else " + storefront data"
        print(f"🎮 Starting direct collection (max_pages={max_pages}, max_games={max_games}){storefront_msg}")
        game_records = await collector.collect_game_data(
            max_pages=max_pages,
            batch_size=batch_size,
            max_games=max_games,
            skip_storefront=skip_storefront
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
    parser.add_argument(
        '--skip-storefront',
        action='store_true',
        help='Skip Steam Store data collection for faster processing'
    )
    
    args = parser.parse_args()
    
    # Run async main function
    asyncio.run(generate_master_json(
        args.output_path,
        args.max_pages,
        args.batch_size,
        args.max_games,
        args.skip_storefront
    ))


if __name__ == '__main__':
    main()