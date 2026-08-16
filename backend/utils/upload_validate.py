"""Server-side upload size and type checks."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException, UploadFile

MAX_UPLOAD_BYTES = 500 * 1024 * 1024  # 500 MiB

VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".3gp"}
AUDIO_EXT = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}
ALLOWED_EXT = VIDEO_EXT | AUDIO_EXT

# Magic prefixes (first bytes)
MAGIC = (
    (b"\x00\x00\x00", {".mp4", ".mov", ".m4v", ".m4a"}),  # ftyp often at offset 4
    (b"ID3", {".mp3"}),
    (b"\xff\xfb", {".mp3"}),
    (b"\xff\xf3", {".mp3"}),
    (b"\xff\xf2", {".mp3"}),
    (b"RIFF", {".wav", ".avi"}),
    (b"OggS", {".ogg"}),
    (b"fLaC", {".flac"}),
    (b"\x1a\x45\xdf\xa3", {".mkv", ".webm"}),
)


def extension_ok(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext or '(none)'}")
    return ext


def looks_like_media(header: bytes, ext: str) -> bool:
    if len(header) < 12:
        return False
    if header[4:8] == b"ftyp" and ext in {".mp4", ".mov", ".m4v", ".m4a", ".3gp"}:
        return True
    if header.startswith(b"RIFF") and header[8:12] in {b"WAVE", b"AVI "}:
        return ext in {".wav", ".avi"}
    if header.startswith(b"ID3") or header[:2] in {b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"}:
        return ext == ".mp3"
    if header.startswith(b"OggS"):
        return ext == ".ogg"
    if header.startswith(b"fLaC"):
        return ext == ".flac"
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return ext in {".mkv", ".webm"}
    # Some MP4s / AAC without ftyp at 4
    if ext in {".aac", ".mp4", ".mov"}:
        return True
    return False


async def read_upload_limited(file: UploadFile, dest: Path) -> int:
    filename = file.filename or "upload.bin"
    ext = extension_ok(filename)
    dest.parent.mkdir(parents=True, exist_ok=True)
    total = 0
    header = b""
    with open(dest, "wb") as handle:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_UPLOAD_BYTES:
                handle.close()
                try:
                    dest.unlink()
                except OSError:
                    pass
                raise HTTPException(status_code=413, detail="File exceeds 500 MB upload limit")
            if len(header) < 32:
                header += chunk[: 32 - len(header)]
            handle.write(chunk)
    if total == 0:
        try:
            dest.unlink()
        except OSError:
            pass
        raise HTTPException(status_code=400, detail="Empty file")
    if not looks_like_media(header, ext):
        try:
            dest.unlink()
        except OSError:
            pass
        raise HTTPException(status_code=400, detail="File content does not match a supported media type")
    return total
