# V1 Auto Captions Studio 🎬✨

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Whisper-Offline-blue?style=for-the-badge&logo=openai" alt="Whisper Offline" />
  <img src="https://img.shields.io/badge/FFmpeg-Supported-green?style=for-the-badge&logo=ffmpeg" alt="FFmpeg" />
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=for-the-badge" alt="MIT License" />
</p>

<p align="center">
  <b>Free • 100% Offline • Open Source • AI Speech-to-Text & Subtitle Studio</b>
</p>

---

## 🌟 Overview

**V1 Auto Captions Studio** is a powerful, offline-first web application designed to automatically generate, edit, style, and burn subtitles into videos.

Powered by **OpenAI Whisper (via faster-whisper)** and **FFmpeg**, V1 processes video and audio locally without sending data to external APIs. It includes an interactive timeline editor, customizable caption styling, automatic multi-language translation, and a specialized **Nepali NLP Grammar & Spellchecking Pipeline**.

---

## ✨ Features

- 🎬 **Video & YouTube Ingestion**: Drag-and-drop local video files (`MP4`, `MOV`, `MKV`, `WebM`) or paste any YouTube URL to fetch and transcribe directly.
- 🧠 **Offline AI Speech Recognition**: Fast, high-accuracy speech-to-text powered by `faster-whisper` with model auto-selection (`tiny`, `base`, `small`, `medium`, `large-v3`).
- 🇳🇵 **Nepali NLP Engine**: Built-in 3-stage Nepali spellchecker and grammar corrector using Hunspell dictionaries (`ne_NP.dic`), Varnavinyas orthography, and custom confusion mapping (`ne_corrections.json`).
- ✏️ **Interactive Subtitle Editor**: Live video player synchronization, real-time waveform timeline, subtitle segment split/merge, timestamp adjustments, and inline text editing.
- 🎨 **Rich Caption Styling**: Customize font family, text color, outline, background pills, position, scale, and active-word animations.
- 🌐 **Multi-Language Translation**: On-the-fly translation between English, Nepali, and other languages powered by `deep-translator`.
- ⚡ **Real-time WebSocket Progress**: Live updates during audio extraction, AI inference, and video rendering tasks.
- 📄 **Multiple Export Formats**: Download subtitle files in `.srt`, `.vtt`, and `.ass` formats.
- 🎥 **Hardcoded Subtitle Burn-In**: Render pixel-perfect, high-quality subtitled MP4 videos directly using FFmpeg PNG overlay filters.
- 🔒 **100% Private & Secure**: All transcription and video processing occur entirely on your local machine.

---

## 🏗️ Project Architecture

```
V1/
├── backend/                  # FastAPI Python Backend
│   ├── app.py                # Main API application & WebSocket routes
│   ├── nepali_nlp.py         # Nepali NLP 3-stage spellcheck pipeline
│   ├── requirements.txt      # Python dependencies list
│   ├── data/                 # Nepali dictionary & affix files
│   │   ├── ne_NP.aff
│   │   ├── ne_NP.dic
│   │   ├── ne_corrections.json
│   │   └── nepali_words.txt
│   ├── utils/                # Helper modules
│   │   ├── nepali_correction.py
│   │   └── png_overlay_export.py
│   ├── uploads/              # Temporary raw video storage (git-ignored)
│   ├── outputs/              # Generated subtitle & MP4 exports (git-ignored)
│   └── temp/                 # Intermediate processing cache (git-ignored)
│
├── frontend/                 # Next.js 15 / React 19 Frontend
│   ├── package.json          # Node.js dependencies & scripts
│   ├── next.config.js        # Next.js configuration
│   ├── app/                  # App router pages & components
│   │   ├── page.js           # Main landing / upload page
│   │   ├── layout.js         # Root layout & theme providers
│   │   ├── globals.css       # Global styles & design system
│   │   ├── editor/           # Full subtitle studio page
│   │   ├── components/       # UI Components (Editor, Player, Timeline, Styling)
│   │   └── utils/            # Frontend export & segmentation utilities
│   └── public/               # Static assets & icons
│
├── .gitignore                # Comprehensive Git exclusion rules
└── README.md                 # Documentation
```

---

## 📋 Prerequisites

Before installing V1 Auto Captions, ensure your machine has the following tools installed:

| Tool | Recommended Version | Purpose |
| :--- | :--- | :--- |
| **Python** | `3.10` or higher | Backend FastAPI API & Whisper AI models |
| **Node.js** | `18.0` or higher | Frontend Next.js app server |
| **npm** | `9.0` or higher | Node package manager (comes with Node.js) |
| **FFmpeg** | Latest stable | Audio extraction & subtitle video rendering |
| **Git** | Latest | Source code management |

---

## 🛠️ Step-by-Step Installation Guide

### Step 1: Install System Dependencies

#### 🪟 Windows
1. **Python**: Download from [python.org](https://www.python.org/downloads/) or run:
   ```powershell
   winget install Python.Python.3.11
   ```
2. **Node.js**: Download from [nodejs.org](https://nodejs.org/) or run:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```
3. **FFmpeg**: Install via winget or Chocolatey:
   ```powershell
   winget install Gyan.FFmpeg
   # OR
   choco install ffmpeg
   ```
   *Note: Ensure FFmpeg is added to your Windows Environment System `PATH`.*

#### 🍏 macOS
Using [Homebrew](https://brew.sh/):
```bash
brew install python node ffmpeg git
```

#### 🐧 Linux (Ubuntu / Debian)
```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nodejs npm ffmpeg git
```

---

### Step 2: Clone the Repository

```bash
git clone https://github.com/Subashnpfr/V1.git
cd V1
```

---

### Step 3: Setup & Run the Backend (Python FastAPI)

1. Open a terminal in the project root and navigate to `backend`:
   ```bash
   cd backend
   ```

2. Create a Python virtual environment:
   ```bash
   # On Windows:
   python -m venv venv

   # On macOS / Linux:
   python3 -m venv venv
   ```

3. Activate the virtual environment:
   ```bash
   # Windows (PowerShell):
   .\venv\Scripts\Activate.ps1

   # Windows (Command Prompt):
   .\venv\Scripts\activate.bat

   # macOS / Linux:
   source venv/bin/activate
   ```

   *(If PowerShell gives a script execution policy error, run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` first).*

4. Upgrade `pip` and install all required Python packages:
   ```bash
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

5. Start the FastAPI server:
   ```bash
   uvicorn app:app --reload --host 127.0.0.1 --port 8000
   ```

   - **Backend API URL**: `http://127.0.0.1:8000`
   - **Interactive API Docs (Swagger UI)**: `http://127.0.0.1:8000/docs`

---

### Step 4: Setup & Run the Frontend (Next.js)

1. Open a **new terminal window** and navigate to the `frontend` directory:
   ```bash
   cd V1/frontend
   ```

2. Install Node.js packages using `npm`:
   ```bash
   npm install
   ```

3. Run the Next.js development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## 💻 Quick Reference Commands

| Action | Command | Directory |
| :--- | :--- | :--- |
| **Activate Python Venv (Win)** | `.\backend\venv\Scripts\Activate.ps1` | Root |
| **Activate Python Venv (Mac/Linux)** | `source backend/venv/bin/activate` | Root |
| **Run Backend API** | `uvicorn app:app --reload` | `backend/` |
| **Install Frontend Packages** | `npm install` | `frontend/` |
| **Run Frontend App** | `npm run dev` | `frontend/` |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/transcribe` | Upload a video/audio file for Whisper AI transcription |
| `POST` | `/transcribe/youtube` | Transcribe video directly from a YouTube URL |
| `WS` | `/ws/progress/{task_id}` | WebSocket stream for real-time processing updates |
| `POST` | `/export/overlay` | Render burned-in subtitled video with PNG overlay filter |
| `GET` | `/download/{filename}` | Download generated SRT, VTT, ASS, or MP4 files |

---

## 🚀 GPU Acceleration (Optional)

If your system has an NVIDIA GPU with CUDA installed, `faster-whisper` will automatically utilize GPU acceleration for ultra-fast transcription!

To enable CUDA acceleration manually, ensure PyTorch with CUDA support is installed in your virtual environment:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu121
```

---

## 🐛 Troubleshooting & Tips

### 1. `ffmpeg is not recognized` Error
- Verify FFmpeg installation by running `ffmpeg -version` in your terminal.
- Ensure the directory containing `ffmpeg.exe` is added to your system `PATH`.

### 2. Node `npm install` Warnings or Errors
- Ensure Node version is 18+. Run `node -v` to check.
- If you face cache locks, run:
  ```bash
  npm cache clean --force
  npm install
  ```

### 3. PowerShell Execution Policy Error
If activating Python `venv` fails on Windows PowerShell:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
```

---

## 🤝 Contributing

Contributions, bug reports, and feature suggestions are welcome!

1. Fork the project repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  Crafted with ❤️ by <a href="https://nepalsubash.com.np">Subash Nepal</a>
</p>
