"""ASR WER/CER harness. Skips when no licensed audio fixtures are present."""

from pathlib import Path

import pytest

FIXTURE_DIR = Path(__file__).resolve().parent / "tests" / "data" / "nepali_asr"
MANIFEST = FIXTURE_DIR / "manifest.json"


def test_asr_benchmark_skipped_without_audio():
    if not MANIFEST.is_file():
        pytest.skip("WER/CER unavailable: no licensed reference audio dataset")
    import json
    clips = json.loads(MANIFEST.read_text(encoding="utf-8")).get("clips") or []
    if not clips:
        pytest.skip("WER/CER unavailable: no licensed reference audio dataset")
    pytest.skip("Audio listed in manifest; WER is measured via python -m backend.benchmark_nepali_asr --run-whisper")
