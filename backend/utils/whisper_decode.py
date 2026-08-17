"""Whisper decode settings. Quality mode selects beam/model; language is separate."""

from __future__ import annotations

from typing import Optional

from utils.transcription_quality import coerce_transcription_quality

NEPALI_INITIAL_PROMPT = "नेपाली संवाद। तपाईंलाई कस्तो छ? म आज घर जाँदै छु।"
HINDI_INITIAL_PROMPT = "हिन्दी बातचीत। आप कैसे हैं?"


def requested_whisper_model(language: Optional[str], quality: Optional[str] = "fast") -> str:
    q = coerce_transcription_quality(quality)
    if language == "en":
        return "small"
    if language == "ne" and q == "high_accuracy":
        return "large-v3"
    return "medium"


def whisper_transcribe_options(
    language: Optional[str],
    quality: Optional[str] = "fast",
) -> dict:
    high = coerce_transcription_quality(quality) == "high_accuracy"
    accurate_lang = language in {"ne", "hi"}
    if high:
        beam = 5
    elif accurate_lang:
        beam = 3
    else:
        beam = 1
    opts: dict = {
        "beam_size": beam,
        "best_of": beam,
        "temperature": 0.0,
        "condition_on_previous_text": False,
        "vad_filter": True,
        "vad_parameters": {
            "min_silence_duration_ms": 400,
            "speech_pad_ms": 400 if (high or accurate_lang) else 200,
        },
        "word_timestamps": True,
    }
    if language == "ne":
        opts["initial_prompt"] = NEPALI_INITIAL_PROMPT
    elif language == "hi":
        opts["initial_prompt"] = HINDI_INITIAL_PROMPT
    if language:
        opts["language"] = language
    return opts


def get_transcription_config(
    *,
    quality: Optional[str] = "fast",
    language: Optional[str] = None,
) -> dict:
    """Single source of ASR configuration. Not a second pipeline."""
    q = coerce_transcription_quality(quality)
    decode = whisper_transcribe_options(language, q)
    return {
        "quality": q,
        "language": language,
        "requested_model": requested_whisper_model(language, q),
        "beam_size": decode["beam_size"],
        "vad_enabled": bool(decode.get("vad_filter")),
        "decode": decode,
    }
