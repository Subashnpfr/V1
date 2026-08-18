"""Job ownership helpers (jobs remain in RAM/JSON; user_id/project_id on job dict)."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session as DbSession

from db.models import Project, User


def require_project(db: DbSession, user: User, project_id: str) -> Project:
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


def authorize_job(user: User, job: dict) -> dict:
    owner = job.get("user_id")
    if not owner:
        raise HTTPException(status_code=403, detail="This job is not owned by an account.")
    if owner != user.id:
        raise HTTPException(status_code=403, detail="Forbidden.")
    return job
