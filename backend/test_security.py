import sys
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils.job_identity import parse_job_id, resolve_output_file
from utils.youtube_url import validate_youtube_url
from utils.ass_text import escape_ass_text
from utils.cue_validate import validate_cues
from utils.job_store import load_job, persist_job


def test_parse_job_id_valid():
    jid = str(uuid.uuid4())
    assert parse_job_id(jid) == jid


@pytest.mark.parametrize("bad", [
    "../secret",
    "..\\secret",
    "not-a-uuid",
    "C:/Windows/win.ini",
    "",
    "a/b",
    "..%2F..",
])
def test_parse_job_id_rejects(bad):
    with pytest.raises(HTTPException) as exc:
        parse_job_id(bad)
    assert exc.value.status_code == 400


def test_resolve_output_stays_inside(tmp_path):
    jid = str(uuid.uuid4())
    out = resolve_output_file(tmp_path, jid, ".srt")
    assert out.parent.resolve() == tmp_path.resolve()
    assert out.name == f"{jid}.srt"


def test_youtube_allows_watch():
    assert "youtube.com" in validate_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")


def test_youtube_allows_youtu_be():
    validate_youtube_url("https://youtu.be/dQw4w9WgXcQ")


def test_youtube_allows_shorts():
    validate_youtube_url("https://www.youtube.com/shorts/dQw4w9WgXcQ")


@pytest.mark.parametrize("bad", [
    "file:///etc/passwd",
    "http://127.0.0.1/",
    "https://localhost/watch?v=x",
    "https://192.168.1.1/watch",
    "https://example.com/watch?v=x",
    "ftp://youtube.com/x",
    "https://evil.com/?u=youtube.com",
])
def test_youtube_rejects(bad):
    with pytest.raises(ValueError):
        validate_youtube_url(bad)


def test_ass_escape_override_tags():
    out = escape_ass_text(r"{\an8}{\fs100}hello")
    assert r"\{" in out
    assert "{\\an8}" not in out or out.startswith("\\")


def test_cue_rejects_end_before_start():
    with pytest.raises(HTTPException):
        validate_cues([{"id": 1, "start": 2, "end": 1, "text": "x"}])


def test_cue_rejects_nan():
    with pytest.raises(HTTPException):
        validate_cues([{"id": 1, "start": float("nan"), "end": 1, "text": "x"}])


def test_job_persist_roundtrip(tmp_path):
    jid = str(uuid.uuid4())
    job = {"job_id": jid, "status": "completed", "subtitles": [{"id": 1, "start": 0, "end": 1, "text": "hi"}], "logs": []}
    persist_job(tmp_path, job)
    loaded = load_job(tmp_path, jid)
    assert loaded["status"] == "completed"
    assert loaded["subtitles"][0]["text"] == "hi"


def test_corrupt_manifest(tmp_path):
    jid = str(uuid.uuid4())
    p = tmp_path / f"{jid}.job.json"
    p.write_text("{not json", encoding="utf-8")
    assert load_job(tmp_path, jid) is None


def test_srt_shape_from_save(tmp_path, monkeypatch):
    import app as appmod

    jid = str(uuid.uuid4())
    monkeypatch.setattr(appmod, "OUTPUTS_DIR", tmp_path)
    tmp_path.mkdir(parents=True, exist_ok=True)
    appmod.save_srt_and_vtt(jid, [{"start": 0, "end": 1.5, "text": "Hello"}])
    srt = (tmp_path / f"{jid}.srt").read_text(encoding="utf-8")
    assert not srt.startswith("#")
    assert "1\n" in srt
    assert "-->" in srt
    vtt = (tmp_path / f"{jid}.vtt").read_text(encoding="utf-8")
    assert vtt.startswith("WEBVTT\n")


def test_ass_playres_vertical(tmp_path, monkeypatch):
    import app as appmod

    jid = str(uuid.uuid4())
    monkeypatch.setattr(appmod, "OUTPUTS_DIR", tmp_path)
    path = appmod.generate_ass_file(
        jid,
        [{"start": 0, "end": 1, "text": "WAIT FOR THIS {hack}"}],
        style_config={
            "fontFamily": "Montserrat",
            "fontSize": 32,
            "fontWeight": "900",
            "textColor": "#FFFFFF",
            "bgOpacity": 0,
            "outlineWidth": 5,
            "outlineColor": "#000000",
            "textTransform": "uppercase",
            "accentMode": "last-word",
            "highlightColor": "#FF2BD6",
            "maxWordsPerLine": 4,
            "maxCharsPerLine": 18,
        },
        play_res=(1080, 1920),
    )
    text = Path(path).read_text(encoding="utf-8-sig")
    assert "PlayResX: 1080" in text
    assert "PlayResY: 1920" in text
    assert r"\{" in text
    assert r"\1c&HD62BFF&" in text
    assert "Impact" in text


def test_wrap_caption_lines():
    from utils.ass_text import wrap_caption_lines, ass_bgr_amp

    lines = wrap_caption_lines("ONE TWO THREE FOUR FIVE", max_words=4, max_chars=18)
    assert len(lines) >= 2
    assert ass_bgr_amp("#FF2BD6") == "&HD62BFF&"


def test_youtube_http_rejected_before_ytdlp(monkeypatch):
    import app as appmod
    from fastapi.testclient import TestClient

    class Boom:
        def __init__(self, *a, **k):
            raise AssertionError("yt-dlp must not run")

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(appmod.yt_dlp, "YoutubeDL", Boom)
    client = TestClient(appmod.app)
    res = client.post("/youtube", json={"url": "https://example.com/watch?v=x", "project_id": str(uuid.uuid4())})
    assert res.status_code in {400, 401}


def test_download_rejects_bad_id():
    import app as appmod
    from fastapi.testclient import TestClient

    client = TestClient(appmod.app)
    res = client.get("/download/not-a-uuid.srt")
    assert res.status_code in {400, 401, 404, 422}
