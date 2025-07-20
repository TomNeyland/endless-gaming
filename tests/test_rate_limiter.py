import pytest
import asyncio
import time
from unittest.mock import Mock, patch, AsyncMock
import httpx

from utils.rate_limiter import SimpleRateLimiter, APIEndpoint
from utils.http_client import HTTPClient


class TestAPIEndpoint:
    """Test cases for APIEndpoint enum."""

    def test_api_endpoint_values(self):
        """Test that APIEndpoint enum has expected values and rate limits."""
        assert APIEndpoint.STEAM_WEB_API.value == "steam_web_api"
        assert APIEndpoint.STEAM_STORE_API.value == "steam_store_api"  
        assert APIEndpoint.STEAMSPY_API.value == "steamspy_api"

    def test_api_endpoint_rate_limits(self):
        """Test that each endpoint has proper rate limit configuration."""
        # This test will verify the rate limiter configuration
        # Implementation will define these limits
        rate_limiter = SimpleRateLimiter()
        
        # Test that each endpoint has different rate limits configured
        steam_web_limit = rate_limiter.get_limit(APIEndpoint.STEAM_WEB_API)
        steam_store_limit = rate_limiter.get_limit(APIEndpoint.STEAM_STORE_API)
        steamspy_limit = rate_limiter.get_limit(APIEndpoint.STEAMSPY_API)
        
        assert steam_web_limit != steam_store_limit
        assert steam_store_limit != steamspy_limit
        assert steam_web_limit != steamspy_limit


class TestSimpleRateLimiter:
    """Test cases for SimpleRateLimiter class."""

    def test_rate_limiter_initialization(self):
        """Test that rate limiter initializes correctly."""
        rate_limiter = SimpleRateLimiter()
        assert rate_limiter is not None
        
        # Test that it has proper configuration for all endpoints
        for endpoint in APIEndpoint:
            limit = rate_limiter.get_limit(endpoint)
            assert limit is not None

    def test_throttle_allows_initial_requests(self):
        """Test that throttle allows requests initially."""
        rate_limiter = SimpleRateLimiter()
        
        # First call should not block
        start_time = time.time()
        rate_limiter.throttle(APIEndpoint.STEAMSPY_API)
        elapsed = time.time() - start_time
        
        # Should complete almost immediately (< 0.1 seconds)
        assert elapsed < 0.1

    def test_throttle_blocks_when_rate_limit_exceeded(self):
        """Test that throttle blocks when rate limit is exceeded."""
        # Create rate limiter with very restrictive limits for testing
        rate_limiter = SimpleRateLimiter(test_mode=True)
        
        # Make several requests quickly
        start_time = time.time()
        for _ in range(3):
            rate_limiter.throttle(APIEndpoint.STEAMSPY_API)
        
        # Should have been throttled
        elapsed = time.time() - start_time
        assert elapsed > 0.1  # Should take some time due to throttling

    def test_different_endpoints_have_independent_limits(self):
        """Test that different API endpoints have independent rate limits."""
        rate_limiter = SimpleRateLimiter(test_mode=True)
        
        # Exhaust one endpoint
        for _ in range(5):
            rate_limiter.throttle(APIEndpoint.STEAMSPY_API)
        
        # Other endpoint should still work without delay
        start_time = time.time()
        rate_limiter.throttle(APIEndpoint.STEAM_WEB_API)
        elapsed = time.time() - start_time
        
        assert elapsed < 0.1  # Should not be throttled

    @pytest.mark.asyncio
    async def test_make_request_integration(self):
        """Test make_request method with mocked HTTP response."""
        rate_limiter = SimpleRateLimiter()
        
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {"test": "data"}
        mock_response.raise_for_status.return_value = None
        
        with patch('httpx.AsyncClient.get', return_value=mock_response) as mock_get:
            result = await rate_limiter.make_request(
                APIEndpoint.STEAM_WEB_API,
                "https://api.steampowered.com/test"
            )
            
            assert result == {"test": "data"}
            mock_get.assert_called_once()

    @pytest.mark.asyncio 
    async def test_make_request_retry_on_failure(self):
        """Test that make_request retries on network failures."""
        rate_limiter = SimpleRateLimiter()
        
        # Mock network error followed by success
        mock_error_response = Mock()
        mock_error_response.raise_for_status.side_effect = httpx.HTTPError("Network error")
        
        mock_success_response = Mock()
        mock_success_response.json.return_value = {"retry": "success"}
        mock_success_response.raise_for_status.return_value = None
        
        with patch('httpx.AsyncClient.get', side_effect=[mock_error_response, mock_success_response]) as mock_get:
            result = await rate_limiter.make_request(
                APIEndpoint.STEAM_WEB_API,
                "https://api.steampowered.com/test"
            )
            
            assert result == {"retry": "success"}
            assert mock_get.call_count == 2  # Should have retried once

    @pytest.mark.asyncio
    async def test_make_request_respects_rate_limit(self):
        """Test that make_request respects rate limiting."""
        rate_limiter = SimpleRateLimiter(test_mode=True)
        
        mock_response = Mock()
        mock_response.json.return_value = {"data": "test"}
        mock_response.raise_for_status.return_value = None
        
        with patch('httpx.AsyncClient.get', return_value=mock_response):
            # Make multiple requests and measure time
            start_time = time.time()
            
            requests = []
            for i in range(3):
                request = rate_limiter.make_request(
                    APIEndpoint.STEAMSPY_API,
                    f"https://steamspy.com/api.php?request=appdetails&appid={i}"
                )
                requests.append(request)
            
            results = await asyncio.gather(*requests)
            elapsed = time.time() - start_time
            
            # Should have been rate limited
            assert elapsed > 0.1
            assert len(results) == 3
            assert all(result == {"data": "test"} for result in results)


class TestHTTPClient:
    """Test cases for HTTP client integration."""

    @pytest.mark.asyncio
    async def test_http_client_initialization(self):
        """Test HTTP client initializes with proper configuration."""
        client = HTTPClient()
        assert client is not None
        assert hasattr(client, 'session')

    @pytest.mark.asyncio
    async def test_http_client_retry_logic(self):
        """Test HTTP client retry logic with exponential backoff."""
        client = HTTPClient()
        
        # Mock client that fails twice then succeeds
        with patch.object(client.session, 'get') as mock_get:
            # Configure mock to fail twice, then succeed
            mock_get.side_effect = [
                httpx.HTTPError("First failure"),
                httpx.HTTPError("Second failure"), 
                Mock(json=lambda: {"success": True}, raise_for_status=lambda: None)
            ]
            
            result = await client.get_with_retry("https://test.com")
            
            assert result == {"success": True}
            assert mock_get.call_count == 3

    @pytest.mark.asyncio
    async def test_http_client_timeout_handling(self):
        """Test HTTP client handles timeouts correctly."""
        client = HTTPClient()
        
        with patch.object(client.session, 'get') as mock_get:
            mock_get.side_effect = asyncio.TimeoutError("Request timeout")
            
            with pytest.raises(asyncio.TimeoutError):
                await client.get_with_retry("https://test.com", max_retries=1)


class TestRateLimiterIntegration:
    """Integration tests for rate limiter with HTTP client."""

    @pytest.mark.asyncio
    async def test_concurrent_requests_shared_rate_limiter(self):
        """Test that concurrent requests share the same rate limiter."""
        rate_limiter = SimpleRateLimiter(test_mode=True)
        
        mock_response = Mock()
        mock_response.json.return_value = {"concurrent": "test"}
        mock_response.raise_for_status.return_value = None
        
        with patch('httpx.AsyncClient.get', return_value=mock_response):
            # Create multiple concurrent requests
            tasks = []
            for i in range(5):
                task = rate_limiter.make_request(
                    APIEndpoint.STEAMSPY_API,
                    f"https://steamspy.com/api.php?request=appdetails&appid={i}"
                )
                tasks.append(task)
            
            start_time = time.time()
            results = await asyncio.gather(*tasks)
            elapsed = time.time() - start_time
            
            # All requests should complete
            assert len(results) == 5
            assert all(result == {"concurrent": "test"} for result in results)
            
            # Should have taken some time due to rate limiting
            assert elapsed > 0.2

    @pytest.mark.asyncio 
    async def test_rate_limiter_preserves_order_within_limits(self):
        """Test that rate limiter processes requests in reasonable order."""
        rate_limiter = SimpleRateLimiter()
        
        request_order = []
        
        def track_request(url, **kwargs):
            request_order.append(url)
            mock_response = Mock()
            mock_response.json.return_value = {"url": url}
            mock_response.raise_for_status.return_value = None
            return mock_response
        
        with patch('httpx.AsyncClient.get', side_effect=track_request):
            urls = [f"https://test.com/{i}" for i in range(3)]
            tasks = [
                rate_limiter.make_request(APIEndpoint.STEAM_WEB_API, url)
                for url in urls
            ]
            
            results = await asyncio.gather(*tasks)
            
            # All requests should complete successfully
            assert len(results) == 3
            assert len(request_order) == 3