"""Atomic JSON job manifests under outputs/."""

from __future__ import annotations

import json
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

NON_SERIALIZABLE = set()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def manifest_path(outputs_dir: Path, job_id: str) -> Path:
    return outputs_dir / f"{job_id}.job.json"


def atomic_write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".job-", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False)
            handle.flush()
            os.fsync(handle.fileno())
        last_err: Exception | None = None
        for attempt in range(8):
            try:
                os.replace(tmp, path)
                return
            except OSError as err:
                last_err = err
                time.sleep(0.04 * (attempt + 1))
        try:
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(data, handle, ensure_ascii=False)
                handle.flush()
        except OSError:
            if last_err:
                raise last_err
            raise
        try:
            os.unlink(tmp)
        except OSError:
            pass
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def serializable_job(job: Dict[str, Any]) -> Dict[str, Any]:
    skip = {"logs"}
    out = {k: v for k, v in job.items() if k not in skip}
    logs = job.get("logs") or []
    out["logs"] = logs[-200:]
    out["updated_at"] = utc_now()
    return out


def persist_job(outputs_dir: Path, job: Dict[str, Any]) -> None:
    job_id = job.get("job_id")
    if not job_id:
        return
    try:
        atomic_write_json(manifest_path(outputs_dir, job_id), serializable_job(job))
    except OSError as err:
        print(f"Warning: could not persist job {job_id} ({err}). Continuing in memory.")


def load_job(outputs_dir: Path, job_id: str) -> Optional[Dict[str, Any]]:
    path = manifest_path(outputs_dir, job_id)
    if not path.is_file():
        return None
    try:
        with open(path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict) or data.get("job_id") != job_id:
        return None
    data.setdefault("logs", [])
    data.setdefault("subtitles", [])
    data.setdefault("export_status", "idle")
    data.setdefault("transcription_status", data.get("status", "unknown"))
    data.setdefault("source_type", "upload")
    data.setdefault("is_audio", False)
    data.setdefault("output_script", "native")
    data.setdefault("transliteration_mode", "none")
    data.setdefault("source_language", data.get("language") or "auto")
    data.setdefault("transcription_quality", "fast")
    return data
