"""Server-side session tokens (hashed in DB)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session as DbSession

from auth.config import SESSION_TTL_DAYS
from db.models import Session as UserSession


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_session(
    db: DbSession,
    *,
    user_id: str,
    user_agent: str | None = None,
    ip_hash: str | None = None,
) -> tuple[str, UserSession]:
    raw = secrets.token_urlsafe(32)
    now = _utcnow()
    row = UserSession(
        user_id=user_id,
        session_token_hash=hash_token(raw),
        created_at=now,
        expires_at=now + timedelta(days=SESSION_TTL_DAYS),
        last_seen_at=now,
        user_agent=(user_agent or "")[:512] or None,
        ip_hash=ip_hash,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return raw, row


def get_session_by_token(db: DbSession, raw_token: str | None) -> UserSession | None:
    if not raw_token:
        return None
    row = db.query(UserSession).filter(UserSession.session_token_hash == hash_token(raw_token)).one_or_none()
    if not row:
        return None
    now = _utcnow()
    if row.revoked_at is not None:
        return None
    if _as_utc(row.expires_at) <= now:
        return None
    row.last_seen_at = now
    db.commit()
    return row


def revoke_session(db: DbSession, row: UserSession) -> None:
    if row.revoked_at is None:
        row.revoked_at = _utcnow()
        db.commit()


def revoke_all_user_sessions(db: DbSession, user_id: str, except_token_hash: str | None = None) -> None:
    now = _utcnow()
    q = db.query(UserSession).filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
    for row in q:
        if except_token_hash and row.session_token_hash == except_token_hash:
            continue
        row.revoked_at = now
    db.commit()
