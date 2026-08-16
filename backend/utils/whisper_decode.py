"""Whisper decode settings. Nepali/Hindi use beam search; English stays greedy for speed."""

from __future__ import annotations

from typing import Optional

NEPALI_INITIAL_PROMPT = "नेपाली संवाद। तपाईंलाई कस्तो छ? म आज घर जाँदै छु।"
HINDI_INITIAL_PROMPT = "हिन्दी बातचीत। आप कैसे हैं?"


def whisper_transcribe_options(language: Optional[str]) -> dict:
    accurate = language in {"ne", "hi"}
    opts: dict = {
        "beam_size": 5 if accurate else 1,
        "best_of": 5 if accurate else 1,
        "temperature": 0.0,
        "condition_on_previous_text": False,
        "vad_filter": True,
        "vad_parameters": {
            "min_silence_duration_ms": 400,
            "speech_pad_ms": 400 if accurate else 200,
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
