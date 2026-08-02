# V1 Auto Captions

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/FastAPI-0.116-009688?style=for-the-badge&logo=fastapi" />
  <img src="https://img.shields.io/badge/Whisper-Offline-blue?style=for-the-badge" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" />
</p>

<p align="center">
  <b>Free • Offline • Open Source • Automatic Video Caption Generator</b>
</p>

---

## ✨ Overview

**V1 Auto Captions** is a lightweight web application that automatically generates subtitle files (`.srt`) from uploaded videos.

It uses **FFmpeg** to extract audio and **OpenAI Whisper (via faster-whisper)** to perform speech-to-text transcription completely **offline**.

No API keys. No cloud processing. No subscription.

---

## 🚀 Features

- 🎬 Upload MP4, MOV, MKV, and WebM videos
- 🎧 Automatic audio extraction with FFmpeg
- 🧠 Offline speech recognition using Whisper
- ⏱️ Accurate timestamp generation
- 📄 Download subtitles as `.srt`
- 🌐 Modern web interface built with Next.js
- 🔒 Privacy-friendly (all processing happens locally)
- 💸 Completely free and open source

---

## 🖼️ Screenshots

### Upload Interface

![Upload UI](./screenshots/upload.png)

### Processing

![Processing](./screenshots/processing.png)

### Download Captions

![Download](./screenshots/download.png)

> Add your own screenshots inside the `screenshots/` folder.

---

## 🏗️ Project Structure

<pre><code>V1/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── uploads/
│   └── outputs/
│
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── app/
│   │   ├── page.js
│   │   ├── layout.js
│   │   └── globals.css
│   └── public/
│
├── screenshots/
└── README.md
</code></pre>

---

## ⚙️ Tech Stack

### Frontend

- Next.js 15
- React
- Axios

### Backend

- FastAPI
- Uvicorn
- Python Multipart

### AI / Audio

- faster-whisper
- FFmpeg

---

## 📋 Requirements

Make sure the following are installed on your system:

| Tool | Version |
|------|---------|
| Python | 3.10+ |
| Node.js | 18+ |
| FFmpeg | Latest |
| Git | Latest |

### Verify Installation

<pre><code>python --version
node --version
ffmpeg -version
git --version
</code></pre>

---

## 🔧 Installation

### 1. Clone the repository

<pre><code>git clone https://github.com/Subashnpfr/V1
cd V1
</code></pre>

---

### 2. Setup the backend

<pre><code>cd backend
pip install -r requirements.txt
</code></pre>

Create required folders:

<pre><code>mkdir uploads outputs
</code></pre>

Run the API server:

<pre><code>uvicorn app:app --reload
</code></pre>

Backend will be available at:

<pre><code>http://127.0.0.1:8000
</code></pre>

---

### 3. Setup the frontend

Open a new terminal:

<pre><code>cd frontend
npm install
npm run dev
</code></pre>

Frontend will be available at:

<pre><code>http://localhost:3000
</code></pre>

---

## 🧠 How It Works

<pre><code>Video Upload
     │
     ▼
Save File
     │
     ▼
FFmpeg extracts audio
     │
     ▼
Whisper transcribes speech
     │
     ▼
Generate SRT timestamps
     │
     ▼
Download captions.srt
</code></pre>

---

## 📡 API

### POST /transcribe

Upload a video and receive an `.srt` subtitle file.

#### Request

<pre><code>multipart/form-data
file: video.mp4
</code></pre>

#### Response

- `captions.srt`

#### Example using cURL

<pre><code>curl -X POST "http://127.0.0.1:8000/transcribe" \\
  -F "file=@video.mp4" --output captions.srt
</code></pre>

---

## 🎯 Whisper Model

The project uses the **base** Whisper model by default.

| Model | Speed | Accuracy |
|------|------|------|
| tiny | ⚡⚡⚡⚡⚡ | Low |
| base | ⚡⚡⚡⚡ | Good |
| small | ⚡⚡⚡ | Very Good |
| medium | ⚡⚡ | Excellent |
| large-v3 | ⚡ | Best |

Change the model in `backend/app.py`:

<pre><code>model = WhisperModel("base", device="cpu")
</code></pre>

---

## 📁 Output Example

<pre><code>1
00:00:00,000 --> 00:00:02,500
Hello everyone.

2
00:00:02,500 --> 00:00:05,000
Welcome to my video.
</code></pre>

---

## 🔒 Privacy

All processing happens on your local machine.

- ❌ No video is uploaded to external servers
- ❌ No API keys are required
- ❌ No cloud transcription services are used
- ✅ Full control over your data

---

## 🚀 Roadmap

### V1 (Current)

- [x] Video upload
- [x] Audio extraction
- [x] Offline transcription
- [x] SRT generation
- [x] Download subtitles

### V2

- [ ] Drag & drop upload
- [ ] Progress bar
- [ ] Subtitle editor
- [ ] VTT export
- [ ] Multi-language translation
- [ ] Burn subtitles into video
- [ ] YouTube URL support

### V3

- [ ] Speaker diarization
- [ ] Batch processing
- [ ] GPU acceleration
- [ ] Desktop app (Tauri/Electron)

---

## 🐛 Troubleshooting

### FFmpeg not found

Add FFmpeg to your system PATH.

### CORS issues

If frontend and backend are on different ports, enable CORS in FastAPI.

### Slow transcription

Use a smaller model:

<pre><code>WhisperModel("tiny", device="cpu")
</code></pre>

### Out of memory

Close other applications or use the `tiny` model.

---

## 🤝 Contributing

Contributions are welcome!

<pre><code>fork → create branch → commit → open pull request
</code></pre>

Please make sure your code follows the existing style and includes clear commit messages.

---

## 📄 License

This project is licensed under the **MIT License**.

See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgements

- [OpenAI Whisper](https://github.com/openai/whisper)
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- [FFmpeg](https://ffmpeg.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/)

---

## ⭐ Support

If you find this project useful, please consider giving it a **star** on GitHub.

<p align="center">
  <b>Made with ❤️ for creators, students, and open-source learners.</b>
</p>
