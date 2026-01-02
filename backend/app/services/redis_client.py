from __future__ import annotations

from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Try to import Redis, but make it optional
try:
    from redis import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    Redis = None

from app.core.settings import settings

_redis_client: Optional["Redis"] = None
_redis_checked = False


class MockRedis:
    """Fallback mock Redis client when Redis is not available."""
    
    def __init__(self):
        self._data = {}
        
    def set(self, key, value, ex=None, px=None, nx=False, xx=False):
        self._data[key] = value
        return True
        
    def get(self, key):
        return self._data.get(key)
        
    def delete(self, *keys):
        count = 0
        for key in keys:
            if key in self._data:
                del self._data[key]
                count += 1
        return count
        
    def exists(self, *keys):
        return sum(1 for k in keys if k in self._data)
        
    def keys(self, pattern="*"):
        import fnmatch
        return [k for k in self._data.keys() if fnmatch.fnmatch(k, pattern)]
        
    def publish(self, channel, message):
        logger.debug(f"Mock publish to {channel}: {message}")
        return 0
        
    def ping(self):
        return True


def get_redis() -> "Redis":
    """Get Redis client, falling back to mock if unavailable."""
    global _redis_client, _redis_checked
    
    if _redis_client is not None:
        return _redis_client
        
    if not _redis_checked:
        _redis_checked = True
        
        if not REDIS_AVAILABLE:
            logger.warning("Redis package not installed. Using in-memory mock.")
            _redis_client = MockRedis()
            return _redis_client
            
        try:
            client = Redis.from_url(settings.redis_url, decode_responses=True)
            client.ping()
            _redis_client = client
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.warning(f"Redis not available ({e}). Using in-memory mock.")
            _redis_client = MockRedis()
            
    return _redis_client or MockRedis()
