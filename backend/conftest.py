"""Shared pytest helpers for authenticated API tests."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from auth.rate_limit import reset_for_tests
from db.database import Base, get_db


def setup_test_db(appmod, tmp_path):
    db_path = tmp_path / "pytest_app.db"
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
    return test_engine


def register_and_project(client: TestClient, *, email: str = "test@example.com", name: str = "Test User"):
    reset_for_tests()
    reg = client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "password123",
            "confirm_password": "password123",
        },
        headers={"Origin": "http://localhost:3000"},
    )
    assert reg.status_code == 200, reg.text
    user_id = reg.json()["user"]["id"]
    proj = client.post("/api/projects", json={"name": "Test Project"})
    assert proj.status_code == 200, proj.text
    return user_id, proj.json()["project"]["id"]


def authed_client(appmod, tmp_path, *, email: str = "test@example.com") -> tuple[TestClient, str, str]:
    setup_test_db(appmod, tmp_path)
    client = TestClient(appmod.app)
    user_id, project_id = register_and_project(client, email=email)
    return client, user_id, project_id
