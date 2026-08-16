"""Allow only YouTube HTTPS URLs before yt-dlp runs."""

from __future__ import annotations

import ipaddress
import re
from urllib.parse import urlparse

ALLOWED_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
    "www.youtu.be",
    "www.youtube-nocookie.com",
    "youtube-nocookie.com",
}

_IPV4 = re.compile(r"^\d{1,3}(?:\.\d{1,3}){3}$")


def _host_is_private_or_local(host: str) -> bool:
    h = host.lower().rstrip(".")
    if h in {"localhost", "localhost.localdomain"}:
        return True
    if h.endswith(".localhost"):
        return True
    if _IPV4.match(h):
        try:
            ip = ipaddress.ip_address(h)
            return bool(
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
                or ip.is_unspecified
            )
        except ValueError:
            return True
    try:
        ip = ipaddress.ip_address(h)
        return True
    except ValueError:
        return False


def validate_youtube_url(url: str) -> str:
    if not url or not isinstance(url, str):
        raise ValueError("YouTube URL is required")
    raw = url.strip()
    parsed = urlparse(raw)
    if parsed.scheme.lower() != "https":
        raise ValueError("Only https YouTube URLs are allowed")
    host = (parsed.hostname or "").lower()
    if not host or _host_is_private_or_local(host):
        raise ValueError("YouTube URL host is not allowed")
    if host not in ALLOWED_HOSTS:
        raise ValueError("Only YouTube URLs are allowed")
    path = parsed.path or "/"
    if host in {"youtu.be", "www.youtu.be"}:
        if not re.fullmatch(r"/[A-Za-z0-9_-]{6,}", path):
            raise ValueError("Invalid youtu.be URL")
        return raw
    if path.startswith("/watch") or path.startswith("/shorts/") or path.startswith("/embed/"):
        return raw
    if path in {"/", ""} and parsed.query:
        return raw
    raise ValueError("Unsupported YouTube URL path")
