"""Deterministic Nepali ASR correction. No LLM. Confidence-gated token replacements."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from utils.caption_text import is_devanagari_text
from utils.nepali_normalize import normalize_nepali_text

DATA = Path(__file__).resolve().parent.parent / "data"
HIGH_CONF = 0.85
VERY_LOW = 0.35


@lru_cache(maxsize=1)
def _confusions() -> dict:
    path = DATA / "nepali_asr_confusions.json"
    if not path.is_file():
        return {"always": {}, "agglutination": {}, "context": []}
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _punct_split(token: str) -> tuple[str, str]:
    core = token.rstrip("।.!?,;:")
    return core, token[len(core):]


def correct_token(
    token: str,
    *,
    prev: str = "",
    nxt: str = "",
    confidence: Optional[float] = None,
) -> str:
    if not token or not is_devanagari_text(token):
        return token
    data = _confusions()
    core, punct = _punct_split(token)
    always = data.get("always") or {}
    agglut = data.get("agglutination") or {}

    if core in always:
        return always[core] + punct
    if core in agglut:
        if confidence is not None and confidence >= HIGH_CONF:
            return agglut[core] + punct
        if confidence is None or confidence >= VERY_LOW:
            return agglut[core] + punct

    if confidence is not None and confidence >= HIGH_CONF:
        return token
    if confidence is not None and confidence < VERY_LOW:
        return token

    for rule in data.get("context") or []:
        if rule.get("token") != core:
            continue
        if rule.get("prev") and _punct_split(prev)[0] != rule["prev"]:
            continue
        if rule.get("next") and _punct_split(nxt)[0] != rule["next"]:
            continue
        return (rule.get("to") or core) + punct
    return token


def correct_nepali_asr(
    text: str,
    *,
    words: Optional[list[dict[str, Any]]] = None,
    confidence: float = 1.0,
) -> tuple[str, list[dict[str, Any]] | None]:
    """Return (corrected_text, corrected_words_or_None). Does not invent text for empty input."""
    if not text:
        return "", words
    normalized = normalize_nepali_text(text)
    if not is_devanagari_text(normalized):
        return normalized, words

    if words:
        out_words: list[dict[str, Any]] = []
        for i, w in enumerate(words):
            src = w.get("text") or ""
            prev = (words[i - 1].get("text") or "") if i else ""
            nxt = (words[i + 1].get("text") or "") if i + 1 < len(words) else ""
            conf = w.get("confidence")
            if conf is None:
                conf = confidence
            fixed = correct_token(src, prev=prev, nxt=nxt, confidence=conf)
            parts = [p for p in fixed.split() if p]
            if not parts:
                out_words.append({**w, "text": src})
                continue
            if len(parts) == 1:
                out_words.append({**w, "text": parts[0]})
                continue
            start = float(w.get("start") or 0)
            end = float(w.get("end") or start)
            if end < start:
                end = start
            for part in parts:
                out_words.append({
                    **w,
                    "text": part,
                    "start": round(start, 3),
                    "end": round(end, 3),
                })
        joined = " ".join(x["text"] for x in out_words)
        joined = normalize_nepali_text(joined) or joined
        return joined, out_words

    tokens = normalized.split()
    fixed_tokens = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        piece = correct_token(tok, prev=prev, nxt=nxt, confidence=confidence)
        fixed_tokens.extend(piece.split())
    return normalize_nepali_text(" ".join(fixed_tokens)), words
