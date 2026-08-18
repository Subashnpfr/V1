"""Project CRUD — each project belongs to one user."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DbSession

from auth.deps import get_current_user
from db.database import get_db
from db.models import Project, User

router = APIRouter(prefix="/api/projects", tags=["projects"])


class ProjectCreateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class ProjectUpdateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


def _project_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("")
def list_projects(user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    rows = db.query(Project).filter(Project.user_id == user.id).order_by(Project.updated_at.desc()).all()
    return {"projects": [_project_dict(p) for p in rows]}


@router.post("")
def create_project(body: ProjectCreateBody, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    project = Project(user_id=user.id, name=body.name.strip())
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"project": _project_dict(project)}


@router.get("/{project_id}")
def get_project(project_id: str, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found.")
    return {"project": _project_dict(project)}


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    body: ProjectUpdateBody,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
):
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found.")
    project.name = body.name.strip()
    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)
    return {"project": _project_dict(project)}


@router.delete("/{project_id}")
def delete_project(project_id: str, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    project = db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found.")
    db.delete(project)
    db.commit()
    return {"success": True}
