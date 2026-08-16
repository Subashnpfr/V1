"""Cue timing invariants for save/burn."""

from __future__ import annotations

import math
from typing import Any, Dict, List

from fastapi import HTTPException


def _finite_nonneg(value: Any, field: str) -> float:
    try:
        num = float(value)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid {field}") from exc
    if not math.isfinite(num) or num < 0:
        raise HTTPException(status_code=422, detail=f"Invalid {field}")
    if num > 24 * 3600 * 12:
        raise HTTPException(status_code=422, detail=f"{field} is unreasonably large")
    return round(num, 3)


def validate_cues(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    cleaned = []
    for idx, item in enumerate(items):
        start = _finite_nonneg(item.get("start"), "start")
        end = _finite_nonneg(item.get("end"), "end")
        if end < start:
            raise HTTPException(status_code=422, detail=f"Cue {idx + 1}: end must be >= start")
        text = item.get("text") if isinstance(item.get("text"), str) else ""
        if len(text) > 8000:
            raise HTTPException(status_code=422, detail="Cue text too long")
        words = item.get("words") or []
        if not isinstance(words, list):
            words = []
        extra = {}
        native = item.get("native_text")
        if isinstance(native, str) and native:
            extra["native_text"] = native[:8000]
        nw = item.get("native_words")
        if isinstance(nw, list):
            extra["native_words"] = nw
        if "text_edited" in item:
            extra["text_edited"] = bool(item.get("text_edited"))
        cleaned.append({
            "id": int(item.get("id") or idx + 1),
            "start": start,
            "end": end,
            "text": text,
            "words": words,
            **extra,
        })
    return cleaned
