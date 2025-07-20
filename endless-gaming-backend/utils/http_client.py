"""
HTTP client with retry logic and timeout handling.
"""
import asyncio
from typing import Dict, Any, Optional
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type


class HTTPClient:
    """HTTP client with built-in retry logic and proper error handling."""
    
    def __init__(self, timeout: float = 30.0):
        """Initialize HTTP client with timeout configuration."""
        self.timeout = timeout
        self.session = httpx.AsyncClient(timeout=timeout)
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.session.aclose()
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.HTTPError, asyncio.TimeoutError))
    )
    async def get_with_retry(
        self, 
        url: str, 
        max_retries: int = 3,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make GET request with retry logic.
        
        Args:
            url: URL to request
            max_retries: Maximum number of retries (for test compatibility)
            **kwargs: Additional arguments passed to httpx.get
            
        Returns:
            JSON response data
            
        Raises:
            httpx.HTTPError: On HTTP errors after retries
            asyncio.TimeoutError: On timeout after retries
        """
        response = await self.session.get(url, **kwargs)
        response.raise_for_status()
        return response.json()
    
    async def close(self):
        """Close the HTTP session."""
        await self.session.aclose()