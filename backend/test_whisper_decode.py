from utils.whisper_decode import whisper_transcribe_options


def test_nepali_uses_beam_search_and_prompt():
    opts = whisper_transcribe_options("ne")
    assert opts["beam_size"] == 5
    assert opts["language"] == "ne"
    assert "नेपाली" in opts["initial_prompt"]
    assert opts["vad_parameters"]["speech_pad_ms"] == 400


def test_english_stays_greedy():
    opts = whisper_transcribe_options("en")
    assert opts["beam_size"] == 1
    assert "initial_prompt" not in opts
