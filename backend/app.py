# Created by Subash Nepal · nepalsubash.com.np
import os
import sys
import uuid
import math
import shutil
import tempfile
import asyncio
import subprocess
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from faster_whisper import WhisperModel
from deep_translator import GoogleTranslator
import yt_dlp

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

UPLOADS_DIR = BACKEND_DIR / "uploads"
OUTPUTS_DIR = BACKEND_DIR / "outputs"
TEMP_DIR = BACKEND_DIR / "temp"

from utils.nepali_correction import process_nepali_correction_pipeline
from utils.caption_text import is_devanagari_text, is_junk_token, sanitize_caption_text
from utils.ffmpeg_tools import (
    ffmpeg_available,
    ffmpeg_location_dir,
    require_ffmpeg_or_raise,
    resolve_ffmpeg_bin,
    resolve_ffprobe_bin,
)
from utils.job_identity import parse_job_id, resolve_contained_file, resolve_output_file
from utils.job_store import load_job, persist_job
from utils.script_model import (
    coerce_output_script,
    coerce_source_language,
    normalize_output_script,
    normalize_source_language,
    normalize_transliteration_mode,
    resolve_transliteration_mode,
)
from utils.caption_script import apply_output_script, snapshot_native
from utils.devanagari_romanize import romanize_caption
from utils.png_overlay_export import MAX_OVERLAY_FRAMES, export_video_with_png_overlays
from utils.youtube_url import validate_youtube_url
from utils.ass_text import (
    ass_bgr_amp,
    escape_ass_text,
    safe_anim,
    safe_font_name,
    safe_hex_color,
    safe_position,
    safe_transform,
    wrap_caption_lines,
)
from utils.upload_validate import AUDIO_EXT, MAX_UPLOAD_BYTES, extension_ok, read_upload_limited
from utils.recording_limits import (
    MAX_RECORDING_DURATION_SECONDS,
    recording_duration_error,
)
from utils.whisper_decode import get_transcription_config, requested_whisper_model, whisper_transcribe_options
from utils.transcription_quality import coerce_transcription_quality, normalize_transcription_quality
from utils.nepali_asr_correct import correct_nepali_asr
from utils.nepali_normalize import normalize_nepali_text

app = FastAPI(title="Auto Captions Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

for _dir in (UPLOADS_DIR, OUTPUTS_DIR, TEMP_DIR):
    _dir.mkdir(parents=True, exist_ok=True)

cpu_worker_count = max(1, (os.cpu_count() or 4) - 1)

# Global Model Cache (loaded once on demand per language)
MODEL_CACHE: Dict[str, Any] = {}
MODEL_RUNTIME: Dict[str, dict] = {}

def get_device_and_compute():
    device = "cpu"
    compute_type = "int8"
    try:
        import torch
        if torch.cuda.is_available():
            device = "cuda"
            compute_type = "float16"
    except Exception:
        pass
    return device, compute_type

def load_whisper_model(key: str, name: str, preferred_compute: Optional[str] = None) -> WhisperModel:
    """Loads and caches Whisper model in MODEL_CACHE on demand."""
    if key in MODEL_CACHE:
        return MODEL_CACHE[key]

    device, compute_type = get_device_and_compute()
    compute_try = []
    if preferred_compute:
        compute_try.append(preferred_compute)
    compute_try.append(compute_type)
    if "int8" not in compute_try:
        compute_try.append("int8")

    model = None
    last_err = None
    used_device, used_ct = device, compute_type
    for ct in compute_try:
        print(f"Loading WhisperModel '{name}' for key '{key}' on {device} ({ct})...")
        try:
            model = WhisperModel(name, device=device, compute_type=ct, cpu_threads=cpu_worker_count)
            used_device, used_ct = device, ct
            break
        except Exception as e:
            last_err = e
            print(f"Load notice for {name} {ct} ({e}).")
    if model is None:
        print(f"Primary load failed ({last_err}). Using CPU int8 fallback...")
        model = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=cpu_worker_count)
        used_device, used_ct = "cpu", "int8"

    MODEL_CACHE[key] = model
    MODEL_RUNTIME[key] = {"device": used_device, "compute_type": used_ct, "name": name}
    return model

FFMPEG_MISSING_MSG = (
    "FFmpeg is not installed or not discoverable. "
    "Install with: winget install Gyan.FFmpeg "
    "Then restart the backend (close the backend terminal and run setup.bat again)."
)

def require_ffmpeg():
    if not ffmpeg_available():
        raise HTTPException(status_code=503, detail=FFMPEG_MISSING_MSG)

@app.on_event("startup")
async def startup_event():
    print("FastAPI server started successfully on http://127.0.0.1:8000")
    if ffmpeg_available():
        print(f"FFmpeg detected: {resolve_ffmpeg_bin()}")
    else:
        print(f"WARNING: {FFMPEG_MISSING_MSG}")

def get_whisper_model_and_language(language_code: Optional[str], quality: Optional[str] = "fast"):
    """
    Returns (model, forced_lang, label, meta).
    meta always records requested vs actual model (no silent High Accuracy lie).
    """
    lang = coerce_source_language(language_code)
    cfg = get_transcription_config(quality=quality, language=None if lang == "auto" else lang)
    requested = cfg["requested_model"]
    runtime_key = "mix"
    actual = requested
    fallback = False
    reason = None
    label = "Auto language model (medium)"
    forced = None

    if lang == "en":
        runtime_key = "en"
        model = load_whisper_model("en", "small")
        forced, label = "en", "English model (small)"
        actual = "small"
    elif lang == "hi":
        runtime_key = "hi"
        model = load_whisper_model("hi", "medium")
        forced, label = "hi", "Hindi model (medium)"
        actual = "medium"
    elif lang == "ne":
        if cfg["quality"] == "high_accuracy":
            try:
                runtime_key = "ne"
                model = load_whisper_model("ne", "large-v3", preferred_compute="int8_float32")
                forced, label = "ne", "Nepali model (large-v3, high accuracy)"
                actual = "large-v3"
            except Exception as e:
                print(f"Nepali large-v3 unavailable ({e}). Falling back to medium.")
                runtime_key = "ne-medium"
                model = load_whisper_model("ne-medium", "medium")
                forced, label = "ne", "Nepali model (medium fallback)"
                actual = "medium"
                fallback = True
                reason = "insufficient_memory" if "memory" in str(e).lower() else "load_failed"
        else:
            runtime_key = "ne-medium"
            model = load_whisper_model("ne-medium", "medium")
            forced, label = "ne", "Nepali model (medium, fast)"
            actual = "medium"
    else:
        model = load_whisper_model("mix", "medium")
        actual = "medium"

    rt = MODEL_RUNTIME.get(runtime_key) or {}
    meta = {
        "quality": cfg["quality"],
        "requested_model": requested,
        "actual_model": actual,
        "fallback": fallback,
        "fallback_reason": reason,
        "device": rt.get("device"),
        "compute_type": rt.get("compute_type"),
        "beam_size": cfg["beam_size"],
        "vad_enabled": cfg["vad_enabled"],
    }
    return model, forced, label, meta

jobs: Dict[str, dict] = {}
MAX_ACTIVE_JOBS = 2
JOB_TTL_SECONDS = 7 * 24 * 3600
YOUTUBE_MAX_BYTES = 2 * 1024 * 1024 * 1024

def count_active_jobs() -> int:
    n = 0
    for job in jobs.values():
        st = job.get("transcription_status") or job.get("status") or ""
        if st not in {"completed", "failed"} and job.get("export_status") != "failed":
            if st not in {"completed", "failed"}:
                n += 1
    return n


def persist(job_id: str) -> None:
    job = jobs.get(job_id)
    if job:
        persist_job(OUTPUTS_DIR, job)


def get_job(job_id: str) -> dict:
    jid = parse_job_id(job_id)
    if jid in jobs:
        return jobs[jid]
    loaded = load_job(OUTPUTS_DIR, jid)
    if not loaded:
        raise HTTPException(status_code=404, detail="Job not found")
    jobs[jid] = loaded
    return loaded


def require_upload_path(path_str: Optional[str]) -> str:
    if not path_str:
        raise HTTPException(status_code=400, detail="Original media file missing")
    try:
        resolved = Path(path_str).resolve()
        resolved.relative_to(UPLOADS_DIR.resolve())
    except Exception:
        raise HTTPException(status_code=400, detail="Media path is not allowed")
    if not resolved.exists():
        raise HTTPException(status_code=400, detail="Media file not found")
    return str(resolved)

AUDIO_EXTENSIONS = AUDIO_EXT

class YouTubeRequest(BaseModel):
    url: str
    language: Optional[str] = None
    output_script: Optional[str] = None
    transcription_quality: Optional[str] = None

class SubtitleItem(BaseModel):
    id: int
    start: float
    end: float
    text: str
    words: Optional[List[dict]] = None
    native_text: Optional[str] = None
    native_words: Optional[List[dict]] = None
    text_edited: Optional[bool] = None

class SubtitlesUpdateRequest(BaseModel):
    subtitles: List[SubtitleItem]

class TranslateRequest(BaseModel):
    target_language: str

class ScriptConvertRequest(BaseModel):
    output_script: str
    transliteration_mode: Optional[str] = None

class RetranscribeRequest(BaseModel):
    language: Optional[str] = None
    output_script: Optional[str] = None
    transcription_quality: Optional[str] = None

class OverlayFrame(BaseModel):
    start: float
    end: float
    image_data: str = Field(..., max_length=12_000_000)


class BurnRequest(BaseModel):
    style_config: Optional[dict] = None
    frames: Optional[List[OverlayFrame]] = None

def add_log(job_id: str, message: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    if job_id in jobs:
        if "logs" not in jobs[job_id]:
            jobs[job_id]["logs"] = []
        jobs[job_id]["logs"].append(log_entry)
        jobs[job_id]["message"] = message
        persist(job_id)
    print(log_entry)

def update_job(job_id: str, **fields):
    if job_id in jobs:
        jobs[job_id].update(fields)
        persist(job_id)

def run_ffmpeg(args: List[str], timeout: int = 600, cwd: Optional[str] = None) -> None:
    ffmpeg = resolve_ffmpeg_bin()
    if not ffmpeg:
        raise RuntimeError(FFMPEG_MISSING_MSG)
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-nostdin", "-y", *args]
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            stdin=subprocess.DEVNULL,
            creationflags=flags,
            cwd=cwd,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"FFmpeg timed out after {timeout}s") from exc
    if res.returncode != 0:
        err = (res.stderr or res.stdout or "").strip()[-2000:]
        raise RuntimeError(err or f"FFmpeg failed with code {res.returncode}")

ASS_FONT_MAP = {
    "Inter": "Arial",
    "Poppins": "Arial",
    "Montserrat": "Arial",
    "Noto Sans Devanagari": "Nirmala UI",
    "Mukta": "Nirmala UI",
    "Playfair Display": "Georgia",
    "Teko": "Impact",
    "sans-serif": "Arial",
    "Default": "Nirmala UI",
}

def apply_text_transform(text: str, transform: Optional[str]) -> str:
    if not text:
        return ""
    t = (transform or "none").lower()
    if t == "uppercase":
        return text.upper()
    if t == "lowercase":
        return text.lower()
    if t == "capitalize":
        return text.title()
    return text

def burn_ass_to_video(video_path: str, ass_path: str, output_path: str) -> None:
    """Burn ASS from a space-free temp dir so FFmpeg cannot fail on OneDrive paths."""
    work = Path(tempfile.gettempdir()) / "v1captions" / uuid.uuid4().hex
    work.mkdir(parents=True, exist_ok=True)
    try:
        in_name = "input" + Path(video_path).suffix.lower()
        if in_name == "input":
            in_name = "input.mp4"
        shutil.copy2(video_path, work / in_name)
        shutil.copy2(ass_path, work / "subs.ass")
        fonts = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
        if fonts.is_dir():
            fontsdir = str(fonts).replace("\\", "/").replace(":", r"\:")
            vf = f"subtitles=subs.ass:fontsdir={fontsdir}:charenc=UTF-8"
        else:
            vf = "subtitles=subs.ass:charenc=UTF-8"
        try:
            run_ffmpeg(
                [
                    "-i", in_name,
                    "-vf", vf,
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "18",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "copy",
                    "-movflags", "+faststart",
                    "output.mp4",
                ],
                timeout=1800,
                cwd=str(work),
            )
        except RuntimeError:
            run_ffmpeg(
                [
                    "-i", in_name,
                    "-vf", "ass=subs.ass",
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "18",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-movflags", "+faststart",
                    "output.mp4",
                ],
                timeout=1800,
                cwd=str(work),
            )
        out_file = work / "output.mp4"
        if not out_file.exists() or out_file.stat().st_size < 1000:
            raise RuntimeError("FFmpeg finished but the subtitled MP4 was empty.")
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(out_file, output_path)
    finally:
        shutil.rmtree(work, ignore_errors=True)

def format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

def format_vtt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02}:{m:02}:{s:02}.{ms:03}"

def format_ass_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int((seconds - int(seconds)) * 100)
    return f"{h}:{m:02}:{s:02}.{cs:02}"

def hex_to_ass_color(hex_color: str, opacity: float = 1.0) -> str:
    if not hex_color:
        hex_color = "#FFFFFF"
    c = hex_color.replace("#", "")
    if len(c) == 3:
        c = "".join([x * 2 for x in c])
    if len(c) != 6:
        c = "FFFFFF"

    r = c[0:2]
    g = c[2:4]
    b = c[4:6]

    alpha = int((1.0 - max(0.0, min(1.0, opacity))) * 255)
    alpha_hex = f"{alpha:02X}"

    return f"&H{alpha_hex}{b}{g}{r}".upper()

def is_audio_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in AUDIO_EXTENSIONS

def get_media_duration(file_path: str) -> float:
    try:
        ffprobe = resolve_ffprobe_bin()
        if not ffprobe:
            return 0.0
        cmd = [
            ffprobe, "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            file_path
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return float(res.stdout.strip())
    except Exception:
        return 0.0

def get_media_dimensions(file_path: str) -> tuple[int, int]:
    try:
        ffprobe = resolve_ffprobe_bin()
        if not ffprobe:
            return 1920, 1080
        cmd = [
            ffprobe, "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=p=0:s=x",
            file_path,
        ]
        flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
        res = subprocess.run(cmd, capture_output=True, text=True, check=True, creationflags=flags)
        parts = (res.stdout or "").strip().split("x")
        w, h = int(parts[0]), int(parts[1])
        if w >= 16 and h >= 16:
            return w, h
    except Exception:
        pass
    return 1920, 1080


def generate_ass_file(
    job_id: str,
    subtitles: List[dict],
    style_config: Optional[dict] = None,
    play_res: Optional[tuple] = None,
) -> str:
    ass_path = str(resolve_output_file(OUTPUTS_DIR, job_id, ".ass"))
    styles = style_config or {}
    font_name = safe_font_name(styles.get("fontFamily"))
    play_w, play_h = play_res if play_res else (1920, 1080)
    play_w = max(16, int(play_w))
    play_h = max(16, int(play_h))
    preview_scale = play_h / 540.0
    font_size = max(18, int(round(float(styles.get("fontSize", 24)) * preview_scale)))
    bold = -1 if str(styles.get("fontWeight", "600")) in ["600", "700", "900", "bold"] else 0
    try:
        spacing = float(styles.get("letterSpacing") or 0) * 10
    except (TypeError, ValueError):
        spacing = 0.0
    text_transform = safe_transform(styles.get("textTransform"))

    primary_col = hex_to_ass_color(safe_hex_color(styles.get("textColor"), "#FAFAFA"), 1.0)
    try:
        bg_opacity = float(styles.get("bgOpacity", 0.6))
    except (TypeError, ValueError):
        bg_opacity = 0.6
    bg_opacity = max(0.0, min(1.0, bg_opacity))
    back_col = hex_to_ass_color(safe_hex_color(styles.get("bgColor"), "#0B0B0B"), bg_opacity)
    outline_col = hex_to_ass_color(safe_hex_color(styles.get("outlineColor"), "#000000"), 1.0)

    try:
        outline_width = max(0, round(float(styles.get("outlineWidth", 1)) * preview_scale))
    except (TypeError, ValueError):
        outline_width = 2
    try:
        shadow_blur = max(0, round(float(styles.get("shadowBlur", 4)) * preview_scale / 2))
    except (TypeError, ValueError):
        shadow_blur = 2
    border_style = 3 if bg_opacity > 0.05 else 1
    # Viral looks use a hard stroke, not a box.
    if bg_opacity <= 0.05:
        outline_width = max(outline_width, max(4, round(3 * preview_scale)))

    pos = safe_position(styles.get("position"))
    alignment = 2
    if pos == "top":
        alignment = 8
    elif pos == "center":
        alignment = 5

    try:
        margin_v = max(10, int(round(float(styles.get("marginV", 30)) * preview_scale)))
    except (TypeError, ValueError):
        margin_v = 40
    anim_preset = safe_anim(styles.get("animationPreset"))
    accent_mode = styles.get("accentMode") if styles.get("accentMode") in {"none", "last-word"} else "none"
    highlight_col = hex_to_ass_color(safe_hex_color(styles.get("highlightColor"), "#FF2BD6"), 1.0)
    highlight_fill = ass_bgr_amp(styles.get("highlightColor"), "#FF2BD6")
    primary_fill = ass_bgr_amp(styles.get("textColor"), "#FFFFFF")
    outline_fill = ass_bgr_amp(styles.get("outlineColor"), "#000000")
    max_words = int(styles.get("maxWordsPerLine") or 4)
    max_chars = int(styles.get("maxCharsPerLine") or 18)

    header = f"""[Script Info]
Title: Subtitles
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
PlayResX: {play_w}
PlayResY: {play_h}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_col},{highlight_col},{outline_col},{back_col},{bold},0,0,0,100,100,{spacing:.1f},0,{border_style},{outline_width},{shadow_blur},{alignment},50,50,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    force = f"{{\\b1\\bord{outline_width}\\shad{max(1, shadow_blur)}\\1c{primary_fill}\\3c{outline_fill}}}"

    def last_word_ass(payload: str) -> str:
        lines = wrap_caption_lines(payload, max_words=max_words, max_chars=max_chars)
        if not lines:
            return force
        rendered = []
        for i, line in enumerate(lines):
            parts = line.split()
            if i == len(lines) - 1 and parts:
                last = escape_ass_text(parts[-1])
                rest = escape_ass_text(" ".join(parts[:-1]))
                accent = f"{{\\1c{highlight_fill}\\b1}}{last}{{\\1c{primary_fill}}}"
                rendered.append(f"{rest} {accent}".strip() if rest else accent)
            else:
                rendered.append(escape_ass_text(line))
        return force + r"\N".join(rendered)

    with open(ass_path, "w", encoding="utf-8-sig") as f:
        f.write(header)
        for sub in subtitles:
            start_t = format_ass_time(sub["start"])
            end_t = format_ass_time(sub["end"])

            clean_t = apply_text_transform(process_nepali_correction_pipeline(sub.get("text", "")), text_transform)
            words = sub.get("words") or []
            karaoke_ok = anim_preset in ["karaoke", "highlight-word", "bounce", "pulse"] and words
            if karaoke_ok:
                ass_line = force
                for w_obj in words:
                    w_text = escape_ass_text(apply_text_transform(process_nepali_correction_pipeline(w_obj.get("text", "")), text_transform))
                    if not w_text:
                        continue
                    w_start = w_obj.get("start", sub["start"])
                    w_end = w_obj.get("end", sub["end"])
                    try:
                        cs = max(1, int(round((float(w_end) - float(w_start)) * 100)))
                    except (TypeError, ValueError):
                        cs = 12
                    ass_line += f"{{\\kf{cs}\\1c{highlight_fill}}}{w_text} "
                ass_line = ass_line.strip()
                f.write(f"Dialogue: 0,{start_t},{end_t},Default,,0,0,0,,{ass_line}\n")
            elif anim_preset in ["fade-in", "slide-up"]:
                body = last_word_ass(clean_t) if accent_mode == "last-word" else force + escape_ass_text(clean_t)
                f.write(f"Dialogue: 0,{start_t},{end_t},Default,,0,0,0,,{{\\fad(120,80)}}{body}\n")
            elif accent_mode == "last-word" and clean_t.strip():
                f.write(f"Dialogue: 0,{start_t},{end_t},Default,,0,0,0,,{last_word_ass(clean_t)}\n")
            else:
                wrapped = wrap_caption_lines(clean_t, max_words=max_words, max_chars=max_chars)
                text_ass = force + r"\N".join(escape_ass_text(ln) for ln in wrapped)
                f.write(f"Dialogue: 0,{start_t},{end_t},Default,,0,0,0,,{text_ass}\n")

    return ass_path

def save_srt_and_vtt(job_id: str, subtitles: List[dict]):
    srt_path = str(resolve_output_file(OUTPUTS_DIR, job_id, ".srt"))
    vtt_path = str(resolve_output_file(OUTPUTS_DIR, job_id, ".vtt"))

    with open(srt_path, "w", encoding="utf-8") as f:
        for idx, sub in enumerate(subtitles, start=1):
            f.write(f"{idx}\n")
            f.write(f"{format_srt_time(sub['start'])} --> {format_srt_time(sub['end'])}\n")
            f.write(f"{process_nepali_correction_pipeline(sub['text'])}\n\n")

    with open(vtt_path, "w", encoding="utf-8") as f:
        f.write("WEBVTT\n\n")
        f.write("NOTE Created by V1 Captions\n\n")
        for idx, sub in enumerate(subtitles, start=1):
            f.write(f"{idx}\n")
            f.write(f"{format_vtt_time(sub['start'])} --> {format_vtt_time(sub['end'])}\n")
            f.write(f"{process_nepali_correction_pipeline(sub['text'])}\n\n")

    if job_id in jobs:
        jobs[job_id]["srt_path"] = srt_path
        jobs[job_id]["vtt_path"] = vtt_path


def _public_transcription_error(exc: BaseException) -> str:
    if isinstance(exc, HTTPException):
        return str(exc.detail)
    text = str(exc) or type(exc).__name__
    lower = text.lower()
    if "out of memory" in lower or "cuda" in lower or isinstance(exc, MemoryError):
        return "Speech model ran out of memory. Restart the API and try again, or use Auto language."
    if "no such file" in lower or "ffmpeg" in lower:
        return "Audio extraction failed. Confirm FFmpeg is installed and restart the API."
    if isinstance(exc, (UnboundLocalError, NameError, TypeError, ValueError)):
        return f"Transcription failed ({type(exc).__name__}). Restart the API and try again."
    return "Transcription failed."


def cues_from_whisper_segments(segments) -> list:
    subtitles = []
    for idx, seg in enumerate(segments, start=1):
        words = []
        if hasattr(seg, "words") and seg.words:
            for w in seg.words:
                token = sanitize_caption_text(w.word)
                if not token or is_junk_token(token):
                    continue
                words.append({
                    "text": token,
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    **({"confidence": round(float(w.probability), 3)} if getattr(w, "probability", None) is not None else {}),
                })
        else:
            raw_words = sanitize_caption_text(seg.text).split()
            total_dur = max(0.1, seg.end - seg.start)
            w_dur = total_dur / max(1, len(raw_words))
            for i, rw in enumerate(raw_words):
                token = sanitize_caption_text(rw)
                if not token or is_junk_token(token):
                    continue
                words.append({
                    "text": token,
                    "start": round(seg.start + i * w_dur, 3),
                    "end": round(seg.start + (i + 1) * w_dur, 3)
                })

        cue_text = sanitize_caption_text(seg.text)
        if is_devanagari_text(cue_text):
            cue_text, words = correct_nepali_asr(cue_text, words=words or None)
        if not cue_text and words:
            cue_text = " ".join(w["text"] for w in words)
        if not cue_text:
            continue

        subtitles.append({
            "id": idx,
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": cue_text,
            "words": words
        })
    return subtitles


def _run_whisper_pass(model, audio_path: str, transcribe_kwargs: dict):
    segments, info = model.transcribe(audio_path, **transcribe_kwargs)
    return list(segments), info


def process_transcription_job(job_id: str, file_path: str, language: Optional[str] = None):
    transcribe_kwargs = whisper_transcribe_options(coerce_source_language(language) if language else None)
    try:
        add_log(job_id, "Upload received")
        source_type = (jobs.get(job_id) or {}).get("source_type") or "upload"
        is_audio = bool((jobs.get(job_id) or {}).get("is_audio")) or is_audio_file(file_path)
        if source_type == "recording":
            is_audio = True
        if job_id in jobs:
            jobs[job_id]["is_audio"] = is_audio
            jobs[job_id]["status"] = "processing media"
            jobs[job_id]["progress"] = 15

        add_log(job_id, "Media metadata loaded")
        duration = get_media_duration(file_path)
        if job_id in jobs:
            jobs[job_id]["duration"] = duration
        if source_type == "recording":
            dur_err = recording_duration_error(duration)
            if dur_err == "RECORDING_TOO_LONG":
                update_job(
                    job_id,
                    status="failed",
                    transcription_status="failed",
                    error_code="RECORDING_TOO_LONG",
                    error="Recording exceeds the 30-minute limit.",
                    message="Recording exceeds the 30-minute limit.",
                )
                return

        clean_audio = str(TEMP_DIR / f"{job_id}_clean.wav")

        # Simple & Reliable Audio Pipeline: 16k mono WAV
        add_log(job_id, "Extracting audio with FFmpeg")
        update_job(job_id, status="extracting audio", progress=20)
        run_ffmpeg([
            "-i", file_path,
            "-vn", "-ac", "1", "-ar", "16000",
            "-c:a", "pcm_s16le",
            clean_audio
        ])

        update_job(job_id, progress=28, status="loading speech model")
        add_log(job_id, "Audio extracted. Loading Whisper (first run downloads the model and can take several minutes)...")

        quality = coerce_transcription_quality((jobs.get(job_id) or {}).get("transcription_quality"))
        cfg = get_transcription_config(quality=quality, language=None if coerce_source_language(language) == "auto" else coerce_source_language(language))
        add_log(job_id, f"requested_quality={cfg['quality']} requested_model={cfg['requested_model']}")
        model, forced_lang, model_label, asr_meta = get_whisper_model_and_language(language, quality)
        transcribe_kwargs = whisper_transcribe_options(forced_lang, quality)
        if asr_meta.get("fallback"):
            add_log(
                job_id,
                f"quality={asr_meta['quality']} requested_model={asr_meta['requested_model']} "
                f"actual_model={asr_meta['actual_model']} fallback=true reason={asr_meta.get('fallback_reason')} "
                f"device={asr_meta.get('device')} compute_type={asr_meta.get('compute_type')}",
            )
        else:
            add_log(
                job_id,
                f"quality={asr_meta['quality']} requested_model={asr_meta['requested_model']} "
                f"actual_model={asr_meta['actual_model']} fallback=false "
                f"device={asr_meta.get('device')} compute_type={asr_meta.get('compute_type')} beam={asr_meta.get('beam_size')} vad={asr_meta.get('vad_enabled')}",
            )
        update_job(
            job_id,
            transcription_quality=asr_meta["quality"],
            requested_model=asr_meta["requested_model"],
            actual_model=asr_meta["actual_model"],
            asr_fallback=asr_meta["fallback"],
            asr_fallback_reason=asr_meta.get("fallback_reason"),
            asr_device=asr_meta.get("device"),
            asr_compute_type=asr_meta.get("compute_type"),
            asr_beam_size=asr_meta.get("beam_size"),
        )

        add_log(job_id, "Transcribing speech — this stays on this step until the whole file is done")
        update_job(job_id, progress=40, status="transcribing")

        def transcribe_now(kwargs):
            nonlocal model, model_label
            try:
                return _run_whisper_pass(model, clean_audio, kwargs)
            except Exception as transcribe_err:
                if "large-v3" in model_label:
                    add_log(job_id, f"large-v3 decode failed ({transcribe_err}); retrying with medium")
                    model = load_whisper_model("ne-medium", "medium")
                    model_label = "Nepali model (medium fallback)"
                    update_job(
                        job_id,
                        actual_model="medium",
                        asr_fallback=True,
                        asr_fallback_reason="decode_failed",
                    )
                    return _run_whisper_pass(model, clean_audio, kwargs)
                raise

        segments, info = transcribe_now(transcribe_kwargs)
        subtitles = cues_from_whisper_segments(segments)
        if subtitles:
            add_log(job_id, "First speech segment decoded — transcription is running")

        if not subtitles and transcribe_kwargs.get("vad_filter"):
            add_log(job_id, "No cues with VAD; retrying without voice-activity filter")
            retry_kw = {k: v for k, v in transcribe_kwargs.items() if k != "vad_parameters"}
            retry_kw["vad_filter"] = False
            segments, info = transcribe_now(retry_kw)
            subtitles = cues_from_whisper_segments(segments)

        if not subtitles and transcribe_kwargs.get("language"):
            add_log(job_id, "No cues with forced language; retrying auto language detect")
            retry_kw = {k: v for k, v in transcribe_kwargs.items() if k not in ("language", "vad_parameters")}
            retry_kw["vad_filter"] = False
            segments, info = transcribe_now(retry_kw)
            subtitles = cues_from_whisper_segments(segments)

        if not subtitles:
            msg = "No speech was detected in this recording." if source_type == "recording" else "No speech was detected in this media."
            update_job(
                job_id,
                status="failed",
                transcription_status="failed",
                error_code="NO_SPEECH_DETECTED",
                error=msg,
                message=msg,
            )
            add_log(job_id, msg)
            return

        detected = forced_lang or getattr(info, "language", None) or "en"
        job_rec = jobs.get(job_id) or {}
        src = coerce_source_language(job_rec.get("source_language") or language or "auto")
        effective = detected if src == "auto" and detected in ("ne", "hi", "en") else src
        if src != "auto":
            effective = src
        script = coerce_output_script(job_rec.get("output_script"), effective)
        mode = resolve_transliteration_mode(effective, script)
        subtitles = apply_output_script(
            [snapshot_native(s) for s in subtitles],
            output_script=script,
            source_language=effective,
            transliteration_mode=mode,
            respect_edits=False,
        )
        add_log(job_id, "Normalization and correction completed")
        add_log(job_id, f"Caption script: {script} ({mode})")

        add_log(job_id, "Generating timeline")
        if job_id in jobs:
            jobs[job_id]["subtitles"] = subtitles
            jobs[job_id]["detected_language"] = detected
            jobs[job_id]["source_language"] = src
            jobs[job_id]["output_language"] = effective
            jobs[job_id]["output_script"] = script
            jobs[job_id]["transliteration_mode"] = mode
            jobs[job_id]["status"] = "generating caption files"
            jobs[job_id]["progress"] = 85

        save_srt_and_vtt(job_id, subtitles)

        if os.path.exists(clean_audio):
            try:
                os.remove(clean_audio)
            except Exception:
                pass

        update_job(
            job_id,
            status="completed",
            transcription_status="completed",
            progress=100,
            message="Transcription completed successfully!",
        )
        add_log(job_id, "Completed")

    except Exception as e:
        add_log(job_id, f"Error: {e}")
        public = _public_transcription_error(e)
        update_job(
            job_id,
            status="failed",
            transcription_status="failed",
            error_code="TRANSCRIPTION_FAILED",
            error=public,
            message=public,
        )


def _new_job(job_id: str, **fields) -> dict:
    job = {
        "job_id": job_id,
        "filename": fields.get("filename", "media"),
        "video_path": fields.get("video_path"),
        "is_audio": fields.get("is_audio", False),
        "language": fields.get("language"),
        "status": fields.get("status", "processing"),
        "transcription_status": fields.get("transcription_status", "processing"),
        "export_status": "idle",
        "source_type": fields.get("source_type", "upload"),
        "source_language": fields.get("source_language") or fields.get("language") or "auto",
        "output_language": fields.get("output_language") or fields.get("language") or "auto",
        "output_script": fields.get("output_script", "native"),
        "transliteration_mode": fields.get("transliteration_mode", "none"),
        "transcription_quality": fields.get("transcription_quality", "fast"),
        "error_code": None,
        "progress": fields.get("progress", 10),
        "message": fields.get("message", ""),
        "subtitles": [],
        "srt_path": None,
        "vtt_path": None,
        "burned_path": None,
        "error": None,
        "logs": [],
    }
    jobs[job_id] = job
    persist(job_id)
    return job


@app.get("/health")
async def health():
    return {
        "ok": True,
        "ffmpeg": ffmpeg_available(),
        "jobs_in_memory": len(jobs),
        "max_active_jobs": MAX_ACTIVE_JOBS,
        "max_upload_mb": MAX_UPLOAD_BYTES // (1024 * 1024),
        "max_recording_seconds": MAX_RECORDING_DURATION_SECONDS,
    }


@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    source_type: Optional[str] = Form(None),
    output_script: Optional[str] = Form(None),
    transcription_quality: Optional[str] = Form(None),
):
    require_ffmpeg()
    active = sum(
        1 for j in jobs.values()
        if j.get("transcription_status") not in {"completed", "failed"}
    )
    if active >= MAX_ACTIVE_JOBS:
        raise HTTPException(status_code=429, detail="Too many active jobs. Wait for an existing job to finish.")
    try:
        stype = "recording" if (source_type or "").strip().lower() == "recording" else "upload"
        src_lang = normalize_source_language(language)
        script = normalize_output_script(output_script, src_lang)
        mode = resolve_transliteration_mode(src_lang, script)
        quality = normalize_transcription_quality(transcription_quality)
        job_id = str(uuid.uuid4())
        raw_filename = file.filename or ("recording.webm" if stype == "recording" else "video.mp4")
        clean_filename = os.path.basename(raw_filename)
        ext = extension_ok(clean_filename)
        dest = resolve_contained_file(UPLOADS_DIR, f"{job_id}{ext}")
        await read_upload_limited(file, dest)
        is_audio = True if stype == "recording" else is_audio_file(f"{job_id}{ext}")
        _new_job(
            job_id,
            filename="Voice recording" if stype == "recording" else clean_filename,
            video_path=str(dest),
            is_audio=is_audio,
            language=src_lang if src_lang != "auto" else language,
            source_language=src_lang,
            output_language=src_lang,
            output_script=script,
            transliteration_mode=mode,
            transcription_quality=quality,
            source_type=stype,
            status="processing",
            transcription_status="processing",
            progress=15,
            message="Uploading recording..." if stype == "recording" else "File uploaded successfully.",
        )
        background_tasks.add_task(process_transcription_job, job_id, str(dest), language)
        return {
            "success": True,
            "job_id": job_id,
            "is_audio": is_audio,
            "source_type": stype,
            "message": "Recording uploaded." if stype == "recording" else "File uploaded successfully.",
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during video upload: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload media.")


@app.post("/youtube")
async def process_youtube(background_tasks: BackgroundTasks, request: YouTubeRequest):
    try:
        url = validate_youtube_url(request.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    language = request.language
    src_lang = normalize_source_language(language)
    script = normalize_output_script(request.output_script, src_lang)
    mode = resolve_transliteration_mode(src_lang, script)
    require_ffmpeg()
    active = sum(
        1 for j in jobs.values()
        if j.get("transcription_status") not in {"completed", "failed"}
    )
    if active >= MAX_ACTIVE_JOBS:
        raise HTTPException(status_code=429, detail="Too many active jobs. Wait for an existing job to finish.")

    job_id = str(uuid.uuid4())
    out_template = str(UPLOADS_DIR / f"{job_id}.%(ext)s")
    _new_job(
        job_id,
        filename="YouTube Video",
        status="downloading youtube video",
        transcription_status="processing",
        progress=10,
        message="Fetching media from YouTube...",
        language=language,
        source_language=src_lang,
        output_language=src_lang,
        output_script=script,
        transliteration_mode=mode,
        transcription_quality=normalize_transcription_quality(request.transcription_quality),
        source_type="youtube",
    )

    def download_and_process():
        try:
            require_ffmpeg_or_raise()
            ffmpeg_dir = ffmpeg_location_dir()
            ydl_opts = {
                "format": "bv*[height<=1080]+ba/b[height<=1080]/b",
                "merge_output_format": "mp4",
                "outtmpl": out_template,
                "restrictfilenames": True,
                "quiet": True,
                "no_warnings": True,
                "retries": 3,
                "socket_timeout": 30,
                "max_filesize": YOUTUBE_MAX_BYTES,
            }
            if ffmpeg_dir:
                ydl_opts["ffmpeg_location"] = ffmpeg_dir
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=True)
                downloaded_file = ydl.prepare_filename(info_dict)
                root, _ = os.path.splitext(downloaded_file)
                merged_mp4 = root + ".mp4"
                if os.path.exists(merged_mp4):
                    downloaded_file = merged_mp4

            if not downloaded_file or not os.path.exists(downloaded_file):
                raise RuntimeError("YouTube download finished but media file was not found on disk.")

            contained = resolve_contained_file(UPLOADS_DIR, Path(downloaded_file).name)
            update_job(
                job_id,
                video_path=str(contained) if contained.exists() else downloaded_file,
                filename=os.path.basename(downloaded_file),
                is_audio=is_audio_file(downloaded_file),
            )
            process_transcription_job(job_id, jobs[job_id]["video_path"], language)
        except Exception as e:
            err = str(e)
            low = err.lower()
            if "ffmpeg is not installed" in low or ("ffmpeg" in low and "not installed" in low):
                err = FFMPEG_MISSING_MSG
            update_job(job_id, status="failed", transcription_status="failed", error=err, message=f"YouTube processing failed: {err}")
            add_log(job_id, f"Error: {err}")

    background_tasks.add_task(download_and_process)
    return {"success": True, "job_id": job_id, "message": "YouTube video queued."}


@app.get("/status/{job_id}")
async def get_status(job_id: str):
    job = get_job(job_id)
    return {
        "success": True,
        "job_id": job["job_id"],
        "status": job["status"],
        "transcription_status": job.get("transcription_status"),
        "export_status": job.get("export_status"),
        "progress": job["progress"],
        "message": job["message"],
        "is_audio": job.get("is_audio", False),
        "detected_language": job.get("detected_language"),
        "source_language": job.get("source_language"),
        "output_script": job.get("output_script", "native"),
        "transliteration_mode": job.get("transliteration_mode", "none"),
        "transcription_quality": job.get("transcription_quality", "fast"),
        "requested_model": job.get("requested_model"),
        "actual_model": job.get("actual_model"),
        "asr_fallback": bool(job.get("asr_fallback")),
        "asr_fallback_reason": job.get("asr_fallback_reason"),
        "asr_device": job.get("asr_device"),
        "asr_compute_type": job.get("asr_compute_type"),
        "asr_beam_size": job.get("asr_beam_size"),
        "error": job.get("error"),
        "error_code": job.get("error_code"),
        "source_type": job.get("source_type", "upload"),
        "logs": job.get("logs", []),
    }


@app.get("/logs/{job_id}")
async def get_job_logs(job_id: str):
    job = get_job(job_id)
    return {
        "success": True,
        "job_id": job["job_id"],
        "logs": job.get("logs", []),
        "status": job.get("status"),
        "progress": job.get("progress", 0),
        "message": job.get("message", ""),
    }


@app.websocket("/ws/logs/{job_id}")
async def websocket_logs(websocket: WebSocket, job_id: str):
    await websocket.accept()
    try:
        jid = parse_job_id(job_id)
    except HTTPException:
        await websocket.close(code=1008)
        return
    sent = 0
    try:
        while True:
            try:
                job = get_job(jid)
            except HTTPException:
                job = None
            logs = (job or {}).get("logs") or []
            while sent < len(logs):
                await websocket.send_json({"log": logs[sent]})
                sent += 1
            await asyncio.sleep(0.4)
    except WebSocketDisconnect:
        return


@app.get("/subtitles/{job_id}")
async def get_subtitles(job_id: str):
    job = get_job(job_id)
    return {
        "success": True,
        "job_id": job["job_id"],
        "subtitles": job.get("subtitles") or [],
        "filename": job.get("filename"),
        "is_audio": job.get("is_audio", False),
        "status": job.get("status"),
        "transcription_status": job.get("transcription_status"),
        "export_status": job.get("export_status"),
        "source_language": job.get("source_language") or job.get("language") or "auto",
        "output_script": job.get("output_script") or "native",
        "transliteration_mode": job.get("transliteration_mode") or "none",
        "detected_language": job.get("detected_language"),
    }


@app.post("/subtitles/{job_id}")
async def update_subtitles(job_id: str, request: SubtitlesUpdateRequest):
    job = get_job(job_id)
    incoming = validate_cues([s.model_dump() for s in request.subtitles])
    existing = {c.get("id"): c for c in (job.get("subtitles") or []) if isinstance(c, dict)}
    merged = []
    for cue in incoming:
        prev = existing.get(cue["id"], {})
        native = cue.get("native_text") or prev.get("native_text") or prev.get("text") or cue.get("text")
        cue["native_text"] = native
        if cue.get("native_words") is None:
            cue["native_words"] = prev.get("native_words")
        roman = romanize_caption(native) if native else ""
        if "text_edited" not in cue:
            cue["text_edited"] = cue.get("text") not in {native, roman, (native or "").strip()}
        merged.append(cue)
    job["subtitles"] = merged
    save_srt_and_vtt(job["job_id"], merged)
    persist(job["job_id"])
    return {
        "success": True,
        "job_id": job["job_id"],
        "message": "Subtitles updated successfully",
        "subtitles": merged,
    }


LANG_CODE_MAP = {
    "English": "en",
    "Nepali": "ne",
    "Hindi": "hi",
    "Spanish": "es",
    "French": "fr",
    "German": "de",
    "Japanese": "ja",
}


def _approx_words_from_text(text: str, start: float, end: float) -> list:
    tokens = [t for t in (text or "").split() if t]
    if not tokens:
        return []
    dur = max(0.05, float(end) - float(start))
    step = dur / len(tokens)
    words = []
    for i, tok in enumerate(tokens):
        words.append({
            "text": tok,
            "start": round(start + i * step, 3),
            "end": round(start + (i + 1) * step, 3),
        })
    return words


@app.post("/translate/{job_id}")
async def translate_subtitles(job_id: str, request: TranslateRequest):
    job = get_job(job_id)
    target_lang = request.target_language
    lang_code = LANG_CODE_MAP.get(target_lang)
    if not lang_code:
        raise HTTPException(status_code=400, detail="Unsupported target language")
    subtitles = job.get("subtitles") or []
    if not subtitles:
        raise HTTPException(status_code=400, detail="No subtitles available to translate")

    translator = GoogleTranslator(source="auto", target=lang_code)
    translated_subs = []
    failures = 0
    for sub in subtitles:
        source = sub.get("text") or ""
        if not source.strip():
            translated_subs.append({**sub, "text": "", "words": []})
            continue
        try:
            translated_text = translator.translate(source)
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Translation failed (Google Translate requires internet): {exc}",
            ) from exc
        if not translated_text or not str(translated_text).strip():
            failures += 1
            raise HTTPException(status_code=502, detail="Translation returned an empty result")
        translated_text = process_nepali_correction_pipeline(str(translated_text))
        translated_subs.append({
            "id": sub["id"],
            "start": sub["start"],
            "end": sub["end"],
            "text": translated_text,
            "words": _approx_words_from_text(translated_text, sub["start"], sub["end"]),
        })

    job["subtitles"] = translated_subs
    save_srt_and_vtt(job["job_id"], translated_subs)
    persist(job["job_id"])
    return {
        "success": True,
        "job_id": job["job_id"],
        "target_language": target_lang,
        "subtitles": translated_subs,
        "word_timings": "approximate",
        "privacy": "Caption text was sent to Google Translate.",
    }


@app.post("/script/{job_id}")
async def convert_caption_script(job_id: str, request: ScriptConvertRequest):
    """Change script only (romanize / restore native). Does not call Whisper or Google."""
    job = get_job(job_id)
    src = normalize_source_language(job.get("source_language") or job.get("detected_language") or job.get("language") or "auto")
    script = normalize_output_script(request.output_script, src)
    mode = normalize_transliteration_mode(request.transliteration_mode, src, script)
    cues = job.get("subtitles") or []
    if not cues:
        raise HTTPException(status_code=400, detail="No captions to convert.")
    updated = apply_output_script(
        [snapshot_native(c) for c in cues],
        output_script=script,
        source_language=src,
        transliteration_mode=mode,
        respect_edits=True,
    )
    job["subtitles"] = updated
    job["output_script"] = script
    job["transliteration_mode"] = mode
    job["output_language"] = src
    save_srt_and_vtt(job["job_id"], updated)
    persist(job["job_id"])
    return {
        "success": True,
        "job_id": job["job_id"],
        "output_script": script,
        "transliteration_mode": mode,
        "subtitles": updated,
        "note": "Script conversion is transliteration, not translation.",
    }


@app.post("/retranscribe/{job_id}")
async def retranscribe_job(job_id: str, background_tasks: BackgroundTasks, request: RetranscribeRequest):
    job = get_job(job_id)
    require_ffmpeg()
    video_path = require_upload_path(job.get("video_path"))
    src = normalize_source_language(request.language or job.get("source_language") or "auto")
    script = normalize_output_script(request.output_script or job.get("output_script"), src)
    mode = resolve_transliteration_mode(src, script)
    quality = normalize_transcription_quality(request.transcription_quality or job.get("transcription_quality"))
    update_job(
        job["job_id"],
        source_language=src,
        output_script=script,
        transliteration_mode=mode,
        transcription_quality=quality,
        language=None if src == "auto" else src,
        transcription_status="processing",
        status="processing",
        progress=10,
        message="Re-transcribing with selected language...",
        error=None,
        error_code=None,
    )
    whisper_lang = None if src == "auto" else src
    background_tasks.add_task(process_transcription_job, job["job_id"], video_path, whisper_lang)
    return {"success": True, "job_id": job["job_id"], "message": "Re-transcription started."}


@app.post("/burn/{job_id}")
async def burn_subtitles(job_id: str, background_tasks: BackgroundTasks, request: Optional[BurnRequest] = None):
    job = get_job(job_id)
    require_ffmpeg()
    video_path = require_upload_path(job.get("video_path"))
    subtitles = job.get("subtitles") or []
    if not subtitles:
        raise HTTPException(status_code=400, detail="No subtitles to burn. Save cues in the studio first.")
    overlay_frames = []
    if request and request.frames:
        overlay_frames = [f.model_dump() if hasattr(f, "model_dump") else f.dict() for f in request.frames]
    if not overlay_frames:
        raise HTTPException(
            status_code=400,
            detail="Export needs studio overlay frames so the file matches the review player.",
        )
    if len(overlay_frames) > MAX_OVERLAY_FRAMES:
        raise HTTPException(
            status_code=400,
            detail=f"Too many overlay frames ({len(overlay_frames)}). Max is {MAX_OVERLAY_FRAMES}.",
        )
    burned_path = str(resolve_output_file(OUTPUTS_DIR, job["job_id"], "_subtitled.mp4"))
    update_job(
        job["job_id"],
        export_status="burning",
        progress=90,
        message="Compositing studio overlay onto video...",
    )

    def process_burn():
        jid = job["job_id"]
        try:
            add_log(jid, "Burning captions from studio overlay (same renderer as preview)...")
            if job.get("is_audio"):
                add_log(jid, "Audio job: using a black 1920x1080 still as the video picture.")
            export_video_with_png_overlays(
                video_path,
                burned_path,
                overlay_frames,
                is_audio=bool(job.get("is_audio")),
            )
            update_job(
                jid,
                burned_path=burned_path,
                export_status="completed",
                status="completed",
                progress=100,
                message="Styled subtitles burned successfully!",
            )
            add_log(jid, "Export complete — captions are in the MP4")
        except Exception as e:
            print(f"Burn processing error: {str(e)}")
            trans = jobs.get(jid, {}).get("transcription_status", "completed")
            update_job(
                jid,
                export_status="failed",
                status="completed" if trans == "completed" else jobs.get(jid, {}).get("status"),
                error=str(e),
                message=f"Burning subtitles failed: {str(e)}",
            )
            add_log(jid, f"Error: {str(e)}")

    background_tasks.add_task(process_burn)
    return {"success": True, "job_id": job["job_id"], "message": "Subtitle burning started."}


@app.get("/video/{job_id}")
@app.get("/media/{job_id}")
async def serve_media(job_id: str):
    job = get_job(job_id)
    media_path = require_upload_path(job.get("video_path"))
    ext = os.path.splitext(media_path)[1].lower()
    media_type_map = {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".mov": "video/quicktime",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
    }
    return FileResponse(media_path, media_type=media_type_map.get(ext, "application/octet-stream"))


@app.get("/download/{job_id}.srt")
async def download_srt(job_id: str):
    path = resolve_output_file(OUTPUTS_DIR, job_id, ".srt")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="SRT file not found")
    return FileResponse(str(path), media_type="text/plain; charset=utf-8", filename=f"{parse_job_id(job_id)}.srt")


@app.get("/download/{job_id}.vtt")
async def download_vtt(job_id: str):
    path = resolve_output_file(OUTPUTS_DIR, job_id, ".vtt")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="VTT file not found")
    return FileResponse(str(path), media_type="text/vtt; charset=utf-8", filename=f"{parse_job_id(job_id)}.vtt")


@app.get("/download/{job_id}.mp4")
async def download_mp4(job_id: str):
    path = resolve_output_file(OUTPUTS_DIR, job_id, "_subtitled.mp4")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Burned MP4 file not found. Export from the studio first.")
    return FileResponse(str(path), media_type="video/mp4", filename=f"{parse_job_id(job_id)}_subtitled.mp4")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
