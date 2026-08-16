"""Composite studio PNG overlays onto video with alpha preserved.

The concat-as-video path previously converted overlays to opaque YUV, which
covered the picture. Overlays are applied as RGBA stills with enable=between().
"""

from __future__ import annotations

import base64
import os
import shutil
import struct
import subprocess
import tempfile
import uuid
import zlib
from pathlib import Path
from typing import Any, Dict, List

from utils.ffmpeg_tools import resolve_ffmpeg_bin
from utils.upload_validate import AUDIO_EXT

MAX_OVERLAY_FRAMES = 48
AUDIO_CANVAS_WIDTH = 1920
AUDIO_CANVAS_HEIGHT = 1080
BLACK_STILL_NAME = "black.png"


def needs_black_canvas(media_path: str, is_audio: bool = False) -> bool:
    if is_audio:
        return True
    return Path(media_path).suffix.lower() in AUDIO_EXT


def write_black_png(path: Path, width: int = AUDIO_CANVAS_WIDTH, height: int = AUDIO_CANVAS_HEIGHT) -> None:
    """Opaque black still used as the video picture for audio-only exports."""
    pixels = b"\x00\x00\x00\xff" * (width * height)
    write_rgba_png(path, width, height, pixels)


def audio_canvas_args(
    input_name: str,
    black_png: str = BLACK_STILL_NAME,
    width: int = AUDIO_CANVAS_WIDTH,
    height: int = AUDIO_CANVAS_HEIGHT,
) -> list[str]:
    """Loop a black still under the audio; -shortest matches unknown WebM duration."""
    return [
        "-loop", "1",
        "-framerate", "30",
        "-i", black_png,
        "-i", input_name,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-vf", f"scale={width}:{height}:flags=neighbor,format=yuv420p",
        "-c:v", "libx264",
        "-tune", "stillimage",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-ac", "2",
        "-ar", "44100",
        "-shortest",
        "-movflags", "+faststart",
        "canvas.mp4",
    ]


def write_rgba_png(path: Path, width: int, height: int, pixels: bytes | None = None) -> None:
    """Write a true RGBA PNG (color type 6). Default pixels are fully transparent."""
    if width < 1 or height < 1:
        raise ValueError("PNG dimensions must be positive")
    expected = width * height * 4
    if pixels is None:
        pixels = b"\x00\x00\x00\x00" * (width * height)
    if len(pixels) != expected:
        raise ValueError("pixel buffer size does not match width*height*4")

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    blob = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(blob)


def png_color_type(path: Path) -> int:
    data = path.read_bytes()
    if data[12:16] != b"IHDR":
        raise ValueError("not a PNG")
    return data[25]


def decode_png_b64(image_data: str) -> bytes:
    payload = image_data.split(",", 1)[1] if "," in image_data else image_data
    return base64.b64decode(payload)


def build_overlay_filter(frame_count: int, times: List[Dict[str, float]], width: int, height: int) -> str:
    if frame_count < 1:
        raise ValueError("need at least one overlay frame")
    parts: List[str] = []
    for i in range(frame_count):
        parts.append(f"[{i + 1}:v]format=rgba,scale={width}:{height}:flags=lanczos[o{i}]")
    last = "[0:v]"
    for i, fr in enumerate(times):
        start = float(fr["start"])
        end = float(fr["end"])
        out = "[outv]" if i == frame_count - 1 else f"[v{i}]"
        parts.append(
            f"{last}[o{i}]overlay=0:0:enable='between(t,{start:.3f},{end:.3f})':format=auto{out}"
        )
        last = f"[v{i}]"
    return ";".join(parts)


def _run_ffmpeg(args: List[str], cwd: str, timeout: int = 1800) -> None:
    ffmpeg = resolve_ffmpeg_bin()
    if not ffmpeg:
        raise RuntimeError("FFmpeg is not installed or not discoverable.")
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", *args]
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    res = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=timeout,
        stdin=subprocess.DEVNULL,
        creationflags=flags,
        cwd=cwd,
    )
    if res.returncode != 0:
        err = (res.stderr or res.stdout or "").strip()[-2000:]
        raise RuntimeError(err or f"FFmpeg failed with code {res.returncode}")


def export_video_with_png_overlays(
    video_path: str,
    output_path: str,
    frames: List[Dict[str, Any]],
    temp_dir: str | None = None,
    is_audio: bool = False,
) -> str:
    if not frames:
        raise ValueError("No PNG overlay frames provided for subtitle export.")
    if len(frames) > MAX_OVERLAY_FRAMES:
        raise ValueError(f"Too many overlay frames ({len(frames)}). Max is {MAX_OVERLAY_FRAMES}.")

    ffmpeg = resolve_ffmpeg_bin()
    if not ffmpeg:
        raise RuntimeError("FFmpeg is not installed or not discoverable.")

    abs_video = Path(video_path).resolve()
    abs_output = Path(output_path).resolve()
    if not abs_video.exists():
        raise FileNotFoundError(f"Input video missing: {abs_video}")
    abs_output.parent.mkdir(parents=True, exist_ok=True)

    work = Path(tempfile.gettempdir()) / "v1captions" / uuid.uuid4().hex
    work.mkdir(parents=True, exist_ok=True)

    try:
        in_name = "input" + (abs_video.suffix.lower() or ".mp4")
        shutil.copy2(abs_video, work / in_name)
        if needs_black_canvas(str(abs_video), is_audio):
            black_path = work / BLACK_STILL_NAME
            write_black_png(black_path, 64, 36)
            _run_ffmpeg(audio_canvas_args(in_name, BLACK_STILL_NAME), cwd=str(work))
            canvas = work / "canvas.mp4"
            if not canvas.is_file() or canvas.stat().st_size < 1000:
                raise RuntimeError("Could not build a black-background video from this audio file.")
            in_name = "canvas.mp4"

        saved: List[Dict[str, Any]] = []
        frame_w, frame_h = 1920, 1080
        for idx, item in enumerate(frames):
            img_bytes = decode_png_b64(item.get("image_data") or "")
            if len(img_bytes) < 24 or img_bytes[:8] != b"\x89PNG\r\n\x1a\n":
                raise ValueError(f"Overlay frame {idx} is not a PNG")
            color_type = img_bytes[25]
            if color_type not in (4, 6):
                raise ValueError(
                    f"Overlay frame {idx} has no alpha (PNG color type {color_type}). "
                    "Studio capture must use a transparent PNG."
                )
            w, h = struct.unpack(">II", img_bytes[16:24])
            if w > 0 and h > 0:
                frame_w, frame_h = w, h
            dest = work / f"ov{idx:03d}.png"
            dest.write_bytes(img_bytes)
            start = float(item.get("start", 0.0))
            end = float(item.get("end", 0.0))
            if end <= start:
                continue
            saved.append({"name": dest.name, "start": start, "end": end})

        if not saved:
            raise ValueError("No valid overlay time ranges")

        saved.sort(key=lambda x: x["start"])
        filter_graph = build_overlay_filter(len(saved), saved, frame_w, frame_h)

        args: List[str] = ["-i", in_name]
        for item in saved:
            args.extend(["-i", item["name"]])
        args.extend(
            [
                "-filter_complex",
                filter_graph,
                "-map",
                "[outv]",
                "-map",
                "0:a?",
                "-c:v",
                "libx264",
                "-preset",
                "fast",
                "-crf",
                "18",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "copy",
                "-movflags",
                "+faststart",
                "output.mp4",
            ]
        )
        _run_ffmpeg(args, cwd=str(work))
        out_tmp = work / "output.mp4"
        if not out_tmp.is_file() or out_tmp.stat().st_size < 1000:
            raise RuntimeError("Export produced an empty MP4")
        shutil.copy2(out_tmp, abs_output)
        return str(abs_output)
    finally:
        shutil.rmtree(work, ignore_errors=True)
