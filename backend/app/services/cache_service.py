import time
import threading
from functools import wraps
from typing import Any

_cache: dict[str, tuple[Any, float]] = {}
_lock = threading.Lock()
DEFAULT_TTL = 1800  # 30 minutes


def cached(ttl: int = DEFAULT_TTL):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{args}:{sorted(kwargs.items())}"
            with _lock:
                if key in _cache:
                    value, expires_at = _cache[key]
                    if time.time() < expires_at:
                        return value
            result = func(*args, **kwargs)
            with _lock:
                _cache[key] = (result, time.time() + ttl)
            return result
        return wrapper
    return decorator


def clear_cache():
    with _lock:
        _cache.clear()
