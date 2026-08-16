"""Caption text invariants: language-aware cleanup of Whisper artifacts."""

from __future__ import annotations

import re
import unicodedata

DEVANAGARI_RE = re.compile(r"[\u0900-\u097F]")
LATIN_RE = re.compile(r"[A-Za-z]")
JUNK_TOKEN_RE = re.compile(
    r"^(?:[|¦]+|♪+|♫+|…+|\.{2,}|[-–—]+|/+|\\+|\[(?:music|applause|laughter|inaudible)\]|\((?:music|applause)\))$",
    re.IGNORECASE,
)


def is_devanagari_text(text: str) -> bool:
    if not text:
        return False
    letters = DEVANAGARI_RE.findall(text) + LATIN_RE.findall(text)
    if not letters:
        return False
    dev = len(DEVANAGARI_RE.findall(text))
    return (dev / len(letters)) >= 0.3


def is_junk_token(token: str) -> bool:
    t = (token or "").strip()
    if not t:
        return True
    return bool(JUNK_TOKEN_RE.match(t))


def sanitize_caption_text(text: str) -> str:
    """Strip Whisper junk and keep Nepali danda only on Devanagari text."""
    if not text or not isinstance(text, str):
        return ""

    text = unicodedata.normalize("NFC", text)
    text = text.replace("\u00a0", " ")
    text = text.replace("|", " ")
    text = text.replace("¦", " ")
    text = re.sub(r"[♪♫]+", " ", text)
    text = re.sub(r"\[(?:music|applause|laughter|inaudible)\]", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\((?:music|applause)\)", " ", text, flags=re.IGNORECASE)

    tokens = [tok for tok in text.split() if not is_junk_token(tok)]
    text = " ".join(tokens)

    if not is_devanagari_text(text):
        text = text.replace("।", ".")
        text = re.sub(r"\.{2,}", ".", text)
        text = re.sub(r"\s+([.,!?;:])", r"\1", text)
        text = re.sub(r"^[.,;:]+|[.,;:]+$", "", text)

    text = re.sub(r"\s+", " ", text).strip()
    return text
