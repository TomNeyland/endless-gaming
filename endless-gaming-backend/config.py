"""
Configuration settings for Steam data collection system.
"""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Database
    database_url: str = "sqlite:///steam_games.db"
    
    # Rate Limits
    steam_web_api_limit: str = "100000/day"
    steam_store_api_limit: str = "200/5minutes" 
    steamspy_api_limit: str = "60/minute"
    
    # Processing
    max_workers: int = 3
    batch_size: int = 50
    
    # Retry
    retry_attempts: int = 3
    
    # Logging
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"


settings = Settings()