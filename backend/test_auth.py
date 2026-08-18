"""Authentication, sessions, and cross-user authorization tests."""

from __future__ import annotations

import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND))

from db.database import Base, get_db  # noqa: E402
import app as appmod  # noqa: E402
from auth.rate_limit import reset_for_tests  # noqa: E402


@pytest.fixture()
def auth_client(tmp_path, monkeypatch):
    reset_for_tests()
    db_path = tmp_path / "auth_test.db"
    test_engine = create_engine(
        f"sqlite:///{db_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=test_engine)
    TestSession = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    appmod.app.dependency_overrides[get_db] = override_get_db
    appmod.jobs.clear()
    client = TestClient(appmod.app)
    yield client
    appmod.app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def _register(client: TestClient, *, email: str, name: str, password: str = "password123") -> dict:
    res = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": password,
            "confirm_password": password,
        },
        headers={"Origin": "http://localhost:3000"},
    )
    assert res.status_code == 200, res.text
    return res.json()


def _login(client: TestClient, email: str, password: str = "password123") -> None:
    res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
        headers={"Origin": "http://localhost:3000"},
    )
    assert res.status_code == 200, res.text


def _create_project(client: TestClient, name: str = "Test Project") -> str:
    res = client.post("/api/projects", json={"name": name})
    assert res.status_code == 200, res.text
    return res.json()["project"]["id"]


def _seed_job(user_id: str, project_id: str, job_id: str | None = None) -> str:
    jid = job_id or str(uuid.uuid4())
    appmod._new_job(
        jid,
        filename="clip.mp4",
        user_id=user_id,
        project_id=project_id,
        status="completed",
        transcription_status="completed",
        subtitles=[{"id": 1, "start": 0.0, "end": 1.0, "text": "hello"}],
    )
    return jid


def test_register_login_me_logout(auth_client):
    client = auth_client
    body = _register(client, email="alice@example.com", name="Alice")
    assert body["authenticated"] is True
    assert body["user"]["email"] == "alice@example.com"
    assert "password_hash" not in body["user"]

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["authenticated"] is True

    out = client.post("/api/auth/logout")
    assert out.status_code == 200
    me2 = client.get("/api/auth/me")
    assert me2.json()["authenticated"] is False


def test_register_duplicate_email(auth_client):
    client = auth_client
    _register(client, email="dup@example.com", name="One")
    client.cookies.clear()
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Two",
            "email": "dup@example.com",
            "password": "password123",
            "confirm_password": "password123",
        },
        headers={"Origin": "http://localhost:3000"},
    )
    assert res.status_code == 400


def test_login_invalid_credentials(auth_client):
    client = auth_client
    _register(client, email="bob@example.com", name="Bob")
    client.cookies.clear()
    bad = client.post(
        "/api/auth/login",
        json={"email": "bob@example.com", "password": "wrong-password"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert bad.status_code == 401
    assert bad.json()["detail"] == "Invalid email or password."


def test_protected_routes_require_auth(auth_client):
    client = auth_client
    jid = str(uuid.uuid4())
    assert client.get(f"/status/{jid}").status_code == 401
    assert client.get(f"/subtitles/{jid}").status_code == 401
    assert client.get(f"/download/{jid}.srt").status_code == 401


def test_cross_user_job_access_denied(auth_client):
    client = auth_client
    user_a = _register(client, email="usera@example.com", name="User A")
    project_a = _create_project(client, "Project A")
    job_a = _seed_job(user_a["user"]["id"], project_a)

    client.cookies.clear()
    _register(client, email="userb@example.com", name="User B")

    denied = client.get(f"/status/{job_a}")
    assert denied.status_code == 403


def test_owner_can_read_job(auth_client):
    client = auth_client
    user_a = _register(client, email="own@example.com", name="Owner")
    project_a = _create_project(client)
    job_a = _seed_job(user_a["user"]["id"], project_a)

    ok = client.get(f"/status/{job_a}")
    assert ok.status_code == 200
    assert ok.json()["job_id"] == job_a


def test_legacy_anonymous_job_forbidden(auth_client):
    client = auth_client
    _register(client, email="legacy@example.com", name="Legacy")
    jid = str(uuid.uuid4())
    appmod._new_job(jid, filename="old.mp4", status="completed", transcription_status="completed")
    res = client.get(f"/status/{jid}")
    assert res.status_code == 403


def test_project_idor(auth_client):
    client = auth_client
    _register(client, email="pown@example.com", name="Owner")
    project_id = _create_project(client)

    client.cookies.clear()
    _register(client, email="pother@example.com", name="Other")

    res = client.get(f"/api/projects/{project_id}")
    assert res.status_code == 404


def test_change_password_revokes_other_sessions(auth_client):
    client = auth_client
    _register(client, email="pw@example.com", name="PW User")
    client_a = TestClient(appmod.app)
    _login(client_a, "pw@example.com", "password123")
    assert client_a.get("/api/auth/me").json()["authenticated"] is True

    res = client.post(
        "/api/auth/change-password",
        json={
            "current_password": "password123",
            "new_password": "new-password-12",
            "confirm_password": "new-password-12",
        },
    )
    assert res.status_code == 200

    stale = client_a.get("/api/auth/me")
    assert stale.json()["authenticated"] is False

    client.cookies.clear()
    _login(client, "pw@example.com", "new-password-12")
    assert client.get("/api/auth/me").json()["authenticated"] is True
