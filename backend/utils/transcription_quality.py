"""Fast vs high-accuracy Whisper configuration. Isolated from script/language."""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

QUALITY_MODES = {"fast", "high_accuracy"}


def coerce_transcription_quality(value: Optional[str]) -> str:
    raw = (value or "fast").strip().lower().replace("-", "_")
    aliases = {
        "accurate": "high_accuracy",
        "high": "high_accuracy",
        "quality": "high_accuracy",
        "speed": "fast",
        "default": "fast",
    }
    raw = aliases.get(raw, raw)
    return raw if raw in QUALITY_MODES else "fast"


def normalize_transcription_quality(value: Optional[str]) -> str:
    if value is None or not str(value).strip():
        return "fast"
    raw = coerce_transcription_quality(value)
    probe = str(value).strip().lower().replace("-", "_")
    aliases = {
        "accurate": "high_accuracy",
        "high": "high_accuracy",
        "quality": "high_accuracy",
        "speed": "fast",
        "default": "fast",
        "fast": "fast",
        "high_accuracy": "high_accuracy",
    }
    if aliases.get(probe, probe) not in QUALITY_MODES:
        raise HTTPException(status_code=400, detail="Unsupported transcription_quality. Use fast or high_accuracy.")
    return raw
