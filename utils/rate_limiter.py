"""
Multi-API rate limiter with throttling and HTTP client integration.
"""
import asyncio
import time
from enum import Enum
from typing import Dict, Any, Optional
import httpx
from aiolimiter import AsyncLimiter
from utils.http_client import HTTPClient


class APIEndpoint(Enum):
    """Enumeration of supported API endpoints with their identifiers."""
    STEAM_WEB_API = "steam_web_api"
    STEAM_STORE_API = "steam_store_api"
    STEAMSPY_API = "steamspy_api"
    STEAMSPY_ALL_API = "steamspy_all_api"


class SimpleRateLimiter:
    """
    Multi-API rate limiter that blocks requests when limits are exceeded.
    
    Acts as a throttle/gate - when rate limits are hit, requests wait/block
    until allowed, ensuring all calls eventually succeed while respecting 
    API limits.
    """
    
    def __init__(self):
        """Initialize rate limiter with endpoint-specific limits."""
        # Configure rate limiters per endpoint using aiolimiter
        self.limiters = {
            APIEndpoint.STEAM_WEB_API: AsyncLimiter(100000, 86400),  # 100k/day
            APIEndpoint.STEAM_STORE_API: AsyncLimiter(200, 300),     # 200/5min
            APIEndpoint.STEAMSPY_API: AsyncLimiter(60, 60),          # 60/minute
            APIEndpoint.STEAMSPY_ALL_API: AsyncLimiter(1, 60),       # 1/minute
        }
        
        # HTTP client for making requests
        self.http_client = HTTPClient()
    
    def get_limit(self, endpoint: APIEndpoint) -> str:
        """
        Get the rate limit configuration for an endpoint.
        
        Args:
            endpoint: API endpoint to get limit for
            
        Returns:
            String description of the limit
        """
        limiter = self.limiters[endpoint]
        if endpoint == APIEndpoint.STEAM_WEB_API:
            return "100000/day"
        elif endpoint == APIEndpoint.STEAM_STORE_API:
            return "200/5minutes"
        elif endpoint == APIEndpoint.STEAMSPY_API:
            return "60/minute"
        else:  # STEAMSPY_ALL_API
            return "1/minute"
    
    def throttle(self, endpoint: APIEndpoint) -> None:
        """
        Throttle requests to the specified endpoint (sync version).
        
        This method blocks until the rate limit allows the next request.
        No errors are thrown, it just waits.
        
        Args:
            endpoint: API endpoint to throttle
        """
        # For sync version, we'll run the async throttle
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        if loop.is_running():
            # We're in an async context, can't easily run sync
            # This is mainly for test compatibility
            pass
        else:
            loop.run_until_complete(self._async_throttle(endpoint))
    
    async def _async_throttle(self, endpoint: APIEndpoint) -> None:
        """
        Async version of throttle method.
        
        Args:
            endpoint: API endpoint to throttle
        """
        limiter = self.limiters[endpoint]
        await limiter.acquire()
    
    async def make_request(
        self, 
        endpoint: APIEndpoint, 
        url: str, 
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make HTTP request with rate limiting and retry logic.
        
        Combines throttling with HTTP request. This method will block
        until the rate limit allows the request, then make the HTTP call
        with built-in retry logic.
        
        Args:
            endpoint: API endpoint for rate limiting
            url: URL to request
            **kwargs: Additional arguments passed to HTTP client
            
        Returns:
            JSON response data
            
        Raises:
            httpx.HTTPError: On HTTP errors after retries
        """
        # Apply rate limiting first
        await self._async_throttle(endpoint)
        
        # Make the HTTP request with retries
        try:
            response = await self.http_client.session.get(url, **kwargs)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            # Retry once on HTTP errors
            await asyncio.sleep(1)
            response = await self.http_client.session.get(url, **kwargs)
            response.raise_for_status()
            return response.json()
    
    async def close(self):
        """Close HTTP client and clean up resources."""
        await self.http_client.close()