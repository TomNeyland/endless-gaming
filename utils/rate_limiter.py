"""
Rate limiter - placeholder for TDD cycle.
This file intentionally incomplete to make tests fail initially.
"""
from enum import Enum

class APIEndpoint(Enum):
    STEAM_WEB_API = "steam_web_api"
    STEAM_STORE_API = "steam_store_api"
    STEAMSPY_API = "steamspy_api"

class SimpleRateLimiter:
    pass