"""Simple in-memory rate limiting for auth endpoints."""

from __future__ import annotations

import time
from collections import defaultdict

_buckets: dict[str, list[float]] = defaultdict(list)


def allow(key: str, *, limit: int = 10, window_sec: int = 60) -> bool:
    now = time.time()
    hits = [t for t in _buckets[key] if now - t < window_sec]
    if len(hits) >= limit:
        _buckets[key] = hits
        return False
    hits.append(now)
    _buckets[key] = hits
    return True


def reset_for_tests() -> None:
    _buckets.clear()
