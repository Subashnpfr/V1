# V1 Auto Captions Studio 🎬✨

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=nextdotjs" alt="Next.js 15"/>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19"/>
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Whisper-Offline-blue?style=for-the-badge&logo=openai" alt="Whisper Offline"/>
  <img src="https://img.shields.io/badge/FFmpeg-Supported-green?style=for-the-badge&logo=ffmpeg" alt="FFmpeg"/>
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge" alt="MIT License"/>
</div>

<p align="center"><strong>Free • 100% Offline • Open Source • AI Speech‑to‑Text & Subtitle Studio</strong></p>

---

## ✨ Overview

V1 Auto Captions Studio is a **premium‑grade, offline‑first** web application that generates, edits, styles, translates, and burns subtitles into videos. It leverages **OpenAI Whisper** (via `faster-whisper`) and **FFmpeg** to keep your data private and processing local.

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
- Backend (from repo root): `python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 --reload`
- Frontend: `npm run dev --prefix frontend`

---

## 📚 Documentation

### API Endpoints
| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/upload` | Upload a video/audio file for Whisper transcription |
| `POST` | `/youtube` | Transcribe a YouTube video directly |
| `WS` | `/ws/logs/{job_id}` | Real‑time processing logs |
| `POST` | `/burn/{job_id}` | Burn styled subtitles into an MP4 (PNG overlay or ASS) |
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

## ⚙️ Features
- **Offline‑first**: All processing runs locally, no cloud services.
- **Multi‑language Whisper** support with GPU acceleration via `faster-whisper`.
- **Dynamic subtitle styling**: Custom fonts, colors, outlines, and positioning.
- **Batch processing**: Queue multiple videos for automatic transcription and burning.
- **YouTube integration**: Directly fetch and caption YouTube videos.
- **Export formats**: SRT, VTT, and burned‑in MP4.
- **Responsive UI** built with Next.js 15 and React 19.
- **Robust security**: pinned Next.js 15.5.23, explicit `sharp` override, and no wildcard image remote patterns.

---

## 🛠️ Development
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
