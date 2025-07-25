"""
Utility functions for the discovery API.

Contains helper functions for converting database models to API responses.
"""
import json
from typing import Dict, Any
from models.game import Game
from models.game_metadata import GameMetadata
from models.storefront_data import StorefrontData


def to_game_record(game: Game) -> Dict[str, Any]:
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
        "screenshots": storefront.screenshots if storefront else None,
        "movies": storefront.movies if storefront else None,
        
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