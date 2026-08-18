"""Post-ASR Nepali Unicode/spacing/punctuation normalization. Not applied to user edits."""

from __future__ import annotations

import re
import unicodedata

from utils.caption_text import is_devanagari_text, sanitize_caption_text


def normalize_nepali_text(text: str) -> str:
    if not text or not isinstance(text, str):
        return text or ""
    text = unicodedata.normalize("NFC", text)
    text = sanitize_caption_text(text)
    if not text:
        return ""
    if not is_devanagari_text(text):
        return text
    text = re.sub(r"(?<!\d)\.(?!\d)", "।", text)
    text = re.sub(r"।।+", "।", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([।?!.,;:])", r"\1", text)
    text = re.sub(r"([।?!])([^\s\d।?!])", r"\1 \2", text)
    return text.strip()
