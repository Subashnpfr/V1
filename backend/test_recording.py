import io
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from utils.recording_limits import MAX_RECORDING_DURATION_SECONDS, recording_duration_error
from utils.upload_validate import looks_like_media
from utils.job_store import load_job, persist_job


WEBM_HEADER = b"\x1a\x45\xdf\xa3" + b"\x00" * 80


def test_recording_unknown_duration_is_allowed():
    assert recording_duration_error(0) is None
    assert recording_duration_error(0.1) is None
    assert recording_duration_error(12.15) is None
    assert recording_duration_error(735) is None  # 12:15


def test_recording_duration_too_long():
    assert recording_duration_error(MAX_RECORDING_DURATION_SECONDS + 5) == "RECORDING_TOO_LONG"


def test_recording_duration_ok():
    assert recording_duration_error(12.0) is None


def test_webm_magic_accepted():
    assert looks_like_media(WEBM_HEADER, ".webm") is True


def test_jpeg_rejected_as_webm():
    jpeg = b"\xff\xd8\xff" + b"\x00" * 20
    assert looks_like_media(jpeg, ".webm") is False


def _patch_upload_env(monkeypatch, tmp_path, appmod):
    monkeypatch.setattr(appmod, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(appmod, "OUTPUTS_DIR", tmp_path)
    monkeypatch.setattr(appmod, "TEMP_DIR", tmp_path)
    monkeypatch.setattr(appmod, "require_ffmpeg", lambda: None)
    monkeypatch.setattr(appmod, "process_transcription_job", lambda *a, **k: None)
    appmod.jobs.clear()


def test_recording_upload_creates_job(monkeypatch, tmp_path):
    import app as appmod
    from conftest import authed_client

    _patch_upload_env(monkeypatch, tmp_path, appmod)
    client, _user_id, project_id = authed_client(appmod, tmp_path, email="rec@example.com")
    res = client.post(
        "/upload",
        files={"file": ("recording.webm", io.BytesIO(WEBM_HEADER), "audio/webm")},
        data={"source_type": "recording", "language": "en", "project_id": project_id},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["success"] is True
    assert body["is_audio"] is True
    assert body["source_type"] == "recording"
    jid = body["job_id"]
    uuid.UUID(jid)
    stored = list(tmp_path.glob(f"{jid}.*"))
    media = [p for p in stored if p.suffix == ".webm"]
    assert media and media[0].name == f"{jid}.webm"
    job = appmod.jobs[jid]
    assert job["source_type"] == "recording"
    assert job["is_audio"] is True
    persist_job(tmp_path, job)
    loaded = load_job(tmp_path, jid)
    assert loaded["source_type"] == "recording"


def test_recording_invalid_media_rejected(monkeypatch, tmp_path):
    import app as appmod
    from conftest import authed_client

    _patch_upload_env(monkeypatch, tmp_path, appmod)
    client, _user_id, project_id = authed_client(appmod, tmp_path, email="bad@example.com")
    res = client.post(
        "/upload",
        files={"file": ("recording.webm", io.BytesIO(b"not-a-media-file" * 8), "audio/webm")},
        data={"source_type": "recording", "project_id": project_id},
    )
    assert res.status_code == 400


def test_recording_oversize_rejected(monkeypatch, tmp_path):
    import app as appmod
    import utils.upload_validate as uv
    from conftest import authed_client

    _patch_upload_env(monkeypatch, tmp_path, appmod)
    monkeypatch.setattr(uv, "MAX_UPLOAD_BYTES", 64)
    client, _user_id, project_id = authed_client(appmod, tmp_path, email="big@example.com")
    res = client.post(
        "/upload",
        files={"file": ("recording.webm", io.BytesIO(WEBM_HEADER + b"x" * 200), "audio/webm")},
        data={"source_type": "recording", "project_id": project_id},
    )
    assert res.status_code == 413


def test_audio_burn_starts(monkeypatch, tmp_path):
    import app as appmod
    from conftest import authed_client

    monkeypatch.setattr(appmod, "require_ffmpeg", lambda: None)
    monkeypatch.setattr(appmod, "UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(appmod, "OUTPUTS_DIR", tmp_path)
    monkeypatch.setattr(
        appmod,
        "export_video_with_png_overlays",
        lambda *a, **k: str(tmp_path / "out.mp4"),
    )
    client, user_id, project_id = authed_client(appmod, tmp_path, email="burn@example.com")
    jid = str(uuid.uuid4())
    media = tmp_path / f"{jid}.webm"
    media.write_bytes(WEBM_HEADER)
    appmod.jobs[jid] = {
        "job_id": jid,
        "is_audio": True,
        "video_path": str(media),
        "subtitles": [{"id": 1, "start": 0, "end": 1, "text": "hi"}],
        "transcription_status": "completed",
        "export_status": "idle",
        "user_id": user_id,
        "project_id": project_id,
    }
    png = (
        "data:image/png;base64,"
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    res = client.post(
        f"/burn/{jid}",
        json={"frames": [{"start": 0, "end": 1, "image_data": png}]},
    )
    assert res.status_code == 200, res.text
    assert res.json()["success"] is True
