"""Escape user text/styles for ASS so override tags cannot inject."""

from __future__ import annotations

import re

ALLOWED_FONTS = {
    "Montserrat": "Impact",
    "Poppins": "Impact",
    "Inter": "Impact",
    "Noto Sans Devanagari": "Nirmala UI",
    "Mukta": "Nirmala UI",
    "Playfair Display": "Georgia",
    "Teko": "Impact",
    "sans-serif": "Arial",
    "Default": "Nirmala UI",
    "Arial": "Arial",
    "Georgia": "Georgia",
    "Impact": "Impact",
    "Nirmala UI": "Nirmala UI",
}

ALLOWED_POSITIONS = {"top", "center", "bottom"}
ALLOWED_TRANSFORMS = {"none", "uppercase", "lowercase", "capitalize"}
ALLOWED_ANIM = {
    "none",
    "karaoke",
    "highlight-word",
    "bounce",
    "pulse",
    "fade-in",
    "slide-up",
    "typewriter",
    "typewriter-word",
    "popup-word",
    "scale-in",
}


def wrap_caption_lines(text: str, max_words: int | None = None, max_chars: int | None = None) -> list[str]:
    raw = (text or "").strip()
    if not raw:
        return []
    if "\n" in raw:
        return [ln.strip() for ln in raw.split("\n") if ln.strip()]
    from utils.caption_text import is_devanagari_text
    latin = not is_devanagari_text(raw)
    if max_chars is None:
        max_chars = 32 if latin else 18
    if max_words is None:
        max_words = 6 if latin else 4
    words = raw.split()
    lines: list[str] = []
    curr: list[str] = []
    curr_len = 0
    for w in words:
        extra = 1 if curr else 0
        overflow = curr and (curr_len + len(w) + extra > max_chars or len(curr) >= max_words)
        if overflow:
            lines.append(" ".join(curr))
            curr = [w]
            curr_len = len(w)
        else:
            curr.append(w)
            curr_len += len(w) + extra
    if curr:
        lines.append(" ".join(curr))
    return lines


def ass_bgr_amp(hex_color: str | None, default: str = "#FFFFFF") -> str:
    """libass override fill: &HBBGGRR& (no alpha)."""
    c = safe_hex_color(hex_color, default).replace("#", "")
    if len(c) == 3:
        c = "".join(x * 2 for x in c)
    if len(c) != 6:
        c = "FFFFFF"
    r, g, b = c[0:2], c[2:4], c[4:6]
    return f"&H{b}{g}{r}&"


def escape_ass_text(text: str) -> str:
    if not text:
        return ""
    out = text.replace("\\", r"\\")
    out = out.replace("{", r"\{")
    out = out.replace("}", r"\}")
    out = out.replace("\r\n", "\n").replace("\r", "\n")
    out = out.replace("\n", r"\N")
    return out


def safe_font_name(name: str | None) -> str:
    if not name:
        return "Arial"
    return ALLOWED_FONTS.get(name, "Arial")


def safe_position(value: str | None) -> str:
    v = (value or "bottom").lower()
    return v if v in ALLOWED_POSITIONS else "bottom"


def safe_transform(value: str | None) -> str:
    v = (value or "none").lower()
    return v if v in ALLOWED_TRANSFORMS else "none"


def safe_anim(value: str | None) -> str:
    v = (value or "none").lower()
    return v if v in ALLOWED_ANIM else "none"


_HEX = re.compile(r"^#?[0-9A-Fa-f]{3}$|^#?[0-9A-Fa-f]{6}$")


def safe_hex_color(value: str | None, default: str = "#FFFFFF") -> str:
    if not value or not _HEX.match(str(value).strip()):
        return default
    c = str(value).strip()
    if not c.startswith("#"):
        c = "#" + c
    return c
