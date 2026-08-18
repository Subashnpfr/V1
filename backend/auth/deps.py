"""FastAPI auth dependencies."""

from __future__ import annotations

from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy.orm import Session as DbSession

from auth.config import SESSION_COOKIE_NAME
from auth.sessions import get_session_by_token
from db.database import get_db
from db.models import User


def user_to_public(user: User) -> dict:
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "avatar_url": user.avatar_url,
        "email_verified": user.email_verified,
    }


def get_optional_user(
    request: Request,
    db: DbSession = Depends(get_db),
    session_cookie: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> User | None:
    row = get_session_by_token(db, session_cookie)
    if not row:
        return None
    user = db.get(User, row.user_id)
    if not user or not user.is_active:
        return None
    request.state.session_row = row
    return user


def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required.")
    return user
