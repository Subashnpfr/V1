"""Auth-related environment configuration."""

from __future__ import annotations

import os

SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "v1_session")
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-change-me-in-production")
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "30"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() in {"1", "true", "yes"}
MIN_PASSWORD_LENGTH = 8
