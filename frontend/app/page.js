'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Youtube, ArrowRight, Video, Sparkles } from 'lucide-react';
import UploadZone from './components/UploadZone';
import ProgressBar from './components/ProgressBar';
import AppShell from './components/AppShell';
import { API_BASE } from './utils/api';

function DashboardContent() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [language, setLanguage] = useState('auto');
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processLogs, setProcessLogs] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/status/${jobId}`);
        if (res.data.success) {
          setStatus(res.data.status);
          setProgress(res.data.progress);
          setMessage(res.data.message);
          if (res.data.logs && Array.isArray(res.data.logs)) {
            setProcessLogs(res.data.logs);
          }
          if (res.data.status === 'completed') setLoading(false);
          else if (res.data.status === 'failed') {
            setLoading(false);
            setError(res.data.error || 'Job processing failed');
          }
        }
      } catch (err) {
        console.error('Error fetching job status:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [jobId, status]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [processLogs]);

  const handleFileUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    setProgress(5);
    setMessage('Uploading file...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (language && language !== 'auto') formData.append('language', language);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            setProgress(Math.round((progressEvent.loaded * 20) / progressEvent.total));
          }
        }
      });
      if (res.data.success) {
        setJobId(res.data.job_id);
        setStatus('processing');
      } else {
        setLoading(false);
        setError(res.data.message || 'Upload failed');
      }
    } catch (err) {
      setLoading(false);
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setError(`Cannot reach the API at ${API_BASE}. Start the FastAPI backend and try again.`);
      } else {
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : err.message || 'Failed to upload video');
      }
    }
  };

  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;
    setLoading(true);
    setError(null);
    setProgress(10);
    setMessage('Connecting to YouTube...');
    try {
      const res = await axios.post(`${API_BASE}/youtube`, {
        url: youtubeUrl.trim(),
        language: language === 'auto' ? null : language
      });
      if (res.data.success) {
        setJobId(res.data.job_id);
        setStatus('downloading youtube video');
      } else {
        setLoading(false);
        setError('YouTube fetch failed');
      }
    } catch (err) {
      setLoading(false);
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Failed to process YouTube URL');
    }
  };

  return (
    <AppShell>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> Offline AI studio</div>
          <h1>Captions that feel <em>shipped</em>, not sketched.</h1>
          <p className="lead">
            Transcribe locally with Whisper, style word-level animations, then burn an MP4 — your media never leaves this machine.
          </p>
          <div className="steps">
            <div className="step"><span className="step-index">1</span> Import</div>
            <div className="step"><span className="step-index">2</span> Transcribe</div>
            <div className="step"><span className="step-index">3</span> Style & export</div>
          </div>
          <div className="preview-stage" aria-hidden>
            <div className="preview-caption">यो <b>caption</b> तयार छ</div>
          </div>
        </div>

        <div className="create-card">
          {error && <div className="alert alert-error" role="alert">{error}</div>}

          <label className="field-label" htmlFor="language">Spoken language</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={loading}
            style={{ marginBottom: '1.15rem' }}
          >
            <option value="auto">Auto detect</option>
            <option value="en">English</option>
            <option value="ne">Nepali (नेपाली)</option>
            <option value="hi">Hindi (हिन्दी)</option>
          </select>

          <label className="field-label">Upload media</label>
          <UploadZone
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
            disabled={loading}
          />
          {selectedFile && !loading && status !== 'completed' && (
            <div style={{ marginTop: '1rem' }}>
              <button className="btn-primary" onClick={handleFileUpload} style={{ width: '100%', justifyContent: 'center' }}>
                <Video size={16} /> Generate captions
              </button>
            </div>
          )}

          <div className="divider"><span>OR</span></div>

          <label className="field-label" htmlFor="youtube-url">YouTube URL</label>
          <form onSubmit={handleYoutubeSubmit} className="yt-row">
            <div style={{ position: 'relative', flex: 1 }}>
              <Youtube
                size={18}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#ef4444'
                }}
              />
              <input
                id="youtube-url"
                type="url"
                className="input-text"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loading || !youtubeUrl.trim()}>
              Fetch
            </button>
          </form>

          {loading && (
            <>
              <ProgressBar progress={progress} message={message} />
              {processLogs.length > 0 && (
                <div className="log-panel" aria-live="polite">
                  {processLogs.map((entry, idx) => (
                    <div key={`${entry}-${idx}`} className="log-entry">
                      <span className="log-text">{entry}</span>
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </>
          )}

          {status === 'completed' && (
            <div className="alert alert-success" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'inherit' }}>
                {message || 'Transcription complete'}
              </p>
              <button className="btn-primary" onClick={() => router.push(`/editor?job_id=${jobId}`)}>
                Open studio <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
}
