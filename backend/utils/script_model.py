"""Caption language vs script. These are independent of Whisper language codes."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import HTTPException

SOURCE_LANGUAGES = {"auto", "ne", "hi", "en"}
OUTPUT_SCRIPTS = {"native", "roman"}
TRANSLITERATION_MODES = {"none", "romanized_nepali", "hinglish"}


def coerce_source_language(value: Optional[str]) -> str:
    """Background-safe: never raises. Invalid values become auto."""
    raw = (value or "auto").strip().lower()
    aliases = {
        "nepali": "ne",
        "hindi": "hi",
        "english": "en",
        "hinglish": "hi",
    }
    raw = aliases.get(raw, raw)
    return raw if raw in SOURCE_LANGUAGES else "auto"


def normalize_source_language(value: Optional[str]) -> str:
    if value is None or not str(value).strip():
        return "auto"
    probe = str(value).strip().lower()
    aliases = {
        "nepali": "ne",
        "hindi": "hi",
        "english": "en",
        "hinglish": "hi",
    }
    mapped = aliases.get(probe, probe)
    if mapped not in SOURCE_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported caption language. Use auto, ne, hi, or en.")
    return mapped


def coerce_output_script(value: Optional[str], source_language: str = "auto") -> str:
    raw = (value or "native").strip().lower()
    aliases = {"latin": "roman", "romanized": "roman", "devanagari": "native"}
    raw = aliases.get(raw, raw)
    if raw not in OUTPUT_SCRIPTS:
        raw = "native"
    if source_language == "en" and raw == "roman":
        return "native"
    return raw


def normalize_output_script(value: Optional[str], source_language: str = "auto") -> str:
    raw = (value or "native").strip().lower()
    aliases = {"latin": "roman", "romanized": "roman", "devanagari": "native"}
    raw = aliases.get(raw, raw)
    if raw not in OUTPUT_SCRIPTS:
        raise HTTPException(status_code=400, detail="Unsupported output script. Use native or roman.")
    return coerce_output_script(value, source_language)


def resolve_transliteration_mode(source_language: str, output_script: str) -> str:
    if output_script != "roman":
        return "none"
    if source_language == "en":
        return "none"
    if source_language == "hi":
        return "hinglish"
    return "romanized_nepali"


def coerce_transliteration_mode(value: Optional[str], source_language: str, output_script: str) -> str:
    expected = resolve_transliteration_mode(source_language, output_script)
    if not value:
        return expected
    raw = str(value).strip().lower()
    if raw not in TRANSLITERATION_MODES:
        return expected
    if output_script == "native" and raw != "none":
        return "none"
    if output_script == "roman" and raw == "none":
        return expected
    return raw


def normalize_transliteration_mode(value: Optional[str], source_language: str, output_script: str) -> str:
    if value and str(value).strip().lower() not in TRANSLITERATION_MODES:
        raise HTTPException(status_code=400, detail="Unsupported transliteration_mode.")
    return coerce_transliteration_mode(value, source_language, output_script)


def job_script_defaults(job: dict[str, Any]) -> dict[str, Any]:
    src = coerce_source_language(str(job.get("source_language") or job.get("language") or "auto"))
    script = coerce_output_script(str(job.get("output_script") or "native"), src)
    mode = coerce_transliteration_mode(job.get("transliteration_mode"), src, script)
    return {
        "source_language": src,
        "output_language": src,
        "output_script": script,
        "transliteration_mode": mode,
    }
