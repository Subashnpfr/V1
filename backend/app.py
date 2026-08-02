from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse
from faster_whisper import WhisperModel
import subprocess
import os
import uuid

app = FastAPI()

os.makedirs("uploads", exist_ok=True)
os.makedirs("outputs", exist_ok=True)

model = WhisperModel("base", device="cpu")

def to_srt_time(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds - int(seconds)) * 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    uid = str(uuid.uuid4())

    video_path = f"uploads/{uid}_{file.filename}"
    audio_path = f"uploads/{uid}.wav"
    srt_path = f"outputs/{uid}.srt"

    with open(video_path, "wb") as f:
        f.write(await file.read())

    subprocess.run([
        "ffmpeg", "-y",
        "-i", video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        audio_path
    ], check=True)

    segments, info = model.transcribe(audio_path)

    with open(srt_path, "w", encoding="utf-8") as srt:
        for i, seg in enumerate(segments, start=1):
            srt.write(f"{i}\\n")
            srt.write(f"{to_srt_time(seg.start)} --> {to_srt_time(seg.end)}\\n")
            srt.write(seg.text.strip() + "\\n\\n")

    return FileResponse(
        srt_path,
        media_type="text/plain",
        filename="captions.srt"
    )