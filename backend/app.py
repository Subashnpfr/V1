# Created by Subash Nepal · nepalsubash.com.np
import os
import sys
import uuid
import math
import asyncio
import subprocess
import unicodedata
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
from utils.png_overlay_export import export_video_with_png_overlays
from utils.ffmpeg_tools import (
    ffmpeg_available,
    ffmpeg_location_dir,
    require_ffmpeg_or_raise,
    resolve_ffmpeg_bin,
    resolve_ffprobe_bin,
)

app = FastAPI(title="Auto Captions Studio API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for _dir in (UPLOADS_DIR, OUTPUTS_DIR, TEMP_DIR):
    _dir.mkdir(parents=True, exist_ok=True)

cpu_worker_count = max(1, (os.cpu_count() or 4) - 1)

# Global Model Cache (loaded once on demand per language)
MODEL_CACHE: Dict[str, Any] = {}

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

def load_whisper_model(key: str, name: str) -> WhisperModel:
    """Loads and caches Whisper model in MODEL_CACHE on demand."""
    if key in MODEL_CACHE:
        return MODEL_CACHE[key]

    device, compute_type = get_device_and_compute()
    print(f"Loading WhisperModel '{name}' for key '{key}' on {device} ({compute_type})...")
    try:
        model = WhisperModel(name, device=device, compute_type=compute_type, cpu_threads=cpu_worker_count)
    except Exception as e:
        print(f"Primary load notice for {name} ({e}). Using CPU int8 fallback...")
        model = WhisperModel(name, device="cpu", compute_type="int8", cpu_threads=cpu_worker_count)

    MODEL_CACHE[key] = model
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

def get_whisper_model_and_language(language_code: Optional[str]):
    """
    Stable model selection:
    English -> small
    Hindi   -> medium
    Nepali  -> large-v3
    Auto    -> large-v3
    """
    lang = (language_code or "auto").lower().strip()
    if lang == "en":
        model = load_whisper_model("en", "small")
        return model, "en", "English model (small)"
    elif lang == "hi":
        model = load_whisper_model("hi", "medium")
        return model, "hi", "Hindi model (medium)"
    elif lang == "ne":
        model = load_whisper_model("ne", "large-v3")
        return model, "ne", "Nepali model (large-v3)"
    else:
        model = load_whisper_model("mix", "large-v3")
        return model, None, "Nepali/Devanagari model (large-v3)"

jobs: Dict[str, dict] = {}
log_subscribers: Dict[str, set] = {}

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}

class YouTubeRequest(BaseModel):
    url: str
    language: Optional[str] = None

class SubtitleItem(BaseModel):
    id: int
    start: float
    end: float
    text: str
    words: Optional[List[dict]] = None

class SubtitlesUpdateRequest(BaseModel):
    subtitles: List[SubtitleItem]

class TranslateRequest(BaseModel):
    target_language: str

class BurnRequest(BaseModel):
    style_config: Optional[dict] = None
    frames: Optional[List[dict]] = None

def add_log(job_id: str, message: str):
    timestamp = datetime.now().strftime("%H:%M:%S")
    log_entry = f"[{timestamp}] {message}"
    if job_id in jobs:
        if "logs" not in jobs[job_id]:
            jobs[job_id]["logs"] = []
        jobs[job_id]["logs"].append(log_entry)
    print(log_entry)

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

def generate_ass_file(job_id: str, subtitles: List[dict], style_config: Optional[dict] = None) -> str:
    ass_path = str(OUTPUTS_DIR / f"{job_id}.ass")

    styles = style_config or {}
    font_name = styles.get("fontFamily", "Noto Sans Devanagari")
    if font_name in ["Inter", "sans-serif", "Arial", "Default"]:
        font_name = "Noto Sans Devanagari"

    font_size = styles.get("fontSize", 24)
    bold = -1 if str(styles.get("fontWeight", "600")) in ["600", "700", "900", "bold"] else 0

    primary_col = hex_to_ass_color(styles.get("textColor", "#FAFAFA"), 1.0)
    bg_opacity = styles.get("bgOpacity", 0.6)
    back_col = hex_to_ass_color(styles.get("bgColor", "#0B0B0B"), bg_opacity)
    outline_col = hex_to_ass_color(styles.get("outlineColor", "#000000"), 1.0)

    outline_width = styles.get("outlineWidth", 1)
    shadow_blur = styles.get("shadowBlur", 4)
    border_style = 3 if bg_opacity > 0.05 else 1

    pos = styles.get("position", "bottom")
    alignment = 2  # Bottom Center
    if pos == "top":
        alignment = 8  # Top Center
    elif pos == "center":
        alignment = 5  # Middle Center

    margin_v = styles.get("marginV", 30)
    anim_preset = styles.get("animationPreset", "none")
    highlight_col = hex_to_ass_color(styles.get("highlightColor", "#F59E0B"), 1.0)

    header = f"""[Script Info]
Title: Subtitles - Created by Subash Nepal · nepalsubash.com.np
Comment: Created by Subash Nepal · nepalsubash.com.np
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{primary_col},{highlight_col},{outline_col},{back_col},{bold},0,0,0,100,100,0,0,{border_style},{outline_width},{shadow_blur},{alignment},10,10,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header)
        for sub in subtitles:
            start_t = format_ass_time(sub["start"])
            end_t = format_ass_time(sub["end"])

            clean_t = process_nepali_correction_pipeline(sub.get("text", ""))
            words = sub.get("words", [])
            if anim_preset in ["karaoke", "highlight-word", "bounce", "pulse"] and words and len(words) > 0:
                ass_line = ""
                for w_obj in words:
                    w_text = process_nepali_correction_pipeline(w_obj.get("text", ""))
                    w_start = w_obj.get("start", sub["start"])
                    w_end = w_obj.get("end", sub["end"])
                    cs = max(1, int(round((w_end - w_start) * 100)))
                    ass_line += f"{{\\kf{cs}}}{w_text} "
                ass_line = ass_line.strip()
                f.write(f"Dialogue: 0,{start_t},{end_t},Default,,0,0,0,,{ass_line}\n")
            elif anim_preset in ["fade-in", "slide-up"]:
                text_ass = clean_t.replace("\n", "\\N")
                f.write(f"Dialogue: 0,{start_t},{end_t},Default,,0,0,0,,{{\\fad(150,150)}}{text_ass}\n")
            else:
                text_ass = clean_t.replace("\n", "\\N")
                f.write(f"Dialogue: 0,{start_t},{end_t},Default,,0,0,0,,{text_ass}\n")

    return ass_path

def save_srt_and_vtt(job_id: str, subtitles: List[dict]):
    srt_path = str(OUTPUTS_DIR / f"{job_id}.srt")
    vtt_path = str(OUTPUTS_DIR / f"{job_id}.vtt")

    with open(srt_path, "w", encoding="utf-8") as f:
        f.write("# Created by Subash Nepal · nepalsubash.com.np\n\n")
        for idx, sub in enumerate(subtitles, start=1):
            f.write(f"{idx}\n")
            f.write(f"{format_srt_time(sub['start'])} --> {format_srt_time(sub['end'])}\n")
            f.write(f"{process_nepali_correction_pipeline(sub['text'])}\n\n")

    with open(vtt_path, "w", encoding="utf-8") as f:
        f.write("WEBVTT - Created by Subash Nepal · nepalsubash.com.np\n\n")
        for idx, sub in enumerate(subtitles, start=1):
            f.write(f"{idx}\n")
            f.write(f"{format_vtt_time(sub['start'])} --> {format_vtt_time(sub['end'])}\n")
            f.write(f"{process_nepali_correction_pipeline(sub['text'])}\n\n")

    if job_id in jobs:
        jobs[job_id]["srt_path"] = srt_path
        jobs[job_id]["vtt_path"] = vtt_path

def process_transcription_job(job_id: str, file_path: str, language: Optional[str] = None):
    try:
        add_log(job_id, "Upload received")
        is_audio = is_audio_file(file_path)
        if job_id in jobs:
            jobs[job_id]["is_audio"] = is_audio
            jobs[job_id]["status"] = "processing media"
            jobs[job_id]["progress"] = 15

        add_log(job_id, "Video metadata loaded")
        duration = get_media_duration(file_path)
        if job_id in jobs:
            jobs[job_id]["duration"] = duration

        clean_audio = str(TEMP_DIR / f"{job_id}_clean.wav")

        # Simple & Reliable Audio Pipeline: 16k mono WAV
        add_log(job_id, "Extracting audio")
        ffmpeg = resolve_ffmpeg_bin()
        if not ffmpeg:
            raise RuntimeError(FFMPEG_MISSING_MSG)
        subprocess.run([
            ffmpeg, "-y",
            "-i", file_path,
            "-vn", "-ac", "1", "-ar", "16000",
            "-c:a", "pcm_s16le",
            clean_audio
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if job_id in jobs:
            jobs[job_id]["progress"] = 25

        # Stable Model Selection & Language Routing
        model, forced_lang, model_label = get_whisper_model_and_language(language)
        add_log(job_id, f"Using {model_label}")

        transcribe_kwargs = {
            "beam_size": 1,
            "best_of": 1,
            "temperature": 0.0,
            "condition_on_previous_text": False,
            "vad_filter": True,
            "vad_parameters": {
                "min_silence_duration_ms": 400,
                "speech_pad_ms": 200
            },
            "word_timestamps": True
        }
        if forced_lang:
            transcribe_kwargs["language"] = forced_lang

        add_log(job_id, "Transcribing speech with word timestamps")
        if job_id in jobs:
            jobs[job_id]["progress"] = 40

        segments, info = model.transcribe(clean_audio, **transcribe_kwargs)

        subtitles = []
        for idx, seg in enumerate(segments, start=1):
            words = []
            if hasattr(seg, "words") and seg.words:
                for w in seg.words:
                    words.append({
                        "text": process_nepali_correction_pipeline(w.word),
                        "start": round(w.start, 3),
                        "end": round(w.end, 3)
                    })
            else:
                raw_words = seg.text.strip().split()
                total_dur = max(0.1, seg.end - seg.start)
                w_dur = total_dur / max(1, len(raw_words))
                for i, rw in enumerate(raw_words):
                    words.append({
                        "text": process_nepali_correction_pipeline(rw),
                        "start": round(seg.start + i * w_dur, 3),
                        "end": round(seg.start + (i + 1) * w_dur, 3)
                    })

            subtitles.append({
                "id": idx,
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": process_nepali_correction_pipeline(seg.text),
                "words": words
            })

        add_log(job_id, "Generating timeline")
        if job_id in jobs:
            jobs[job_id]["subtitles"] = subtitles
            jobs[job_id]["detected_language"] = forced_lang or getattr(info, "language", "en")
            jobs[job_id]["status"] = "generating caption files"
            jobs[job_id]["progress"] = 85

        save_srt_and_vtt(job_id, subtitles)

        if os.path.exists(clean_audio):
            try:
                os.remove(clean_audio)
            except Exception:
                pass

        if job_id in jobs:
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["progress"] = 100
            jobs[job_id]["message"] = "Transcription completed successfully!"
        add_log(job_id, "Completed")

    except Exception as e:
        if job_id in jobs:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = str(e)
            jobs[job_id]["message"] = f"Processing error: {str(e)}"
        add_log(job_id, f"Error: {str(e)}")

@app.post("/upload")
async def upload_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    require_ffmpeg()
    try:
        job_id = str(uuid.uuid4())
        raw_filename = file.filename or "video.mp4"
        clean_filename = os.path.basename(raw_filename)
        # Keep alphanumeric, dot, underscore, dash, and space
        safe_filename = "".join(c for c in clean_filename if c.isalnum() or c in "._- ")
        if not safe_filename:
            safe_filename = "uploaded_video.mp4"

        UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
        file_path = str(UPLOADS_DIR / f"{job_id}_{safe_filename}")

        # Write file in 1MB chunks to handle large video uploads smoothly
        with open(file_path, "wb") as f:
            while chunk := await file.read(1024 * 1024):
                f.write(chunk)

        is_audio = is_audio_file(safe_filename)

        jobs[job_id] = {
            "job_id": job_id,
            "filename": clean_filename,
            "video_path": file_path,
            "is_audio": is_audio,
            "language": language,
            "status": "processing",
            "progress": 15,
            "message": "File uploaded successfully.",
            "subtitles": [],
            "srt_path": None,
            "vtt_path": None,
            "burned_path": None,
            "error": None,
            "logs": []
        }

        background_tasks.add_task(process_transcription_job, job_id, file_path, language)

        return {
            "success": True,
            "job_id": job_id,
            "is_audio": is_audio,
            "message": "File uploaded successfully."
        }
    except Exception as e:
        print(f"Error during video upload: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")

@app.post("/youtube")
async def process_youtube(background_tasks: BackgroundTasks, request: YouTubeRequest):
    url = request.url.strip()
    language = request.language
    if not url:
        raise HTTPException(status_code=400, detail="YouTube URL is required")
    require_ffmpeg()

    job_id = str(uuid.uuid4())
    out_template = str(UPLOADS_DIR / f"{job_id}_%(title)s.%(ext)s")

    jobs[job_id] = {
        "job_id": job_id,
        "filename": "YouTube Video",
        "video_path": None,
        "is_audio": False,
        "language": language,
        "status": "downloading youtube video",
        "progress": 10,
        "message": "Fetching media from YouTube...",
        "subtitles": [],
        "srt_path": None,
        "vtt_path": None,
        "burned_path": None,
        "error": None,
        "logs": []
    }

    def download_and_process():
        try:
            require_ffmpeg_or_raise()
            ffmpeg_dir = ffmpeg_location_dir()

            ydl_opts = {
                "format": "bv*+ba/b",
                "merge_output_format": "mp4",
                "outtmpl": out_template,
                "quiet": True,
                "no_warnings": True,
                "retries": 3,
            }
            if ffmpeg_dir:
                ydl_opts["ffmpeg_location"] = ffmpeg_dir
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info_dict = ydl.extract_info(url, download=True)
                downloaded_file = ydl.prepare_filename(info_dict)
                # After merge, extension is forced to mp4
                root, _ = os.path.splitext(downloaded_file)
                merged_mp4 = root + ".mp4"
                if os.path.exists(merged_mp4):
                    downloaded_file = merged_mp4

            if not downloaded_file or not os.path.exists(downloaded_file):
                raise RuntimeError("YouTube download finished but media file was not found on disk.")

            jobs[job_id]["video_path"] = downloaded_file
            jobs[job_id]["filename"] = os.path.basename(downloaded_file)
            jobs[job_id]["is_audio"] = is_audio_file(downloaded_file)

            process_transcription_job(job_id, downloaded_file, language)
        except Exception as e:
            err = str(e)
            low = err.lower()
            if "ffmpeg is not installed" in low or ("ffmpeg" in low and "not installed" in low):
                err = FFMPEG_MISSING_MSG
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = err
            jobs[job_id]["message"] = f"YouTube processing failed: {err}"
            add_log(job_id, f"Error: {err}")

    background_tasks.add_task(download_and_process)

    return {
        "success": True,
        "job_id": job_id,
        "message": "YouTube video queued."
    }

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=400, detail="Job not found")
    job = jobs[job_id]
    return {
        "success": True,
        "job_id": job_id,
        "status": job["status"],
        "progress": job["progress"],
        "message": job["message"],
        "is_audio": job.get("is_audio", False),
        "detected_language": job.get("detected_language"),
        "error": job["error"],
        "logs": job.get("logs", [])
    }

@app.get("/logs/{job_id}")
async def get_job_logs(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=400, detail="Job not found")
    return {
        "success": True,
        "job_id": job_id,
        "logs": jobs[job_id].get("logs", []),
        "status": jobs[job_id].get("status"),
        "progress": jobs[job_id].get("progress", 0),
        "message": jobs[job_id].get("message", "")
    }

@app.websocket("/ws/logs/{job_id}")
async def websocket_logs(websocket: WebSocket, job_id: str):
    await websocket.accept()
    if job_id not in log_subscribers:
        log_subscribers[job_id] = set()
    log_subscribers[job_id].add(websocket)

    if job_id in jobs and "logs" in jobs[job_id]:
        for entry in jobs[job_id]["logs"]:
            await websocket.send_json({"log": entry})

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if job_id in log_subscribers and websocket in log_subscribers[job_id]:
            log_subscribers[job_id].remove(websocket)

@app.get("/subtitles/{job_id}")
async def get_subtitles(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=400, detail="Job not found")
    return {
        "success": True,
        "job_id": job_id,
        "subtitles": jobs[job_id]["subtitles"],
        "filename": jobs[job_id]["filename"],
        "is_audio": jobs[job_id].get("is_audio", False),
        "status": jobs[job_id]["status"]
    }

@app.post("/subtitles/{job_id}")
async def update_subtitles(job_id: str, request: SubtitlesUpdateRequest):
    if job_id not in jobs:
        raise HTTPException(status_code=400, detail="Job not found")

    sub_dicts = [s.model_dump() for s in request.subtitles]
    jobs[job_id]["subtitles"] = sub_dicts
    save_srt_and_vtt(job_id, sub_dicts)

    return {
        "success": True,
        "job_id": job_id,
        "message": "Subtitles updated successfully",
        "subtitles": sub_dicts
    }

LANG_CODE_MAP = {
    "English": "en",
    "Nepali": "ne",
    "Hindi": "hi",
    "Spanish": "es",
    "French": "fr",
    "German": "de",
    "Japanese": "ja"
}

@app.post("/translate/{job_id}")
async def translate_subtitles(job_id: str, request: TranslateRequest):
    if job_id not in jobs:
        raise HTTPException(status_code=400, detail="Job not found")

    target_lang = request.target_language
    lang_code = LANG_CODE_MAP.get(target_lang, "en")

    subtitles = jobs[job_id]["subtitles"]
    if not subtitles:
        raise HTTPException(status_code=400, detail="No subtitles available to translate")

    translator = GoogleTranslator(source='auto', target=lang_code)

    translated_subs = []
    for sub in subtitles:
        translated_text = sub["text"]
        if sub["text"].strip():
            try:
                translated_text = translator.translate(sub["text"])
            except Exception:
                pass
        translated_subs.append({
            "id": sub["id"],
            "start": sub["start"],
            "end": sub["end"],
            "text": process_nepali_correction_pipeline(translated_text),
            "words": sub.get("words", [])
        })

    jobs[job_id]["subtitles"] = translated_subs
    save_srt_and_vtt(job_id, translated_subs)

    return {
        "success": True,
        "job_id": job_id,
        "target_language": target_lang,
        "subtitles": translated_subs
    }

@app.post("/burn/{job_id}")
async def burn_subtitles(job_id: str, background_tasks: BackgroundTasks, request: Optional[BurnRequest] = None):
    if job_id not in jobs:
        raise HTTPException(status_code=400, detail="Job not found")
    require_ffmpeg()

    job = jobs[job_id]
    video_path = job["video_path"]
    subtitles = job["subtitles"]

    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=400, detail="Original media file missing")

    style_cfg = request.style_config if request else None
    frames = request.frames if request else None

    burned_path = str(OUTPUTS_DIR / f"{job_id}_subtitled.mp4")
    jobs[job_id]["status"] = "burning subtitles"
    jobs[job_id]["progress"] = 90
    jobs[job_id]["message"] = "Rendering exact preview frame overlay MP4 video..."

    def process_burn():
        try:
            success = False
            if frames and len(frames) > 0:
                try:
                    add_log(job_id, f"Burning {len(frames)} exact DOM PNG overlay frames...")
                    export_video_with_png_overlays(
                        video_path=video_path,
                        output_path=burned_path,
                        frames=frames,
                        temp_dir=str(TEMP_DIR / f"{job_id}_export")
                    )
                    success = True
                except Exception as frame_err:
                    print(f"PNG overlay burn failed, attempting ASS fallback: {str(frame_err)}")
                    add_log(job_id, f"PNG overlay warning: {str(frame_err)}. Falling back to ASS styles...")

            if not success:
                add_log(job_id, "Rendering subtitles via ASS file burning...")
                ass_path = generate_ass_file(job_id, subtitles, style_cfg)
                abs_ass_path = os.path.abspath(ass_path).replace("\\", "/").replace(":", "\\:")
                filter_str = f"ass='{abs_ass_path}'"

                cmd = [
                    resolve_ffmpeg_bin(), "-y",
                    "-i", video_path,
                    "-vf", filter_str,
                    "-c:a", "copy",
                    "-metadata", "comment=Created by Subash Nepal · nepalsubash.com.np",
                    "-metadata", "artist=Subash Nepal",
                    burned_path
                ]
                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            jobs[job_id]["burned_path"] = burned_path
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["progress"] = 100
            jobs[job_id]["message"] = "Styled subtitles burned successfully!"
        except Exception as e:
            print(f"Burn processing error: {str(e)}")
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["error"] = str(e)
            jobs[job_id]["message"] = f"Burning subtitles failed: {str(e)}"

    background_tasks.add_task(process_burn)

    return {
        "success": True,
        "job_id": job_id,
        "message": "Subtitle burning started."
    }

@app.get("/video/{job_id}")
@app.get("/media/{job_id}")
async def serve_media(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=400, detail="Job not found")
    media_path = jobs[job_id]["video_path"]
    if not media_path or not os.path.exists(media_path):
        raise HTTPException(status_code=400, detail="Media file not found")

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
        ".ogg": "audio/ogg"
    }
    media_type = media_type_map.get(ext, "application/octet-stream")
    return FileResponse(media_path, media_type=media_type)

@app.get("/download/{job_id}.srt")
async def download_srt(job_id: str):
    path = str(OUTPUTS_DIR / f"{job_id}.srt")
    if not os.path.exists(path):
        raise HTTPException(status_code=400, detail="SRT file not found")
    return FileResponse(path, media_type="text/plain; charset=utf-8", filename=f"{job_id}.srt")

@app.get("/download/{job_id}.vtt")
async def download_vtt(job_id: str):
    path = str(OUTPUTS_DIR / f"{job_id}.vtt")
    if not os.path.exists(path):
        raise HTTPException(status_code=400, detail="VTT file not found")
    return FileResponse(path, media_type="text/vtt; charset=utf-8", filename=f"{job_id}.vtt")

@app.get("/download/{job_id}.mp4")
async def download_mp4(job_id: str):
    path = str(OUTPUTS_DIR / f"{job_id}_subtitled.mp4")
    if not os.path.exists(path):
        raise HTTPException(
            status_code=400,
            detail="Burned MP4 file not found. Please click 'Burn Animated Subtitles into MP4' to render the subtitled video first."
        )
    return FileResponse(path, media_type="video/mp4", filename=f"{job_id}_subtitled.mp4")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
