import json
from pathlib import Path

from utils.asr_metrics import char_error_rate, word_error_rate
from utils.caption_script import apply_output_script, snapshot_native
from utils.devanagari_romanize import romanize_nepali, romanize_timed_words
from utils.nepali_asr_correct import correct_nepali_asr
from utils.whisper_decode import get_transcription_config, requested_whisper_model


def test_quality_maps_to_requested_model():
    assert requested_whisper_model("ne", "fast") == "medium"
    assert requested_whisper_model("ne", "high_accuracy") == "large-v3"
    cfg = get_transcription_config(quality="high_accuracy", language="ne")
    assert cfg["requested_model"] == "large-v3"
    assert cfg["beam_size"] == 5


def test_canonical_devanagari_survives_romanize():
    cues = [
        snapshot_native({
            "id": 1,
            "start": 0,
            "end": 1.2,
            "text": "आज हाम्रो meeting छ।",
            "words": [{"text": "आज", "start": 0, "end": 0.3}],
        })
    ]
    out = apply_output_script(cues, output_script="roman", source_language="ne", respect_edits=False)
    assert "आज" in (out[0]["native_text"] or "")
    assert out[0]["original_text"] == out[0]["native_text"]
    assert "meeting" in out[0]["text"]
    assert "छ।" not in out[0]["text"]


def test_english_tokens_preserved():
    src = "आज हामी AI API YouTube Instagram Google ChatGPT software website coding meeting project छ।"
    out = romanize_nepali(src)
    for tok in ["AI", "API", "YouTube", "Instagram", "Google", "ChatGPT", "software", "website", "coding", "meeting", "project"]:
        assert tok in out


def test_numbers_ascii_and_devanagari_digits():
    assert "20" in romanize_nepali("२०")
    assert "20" in romanize_nepali("20")
    assert "2026" in romanize_nepali("२०२६")
    assert "2026" in romanize_nepali("2026")


def test_proper_nouns_gulmi_kathmandu():
    assert romanize_nepali("गुल्मी") == "Gulmi"
    assert "Kathmandu" in romanize_nepali("काठमाडौं")
    assert "Pokhara" in romanize_nepali("पोखरा")
    assert "Nepal" in romanize_nepali("नेपाल")
    assert "Butwal" in romanize_nepali("बुटवल")
    assert "Chitwan" in romanize_nepali("चितवन")


def test_correction_keeps_original_word_span():
    words = [{"text": "भएकोछ", "start": 1.0, "end": 1.8, "confidence": 0.5}]
    text, out = correct_nepali_asr("भएकोछ", words=words)
    assert "भएको" in text and "छ" in text
    assert len(out) == 2
    assert out[0]["start"] == 1.0 and out[0]["end"] == 1.8
    assert out[1]["start"] == 1.0 and out[1]["end"] == 1.8
    assert out[0]["end"] >= out[0]["start"]


def test_romanize_timing_monotonic():
    words = [
        {"text": "आज", "start": 0.0, "end": 0.4},
        {"text": "घर", "start": 0.4, "end": 0.9},
    ]
    out = romanize_timed_words(words)
    prev = -1.0
    for w in out:
        assert w["end"] >= w["start"]
        assert w["start"] >= prev - 1e-9
        prev = w["start"]


def test_wer_cer_helpers():
    assert word_error_rate("a b c", "a b c") == 0
    assert char_error_rate("abc", "abc") == 0
    assert word_error_rate("", "x") is None


def test_empty_asr_manifest_is_not_a_score():
    path = Path(__file__).resolve().parent / "tests" / "data" / "nepali_asr" / "manifest.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data.get("clips") == []
