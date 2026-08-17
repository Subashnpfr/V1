"""Apply native vs roman script to caption cues without touching Whisper."""

from __future__ import annotations

from typing import Any

from utils.devanagari_romanize import romanize_nepali, romanize_timed_words
from utils.script_model import resolve_transliteration_mode


def snapshot_native(cue: dict[str, Any]) -> dict[str, Any]:
    item = dict(cue)
    if not item.get("native_text"):
        item["native_text"] = item.get("original_text") or item.get("text") or ""
    item["original_text"] = item.get("native_text") or ""
    if item.get("native_words") is None and item.get("words") is not None:
        item["native_words"] = [dict(w) for w in item["words"]]
    item.setdefault("text_edited", False)
    return item


def apply_output_script(
    cues: list[dict[str, Any]],
    *,
    output_script: str,
    source_language: str = "auto",
    transliteration_mode: str | None = None,
    respect_edits: bool = True,
) -> list[dict[str, Any]]:
    mode = transliteration_mode or resolve_transliteration_mode(source_language, output_script)
    result = []
    for cue in cues:
        item = snapshot_native(cue)
        if respect_edits and item.get("text_edited"):
            result.append(item)
            continue
        native = item.get("native_text") or ""
        native_words = item.get("native_words")
        if mode == "none" or output_script == "native":
            item["text"] = native
            if native_words is not None:
                item["words"] = [dict(w) for w in native_words]
        else:
            try:
                item["text"] = romanize_nepali(native)
                item["words"] = romanize_timed_words(
                    native_words if native_words is not None else item.get("words")
                )
            except Exception:
                item["text"] = native
                if native_words is not None:
                    item["words"] = [dict(w) for w in native_words]
        item["transliteration_mode"] = mode
        result.append(item)
    return result
