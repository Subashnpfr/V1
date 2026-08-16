# V1 Auto Captions Studio 🎬✨

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs" alt="Next.js 15"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19"/>
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Whisper-Offline-blue?style=for-the-badge&logo=openai" alt="Whisper Offline"/>
  <img src="https://img.shields.io/badge/FFmpeg-Supported-green?style=for-the-badge&logo=ffmpeg" alt="FFmpeg"/>
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge" alt="MIT License"/>
</div>

<p align="center"><strong>Local-first • Open Source • Speech-to-text & subtitle studio</strong></p>

---

## Overview

V1 Captions is a **local-first** studio: Whisper transcription and FFmpeg burns run on this computer. The API binds to **127.0.0.1** and is **not** a multi-user SaaS. There is no account system.

**Network exceptions (not offline):**
- First Whisper model download (Hugging Face)
- Optional **Google Translate** (caption text is sent to Google; you must confirm in the UI)
- Optional YouTube import (yt-dlp)
- YouTube/FFmpeg as needed for merge

Jobs persist as `outputs/<uuid>.job.json` so a backend restart can recover a project.

**Limits:** uploads max 500 MB; voice recordings max **30 minutes** (no minimum length); at most 2 active transcriptions; YouTube downloads max 2 GB; YouTube URLs must be `https` on youtube.com / youtu.be.

**Voice recording:** Use **Record** on the home screen. The browser asks for microphone permission, records locally with `MediaRecorder`, then uploads once to the local API (`source_type=recording`). Whisper transcribes the same way as uploaded audio. Preview the blob in the browser before upload. Chrome, Edge, Firefox, and Safari are handled via MIME feature detection (`audio/webm;codecs=opus` preferred; `audio/mp4` fallback). This is **not** a claim that every browser was tested in this change.

**Privacy:** Microphone audio is captured in the browser. After **Use recording**, it is sent to the local backend and processed with Whisper on this machine. Optional **Google Translate** still sends caption text to Google. First Whisper model download uses Hugging Face. Do not treat the product as 100% offline.

**Audio → MP4:** Recordings and uploaded audio (MP3, WAV, M4A, …) burn onto a **black 1920×1080 still** as the video picture, with studio captions on top. Restart the API after pulling this change. SRT and VTT remain available.

**Security:** Do not expose port 8000 on a public network. Job IDs are UUIDs; CORS allows localhost:3000 only.

---

## 📸 Demo

![V1 Demo](frontend/public/demo_screenshot.png)

---

## 🚀 Quick Start (Windows)

> **No virtual environment required** – the project installs dependencies globally.

1. **Prerequisites** – ensure the following are installed and added to your `PATH`:
   - **Python 3.10+** – https://python.org
   - **Node.js 18+** – https://nodejs.org
   - **FFmpeg** (required for YouTube merge, audio extract, burn) – `winget install Gyan.FFmpeg`
     - After install, **open a new terminal** so PATH updates. Verify with `ffmpeg -version`.
2. **Clone the repository**:
   ```bash
   git clone https://github.com/Subashnpfr/V1.git
   cd V1
   ```
3. **Run the provided setup script** – it installs all Python and Node dependencies, resolves security warnings, and launches both services:
   ```bat
   setup.bat
   ```
   - Backend: `http://127.0.0.1:8000`
   - Frontend: `http://localhost:3000`
4. Open the app in your browser: `http://localhost:3000`

*Manual alternative*:
- Backend (from repo root): `python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000`
- Frontend: `npm run dev --prefix frontend`

---

## 📚 Documentation

### API Endpoints
| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/upload` | Upload video/audio **or** a browser recording (`source_type=recording`) |
| `POST` | `/youtube` | Transcribe a YouTube video directly |
| `WS` | `/ws/logs/{job_id}` | Real‑time processing logs |
| `POST` | `/script/{job_id}` | Convert caption **script** (native ↔ Romanized/Hinglish). Not translation. |
| `POST` | `/retranscribe/{job_id}` | Re-run Whisper on the same file with a chosen spoken language |
| `GET` | `/download/{job_id}.srt` | Download generated SRT |
| `GET` | `/download/{job_id}.vtt` | Download generated VTT |
| `GET` | `/download/{job_id}.mp4` | Download burned‑in video |

### Styling Options (JSON payload for `/burn`)
```json
{
  "style_config": {
    "fontFamily": "Noto Sans Devanagari",
    "fontSize": 24,
    "textColor": "#FAFAFA",
    "bgColor": "#0B0B0B",
    "bgOpacity": 0.6,
    "outlineColor": "#000000",
    "outlineWidth": 1,
    "position": "bottom"
  }
}
```

---

## Features
- Voice recording (microphone → local upload → Whisper → existing editor)
- Caption **language** vs **script**: Nepali Devanagari, Romanized Nepali, Hindi/Hinglish, English (transliteration is not translation)
- Local Whisper transcription (models download on first use)
- Optional Google Translate (internet; caption text leaves the machine)
- YouTube import (https YouTube URLs only)
- Styled ASS burn via FFmpeg
- SRT / VTT / MP4 export
- Job recovery from `outputs/<id>.job.json` after restart

Tests: `python -m pytest backend -q` from repo root (set `PYTHONPATH=backend`) and `npm test --prefix frontend`.

---

## Caption language vs script

Spoken **language** (Nepali / Hindi / English / auto) is what Whisper hears.

**Script** is how that language is written:

| Speech | Native | Romanized (same meaning) |
|---|---|---|
| Nepali | तपाईंलाई कस्तो छ? | Tapailai kasto chha? |
| Hindi | आप कैसे हैं? | Aap kaise hain? (Hinglish) |
| English | How are you? | (Latin only — no extra romanize step) |

**Convert script** transliterates. **Translate** changes language (Google; internet).

V1 romanization is local (no extra API). Convention: `छ` → `chha`, `छु` → `chu`, `आ` → `aa`, dependent `ा` → `a`, danda `।` → `.`, Devanagari digits → ASCII, proper nouns like काठमाडौं → Kathmandu.

---

## Development
```bash
# Backend (auto‑reload)
uvicorn backend.app:app --reload

# Frontend
npm install   # (once)
npm run dev   # start Next.js dev server
```

### Code Quality
- Follow **PEP 8** for Python and **Airbnb** style for JavaScript/React.
- Run `flake8` and `eslint` locally before committing.
- After dependency changes, run `npm install --prefix frontend` and review `npm audit`.

---

## 🤝 Contributing
1. Fork the repo.
2. Create a feature branch (`git checkout -b feature/YourFeature`).
3. Ensure all tests pass (`npm test` & `pytest`).
4. Submit a pull request.

---

## 📄 License
Distributed under the **MIT License**. See `LICENSE` for details.

---

<div align="center">
  Crafted with ❤️ by <a href="https://nepalsubash.com.np">Subash Nepal</a>
</div>
