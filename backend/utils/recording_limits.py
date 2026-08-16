"""Limits for browser voice recordings (server-enforced)."""

from __future__ import annotations

# Browser WebM often reports duration 0 via ffprobe; that is not "too short".
MAX_RECORDING_DURATION_SECONDS = 1800  # 30 minutes


def recording_duration_error(duration: float) -> str | None:
    """Reject only when duration is known and above the cap. Unknown/zero is allowed."""
    try:
        value = float(duration)
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None
    if value > MAX_RECORDING_DURATION_SECONDS + 1.0:
        return "RECORDING_TOO_LONG"
    return None
