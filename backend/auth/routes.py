"""Authentication API routes."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DbSession

from auth.config import (
    COOKIE_SECURE,
    FRONTEND_ORIGIN,
    MIN_PASSWORD_LENGTH,
    SESSION_COOKIE_NAME,
    SESSION_TTL_DAYS,
)
from auth.deps import get_current_user, get_optional_user, user_to_public
from auth.email_util import normalize_email, valid_email
from auth.passwords import hash_password, verify_password
from auth.rate_limit import allow
from auth.sessions import create_session, revoke_all_user_sessions, revoke_session
from db.database import get_db
from db.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    email: str
    password: str = Field(..., min_length=MIN_PASSWORD_LENGTH)
    confirm_password: str


class LoginBody(BaseModel):
    email: str
    password: str


class ChangePasswordBody(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=MIN_PASSWORD_LENGTH)
    confirm_password: str


class UpdateProfileBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _ip_hash(ip: str) -> str:
    return hashlib.sha256(ip.encode("utf-8")).hexdigest()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/",
        max_age=SESSION_TTL_DAYS * 86400,
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


def _check_origin(request: Request) -> None:
    origin = request.headers.get("origin")
    if not origin:
        return
    allowed = {FRONTEND_ORIGIN, "http://127.0.0.1:3000", "http://localhost:3000"}
    if origin not in allowed:
        raise HTTPException(status_code=403, detail="Origin not allowed.")


@router.post("/register")
def register(body: RegisterBody, request: Request, response: Response, db: DbSession = Depends(get_db)):
    _check_origin(request)
    if not allow(f"register:{_client_ip(request)}"):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    email = normalize_email(body.email)
    if not valid_email(email):
        raise HTTPException(status_code=422, detail="Invalid email address.")
    if body.password != body.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match.")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        name=body.name.strip(),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    db.refresh(user)
    token, _ = create_session(
        db,
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_hash=_ip_hash(_client_ip(request)),
    )
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    _set_session_cookie(response, token)
    return {"authenticated": True, "user": user_to_public(user)}


@router.post("/login")
def login(body: LoginBody, request: Request, response: Response, db: DbSession = Depends(get_db)):
    _check_origin(request)
    if not allow(f"login:{_client_ip(request)}"):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    email = normalize_email(body.email)
    user = db.query(User).filter(User.email == email).one_or_none()
    if not user or not verify_password(user.password_hash, body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Invalid email or password.")
    token, _ = create_session(
        db,
        user_id=user.id,
        user_agent=request.headers.get("user-agent"),
        ip_hash=_ip_hash(_client_ip(request)),
    )
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    _set_session_cookie(response, token)
    return {"authenticated": True, "user": user_to_public(user)}


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: DbSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    row = getattr(request.state, "session_row", None)
    if row:
        revoke_session(db, row)
    _clear_session_cookie(response)
    return {"success": True}


@router.get("/me")
def me(user: User | None = Depends(get_optional_user)):
    if not user:
        return {"authenticated": False}
    return {"authenticated": True, "user": user_to_public(user)}


@router.patch("/me")
def update_profile(body: UpdateProfileBody, user: User = Depends(get_current_user), db: DbSession = Depends(get_db)):
    user.name = body.name.strip()
    db.commit()
    db.refresh(user)
    return {"authenticated": True, "user": user_to_public(user)}


@router.post("/change-password")
def change_password(
    body: ChangePasswordBody,
    request: Request,
    user: User = Depends(get_current_user),
    db: DbSession = Depends(get_db),
):
    if not allow(f"change-password:{user.id}"):
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=422, detail="Passwords do not match.")
    if not verify_password(user.password_hash, body.current_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    user.password_hash = hash_password(body.new_password)
    except_hash = getattr(getattr(request.state, "session_row", None), "session_token_hash", None)
    revoke_all_user_sessions(db, user.id, except_token_hash=except_hash)
    db.commit()
    return {"success": True, "message": "Password updated. Other sessions were signed out."}
