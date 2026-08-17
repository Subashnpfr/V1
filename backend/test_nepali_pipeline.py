from utils.devanagari_romanize import romanize_caption, romanize_nepali
from utils.nepali_asr_correct import correct_nepali_asr, correct_token
from utils.nepali_normalize import normalize_nepali_text
from utils.transcription_quality import coerce_transcription_quality, normalize_transcription_quality
from utils.whisper_decode import whisper_transcribe_options
from utils.ass_text import wrap_caption_lines, escape_ass_text
from fastapi import HTTPException
import pytest


GOLDENS = [
    ("तपाईंलाई कस्तो छ?", "Tapailai kasto chha?"),
    ("म आज घर जाँदै छु।", "Ma aaja ghar jaandai chu."),
    ("म आज काठमाडौं जाँदै छु।", "Ma aaja Kathmandu jaandai chu."),
    ("मेरो नाम सुरज हो।", "Mero naam Suraj ho."),
    ("काठमाडौं नेपालको राजधानी हो।", "Kathmandu Nepal ko rajdhani ho."),
    ("आज हाम्रो meeting छ।", "Aaja hamro meeting chha."),
    ("मेरो exam next week छ।", "Mero exam next week chha."),
    ("मेरो उमेर २० वर्ष हो।", "Mero umer 20 barsa ho."),
    ("तपाईं कहाँ जाँदै हुनुहुन्छ?", "Tapai kaha jaandai hunuhunchha?"),
    ("के छ खबर?", "Ke chha khabar?"),
    ("म त आज घरमै बस्ने हो।", "Ma ta aaja gharmai basne ho."),
    ("त्यो कुरा मलाई थाहा छैन।", "Tyo kura malai thaha chhaina."),
    ("भोलि कलेज जानुपर्छ।", "Bholi college januparchha."),
    ("अनि त्यसपछि के गर्ने?", "Ani tyaspachi ke garne?"),
    ("यो video upload गर्नुपर्छ।", "Yo video upload garnuparchha."),
    ("आज meeting कति बजे हो?", "Aaja meeting kati baje ho?"),
    ("नमस्ते", "Namaste"),
    ("पोखरा", "Pokhara"),
    ("बुटवल", "Butwal"),
    ("चितवन", "Chitwan"),
    ("ललितपुर", "Lalitpur"),
    ("भक्तपुर", "Bhaktapur"),
    ("सगरमाथा", "Sagarmatha"),
    ("नेपाल", "Nepal"),
    ("YouTube", "YouTube"),
    ("Facebook", "Facebook"),
    ("२०२६", "2026"),
    ("१२३", "123"),
]


def test_spec_goldens():
    for src, expected in GOLDENS:
        assert romanize_nepali(src) == expected, (src, romanize_nepali(src), expected)


def test_json_engine_goldens():
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parent / "data" / "romanize_goldens.json"
    rows = json.loads(path.read_text(encoding="utf-8"))
    assert len(rows) >= 80
    for row in rows:
        assert romanize_nepali(row["input"]) == row["expected"], row
    assert romanize_caption("नमस्ते") == romanize_nepali("नमस्ते")


def test_normalize_danda_and_space():
    out = normalize_nepali_text("म  आज   घर।")
    assert "  " not in out
    assert out.endswith("।") or "घर" in out


def test_correct_kathmandu_confusion():
    text, _ = correct_nepali_asr("काठमाडौ जादै छु")
    assert "काठमाडौं" in text
    assert "जाँदै" in text


def test_high_confidence_skips_weak_agglutination():
    # always-map still applies (काठमाडौ)
    assert correct_token("काठमाडौ", confidence=0.99) == "काठमाडौं"
    # agglutination at very low confidence is skipped
    assert correct_token("भएकोछ", confidence=0.1) == "भएकोछ"


def test_quality_validation():
    assert coerce_transcription_quality("high") == "high_accuracy"
    with pytest.raises(HTTPException):
        normalize_transcription_quality("turbo")


def test_whisper_quality_beams():
    assert whisper_transcribe_options("ne", "fast")["beam_size"] == 3
    assert whisper_transcribe_options("ne", "high_accuracy")["beam_size"] == 5
    assert whisper_transcribe_options("en", "fast")["beam_size"] == 1


def test_latin_wrap_allows_longer_lines():
    lines = wrap_caption_lines("Tapailai kasto chha?")
    assert lines
    assert any("Tapailai" in ln for ln in lines)


def test_ass_escape_roman():
    assert r"\{" in escape_ass_text(r"{\an8}hello")


def test_mixed_english_not_transliterated():
    out = romanize_nepali("मेरो exam next week छ।")
    assert "exam" in out
    assert "next" in out
    assert "week" in out


def test_user_edit_not_reromanized():
    from utils.caption_script import apply_output_script, snapshot_native
    cues = [snapshot_native({"id": 1, "start": 0, "end": 1, "text": "म आज घर जाँदै छु।", "words": []})]
    cues[0]["text"] = "Ma aja ghar jadai chu."
    cues[0]["text_edited"] = True
    out = apply_output_script(cues, output_script="roman", source_language="ne")
    assert out[0]["text"] == "Ma aja ghar jadai chu."
