from utils.devanagari_romanize import romanize_caption, romanize_word
from utils.caption_script import apply_output_script, snapshot_native
from utils.script_model import resolve_transliteration_mode
from utils.ass_text import escape_ass_text


def test_common_words_conventional_roman():
    assert romanize_word("हुन्छ") == "hunchha"
    assert romanize_word("छैन") == "chhaina"
    assert romanize_word("होइन") == "hoina"
    assert romanize_word("किन") == "kina"
    assert romanize_word("तपाईं") == "tapai"
    assert "hunchh" != romanize_word("हुन्छ")


def test_chha_cluster_keeps_final_a():
    assert romanize_word("हुन्छ").endswith("chha")


def test_golden_tapailai():
    assert romanize_caption("तपाईंलाई कस्तो छ?") == "Tapailai kasto chha?"


def test_golden_jaandai():
    assert romanize_caption("म आज घर जाँदै छु।") == "Ma aaja ghar jaandai chu."


def test_golden_meeting_mixed():
    assert romanize_caption("आज हाम्रो meeting छ।") == "Aaja hamro meeting chha."


def test_golden_kathmandu():
    out = romanize_caption("म आज काठमाडौं जाँदै छु।")
    assert "Kathmandu" in out
    assert "जाँदै" not in out
    assert "Ma aaja" in out


def test_hinglish_passthrough():
    src = "Aaj hum market ja rahe hain."
    assert romanize_caption(src) == src


def test_english_passthrough():
    assert romanize_caption("I am going home.") == "I am going home."


def test_mixed_exam():
    out = romanize_caption("Mero exam next week cha so I need to study.")
    assert "exam" in out
    assert "next week" in out
    assert "study" in out


def test_hindi_to_hinglish():
    out = romanize_caption("आप कैसे हैं?")
    assert "Devanagari" not in out
    assert "आप" not in out
    assert "aap" in out.lower()
    assert "kaise" in out.lower()


def test_numbers_and_danda():
    out = romanize_caption("मेरो उमेर २० वर्ष हो।")
    assert "20" in out
    assert "।" not in out
    assert out.endswith(".")


def test_proper_nouns_latin_kept():
    out = romanize_caption("मेरो YouTube च्यानल")
    assert "YouTube" in out


def test_ass_escape_still_applies_to_roman():
    assert r"\{" in escape_ass_text(r"{\an8}hello")


def test_edits_not_overwritten():
    cues = [
        snapshot_native({"id": 1, "start": 0, "end": 1, "text": "तपाईंलाई कस्तो छ?", "words": []}),
    ]
    cues[0]["text"] = "Tapai lai kasto cha?"
    cues[0]["text_edited"] = True
    out = apply_output_script(cues, output_script="roman", source_language="ne")
    assert out[0]["text"] == "Tapai lai kasto cha?"


def test_coerce_never_raises():
    from utils.script_model import coerce_output_script, coerce_source_language

    assert coerce_source_language("bogus") == "auto"
    assert coerce_source_language("nepali") == "ne"
    assert coerce_output_script("not-a-script", "ne") == "native"
    assert coerce_output_script("roman", "en") == "native"
    assert coerce_output_script("roman", "ne") == "roman"


def test_romanize_failure_keeps_native(monkeypatch):
    def boom(text, **kwargs):
        raise RuntimeError("romanize boom")

    monkeypatch.setattr("utils.caption_script.romanize_nepali", boom)
    cues = [
        snapshot_native({"id": 1, "start": 0, "end": 1, "text": "तपाईंलाई कस्तो छ?", "words": []}),
    ]
    out = apply_output_script(cues, output_script="roman", source_language="ne")
    assert "तपाईंलाई" in out[0]["text"]


def test_nepali_fast_uses_medium(monkeypatch):
    import app as appmod

    calls = []

    def fake_load(key, name, preferred_compute=None):
        calls.append(name)
        return "model"

    monkeypatch.setattr(appmod, "load_whisper_model", fake_load)
    _, lang, label, meta = appmod.get_whisper_model_and_language("ne", "fast")
    assert lang == "ne"
    assert "large-v3" not in calls
    assert "medium" in label.lower()
    assert meta["requested_model"] == "medium"
    assert meta["actual_model"] == "medium"
    assert meta["fallback"] is False


def test_nepali_whisper_falls_back_to_medium(monkeypatch):
    import app as appmod

    calls = []

    def fake_load(key, name, preferred_compute=None):
        calls.append((key, name))
        if name == "large-v3":
            raise RuntimeError("CUDA out of memory")
        return "medium-model"

    monkeypatch.setattr(appmod, "load_whisper_model", fake_load)
    model, lang, label, meta = appmod.get_whisper_model_and_language("ne", "high_accuracy")
    assert model == "medium-model"
    assert lang == "ne"
    assert "medium" in label.lower()
    assert ("ne", "large-v3") in calls
    assert meta["requested_model"] == "large-v3"
    assert meta["actual_model"] == "medium"
    assert meta["fallback"] is True


def test_worker_language_invalid_does_not_use_http_exception():
    from utils.script_model import coerce_source_language, job_script_defaults

    d = job_script_defaults({"source_language": "???", "output_script": "romanized"})
    assert d["source_language"] == "auto"
    assert d["output_script"] == "roman"
    assert coerce_source_language("???") == "auto"


def test_script_convert_endpoint():
    import uuid
    import app as appmod
    from fastapi.testclient import TestClient

    jid = str(uuid.uuid4())
    appmod.jobs[jid] = {
        "job_id": jid,
        "source_language": "ne",
        "output_script": "native",
        "transliteration_mode": "none",
        "subtitles": [
            snapshot_native({
                "id": 1,
                "start": 0,
                "end": 1,
                "text": "तपाईंलाई कस्तो छ?",
                "words": [{"text": "तपाईंलाई", "start": 0, "end": 0.4}],
            })
        ],
    }
    client = TestClient(appmod.app)
    res = client.post(f"/script/{jid}", json={"output_script": "roman"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["transliteration_mode"] == "romanized_nepali"
    assert body["subtitles"][0]["text"] == "Tapailai kasto chha?"
    assert "तपाईंलाई" not in body["subtitles"][0]["text"]
    assert body["subtitles"][0]["native_text"] == "तपाईंलाई कस्तो छ?"
    assert resolve_transliteration_mode("ne", "roman") == "romanized_nepali"
    assert resolve_transliteration_mode("hi", "roman") == "hinglish"
    assert resolve_transliteration_mode("en", "roman") == "none"
    assert resolve_transliteration_mode("ne", "native") == "none"
