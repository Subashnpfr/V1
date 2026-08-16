import os
from pathlib import Path

from utils.job_store import atomic_write_json, persist_job


def test_atomic_write_retries_replace(monkeypatch, tmp_path):
    path = tmp_path / "job.json"
    calls = {"n": 0}
    real_replace = os.replace

    def flaky(src, dst):
        calls["n"] += 1
        if calls["n"] < 3:
            raise OSError(5, "Access is denied")
        return real_replace(src, dst)

    monkeypatch.setattr(os, "replace", flaky)
    monkeypatch.setattr("utils.job_store.time.sleep", lambda *_a, **_k: None)
    atomic_write_json(path, {"job_id": "abc", "ok": True})
    assert path.is_file()
    assert calls["n"] == 3


def test_persist_job_does_not_raise_on_lock(monkeypatch, tmp_path):
    def boom(*_a, **_k):
        raise OSError(5, "Access is denied")

    monkeypatch.setattr("utils.job_store.atomic_write_json", boom)
    persist_job(tmp_path, {"job_id": "abc", "status": "processing"})


def test_transcribe_kwargs_assigned_before_use():
    import inspect
    import app as appmod

    src = inspect.getsource(appmod.process_transcription_job)
    assign = src.find("transcribe_kwargs = whisper_transcribe_options")
    used = src.find("transcribe_kwargs.get(")
    assert assign >= 0
    assert used >= 0
    assert assign < used
