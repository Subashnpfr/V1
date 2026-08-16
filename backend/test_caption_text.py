import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils.caption_text import is_devanagari_text, is_junk_token, sanitize_caption_text


def test_english_danda_becomes_clean():
    assert sanitize_caption_text("would land।") == "would land"
    assert "।" not in sanitize_caption_text("While The.")


def test_pipe_and_music_stripped():
    assert sanitize_caption_text("While The | type of irrelevant") == "While The type of irrelevant"
    assert is_junk_token("|")
    assert sanitize_caption_text("hello | | world") == "hello world"


def test_nepali_keeps_danda():
    out = sanitize_caption_text("यो राम्रो हो।")
    assert "यो" in out
    assert is_devanagari_text(out)
