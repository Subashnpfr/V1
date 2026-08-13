'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Subtitles, Youtube, ArrowRight, Video } from 'lucide-react';
import UploadZone from './components/UploadZone';
import ProgressBar from './components/ProgressBar';
import ThemeToggle from './components/ThemeToggle';
import { ThemeProvider } from './components/ThemeProvider';
import { API_BASE } from './utils/api';

function DashboardContent() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processLogs, setProcessLogs] = useState([]);
  const logEndRef = React.useRef(null);

  // Poll job status & real-time logs every 500ms when job is active
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

          if (res.data.status === 'completed') {
            setLoading(false);
          } else if (res.data.status === 'failed') {
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

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [processLogs]);

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);
    setProgress(5);
    setMessage('Uploading file...');

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await axios.post(`${API_BASE}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 20) / progressEvent.total);
            setProgress(percent);
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
        setError(`Cannot connect to backend server at ${API_BASE}. Please ensure the FastAPI backend is running.`);
      } else {
        setError(err.response?.data?.detail || err.message || 'Failed to upload video');
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
      const res = await axios.post(`${API_BASE}/youtube`, { url: youtubeUrl.trim() });
      if (res.data.success) {
        setJobId(res.data.job_id);
        setStatus('downloading youtube video');
      } else {
        setLoading(false);
        setError('YouTube fetch failed');
      }
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.detail || 'Failed to process YouTube URL');
    }
  };

  const navigateToEditor = () => {
    if (jobId) {
      router.push(`/editor?job_id=${jobId}`);
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2.5rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: '#4F8CFF',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Subtitles size={20} />
          </div>
          <div>
            <span style={{ fontWeight: '700', fontSize: '18px', color: 'var(--text-primary)' }}>Auto Captions Studio</span>
          </div>
        </div>
        <div>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '720px', margin: '0 auto' }}>
        <div className="card" style={{ padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Professional Subtitle Editor
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              Transcribe, animate, style, translate, and burn captions for video content.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '0.75rem 1rem',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              fontSize: '13px'
            }}>
              {error}
            </div>
          )}

          {/* Section 1: Drag & Drop */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: '600' }}>
              Upload Video File
            </h3>
            <UploadZone
              onFileSelect={(file) => setSelectedFile(file)}
              selectedFile={selectedFile}
              disabled={loading}
            />
            {selectedFile && !loading && status !== 'completed' && (
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <button className="btn-primary" onClick={handleFileUpload}>
                  <Video size={16} /> Process Uploaded Video
                </button>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '2rem 0',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
            <span style={{ padding: '0 1rem' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border)' }} />
          </div>

          {/* Section 2: YouTube URL */}
          <div>
            <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: '600' }}>
              Import from YouTube
            </h3>
            <form onSubmit={handleYoutubeSubmit} style={{ display: 'flex', gap: '0.75rem' }}>
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
                  type="text"
                  className="input-text"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  disabled={loading}
                  style={{ paddingLeft: '2.5rem' }}
                />
              </div>
              <button
                type="submit"
                className="btn-secondary"
                disabled={loading || !youtubeUrl.trim()}
              >
                Fetch Video
              </button>
            </form>
          </div>

          {/* Progress Bar */}
          {loading && (
            <ProgressBar progress={progress} message={message} />
          )}

          {/* Completed CTA */}
          {status === 'completed' && (
            <div style={{
              marginTop: '2rem',
              padding: '1.25rem',
              borderRadius: '16px',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              textAlign: 'center'
            }}>
              <p style={{ color: '#4ade80', fontWeight: '600', marginBottom: '0.75rem', fontSize: '14px' }}>
                ✓ {message}
              </p>
              <button className="btn-primary" onClick={navigateToEditor}>
                Open Subtitle Studio <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ThemeProvider>
      <DashboardContent />
    </ThemeProvider>
  );
}
