# Created by Subash Nepal · nepalsubash.com.np
"""
Nepali text correction — delegates to the full nepali_nlp pipeline
only when the line is Devanagari. English/mixed Latin is sanitized only.
"""

import sys
from pathlib import Path

_backend_root = Path(__file__).resolve().parent.parent
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from nepali_nlp import process_nepali_vyakaran_pipeline
from utils.caption_text import is_devanagari_text, sanitize_caption_text


def process_nepali_correction_pipeline(text: str) -> str:
    """Guaranteed never to raise — returns original text on pipeline failure."""
    if not text or not isinstance(text, str):
        return text or ""

    try:
        cleaned = sanitize_caption_text(text)
        if not cleaned:
            return ""
        if is_devanagari_text(cleaned):
            return process_nepali_vyakaran_pipeline(cleaned)
        return cleaned
    except Exception as e:
        print(f"[Grammar] Fail-safe caught error: {e}")
        return sanitize_caption_text(text)
