"""UUID job identity and output-path containment."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException


def parse_job_id(raw: str) -> str:
    if raw is None or not isinstance(raw, str):
        raise HTTPException(status_code=400, detail="Invalid job id")
    value = raw.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Invalid job id")
    if any(sep in value for sep in ("/", "\\", "\x00")):
        raise HTTPException(status_code=400, detail="Invalid job id")
    if ".." in value:
        raise HTTPException(status_code=400, detail="Invalid job id")
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid job id") from exc
    canonical = str(parsed)
    if value.lower() != canonical:
        raise HTTPException(status_code=400, detail="Invalid job id")
    return canonical


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def resolve_contained_file(root: Path, name: str) -> Path:
    root_res = root.resolve()
    candidate = (root_res / name).resolve()
    if not _is_relative_to(candidate, root_res):
        raise HTTPException(status_code=400, detail="Invalid output path")
    return candidate


def resolve_output_file(outputs_dir: Path, job_id: str, suffix: str) -> Path:
    safe_id = parse_job_id(job_id)
    if "/" in suffix or "\\" in suffix or ".." in suffix:
        raise HTTPException(status_code=400, detail="Invalid output path")
    return resolve_contained_file(outputs_dir, f"{safe_id}{suffix}")
