"""Resolve FFmpeg/ffprobe on Windows even when the server PATH is stale."""

from __future__ import annotations

import os
import sys
from functools import lru_cache
from pathlib import Path
from shutil import which
from typing import Optional


def _refresh_windows_path() -> None:
    if os.name != "nt":
        return

    try:
        import winreg
    except ImportError:
        return

    parts = []
    for hive, subkey in (
        (winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
        (winreg.HKEY_CURRENT_USER, r"Environment"),
    ):
        try:
            with winreg.OpenKey(hive, subkey) as key:
                parts.append(winreg.QueryValueEx(key, "Path")[0])
        except OSError:
            continue

    if parts:
        os.environ["PATH"] = ";".join(parts)


def _winget_ffmpeg_dirs() -> list[Path]:
    root = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    if not root.is_dir():
        return []

    dirs: list[Path] = []
    for exe in root.glob("Gyan.FFmpeg*/**/bin/ffmpeg.exe"):
        if exe.is_file():
            dirs.append(exe.parent)
    return dirs


@lru_cache(maxsize=1)
def resolve_ffmpeg_bin() -> Optional[str]:
    _refresh_windows_path()

    found = which("ffmpeg")
    if found:
        return found

    for bin_dir in _winget_ffmpeg_dirs():
        exe = bin_dir / "ffmpeg.exe"
        if exe.is_file():
            return str(exe)
    return None


@lru_cache(maxsize=1)
def resolve_ffprobe_bin() -> Optional[str]:
    _refresh_windows_path()

    found = which("ffprobe")
    if found:
        return found

    ffmpeg = resolve_ffmpeg_bin()
    if ffmpeg:
        probe = Path(ffmpeg).with_name("ffprobe.exe")
        if probe.is_file():
            return str(probe)

    for bin_dir in _winget_ffmpeg_dirs():
        probe = bin_dir / "ffprobe.exe"
        if probe.is_file():
            return str(probe)
    return None


def ffmpeg_available() -> bool:
    return resolve_ffmpeg_bin() is not None and resolve_ffprobe_bin() is not None


def ffmpeg_location_dir() -> Optional[str]:
    ffmpeg = resolve_ffmpeg_bin()
    return str(Path(ffmpeg).parent) if ffmpeg else None


def require_ffmpeg_or_raise() -> None:
    if not ffmpeg_available():
        raise RuntimeError(
            "FFmpeg is not installed or not discoverable. "
            "Install: winget install Gyan.FFmpeg — then restart the backend."
        )
