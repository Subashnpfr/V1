'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { ArrowLeft, Globe, Save, Check, Loader2 } from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';
import Timeline from '../components/Timeline';
import SubtitleEditor from '../components/SubtitleEditor';
import StylingPanel from '../components/StylingPanel';
import ProgressBar from '../components/ProgressBar';
import ThemeToggle from '../components/ThemeToggle';
import { ThemeProvider } from '../components/ThemeProvider';
import { resegmentSubtitles } from '../utils/segmentation';
import { generateSubtitlePngFrames } from '../utils/exportRenderer';

const API_BASE = 'http://127.0.0.1:8000';

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('job_id');

  const [subtitles, setSubtitles] = useState([]);
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('English');
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(60);
  const [videoMeta, setVideoMeta] = useState({ width: 1920, height: 1080 });
  const [activeSubId, setActiveSubId] = useState(null);

  // Styling Configuration State
  const [styleConfig, setStyleConfig] = useState({
    fontFamily: 'Inter',
    fontSize: 22,
    fontWeight: '600',
    textColor: '#F5F7FA',
    bgColor: '#000000',
    bgOpacity: 0.6,
    outlineWidth: 1,
    outlineColor: '#000000',
    shadowBlur: 4,
    shadowColor: '#000000',
    position: 'bottom',
    marginV: 30
  });

  // Creator Animation Configuration State
  const [animationConfig, setAnimationConfig] = useState({
    preset: 'none',
    typewriterSpeed: 'medium',
    showCursor: true,
    highlightColor: '#4F8CFF',
    roundedBackground: true
  });

  // Re-segmentation Configuration State
  const [segmentConfig, setSegmentConfig] = useState({
    maxWords: 6,
    maxCharsPerLine: 32,
    maxLines: 2,
    minDuration: 0.8,
    maxDuration: 4.0
  });

  // Subtitle burning states
  const [burning, setBurning] = useState(false);
  const [backendBurning, setBackendBurning] = useState(false);
  const [burnProgress, setBurnProgress] = useState(0);
  const [burnMessage, setBurnMessage] = useState('');
  const [burnCompleted, setBurnCompleted] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    async function fetchSubtitles() {
      try {
        const res = await axios.get(`${API_BASE}/subtitles/${jobId}`);
        if (res.data.success) {
          const subs = res.data.subtitles || [];
          setSubtitles(subs);
          setFilename(res.data.filename || 'Video');

          if (subs.length > 0) {
            setVideoDuration(Math.max(...subs.map(s => s.end), 10));
          }
        }
      } catch (err) {
        console.error('Failed to load subtitles:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchSubtitles();
  }, [jobId]);

  // Sync active subtitle during video playback
  useEffect(() => {
    const active = subtitles.find(
      s => currentTime >= s.start && currentTime <= s.end
    );
    setActiveSubId(active ? active.id : null);
  }, [currentTime, subtitles]);

  // Poll status when burning subtitles on backend
  useEffect(() => {
    if (!backendBurning || !jobId) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/status/${jobId}`);
        if (res.data.success) {
          if (res.data.status === 'burning subtitles' || res.data.status === 'completed' || res.data.status === 'failed') {
            setBurnProgress(res.data.progress);
            setBurnMessage(res.data.message);

            if (res.data.status === 'completed') {
              setBackendBurning(false);
              setBurning(false);
              setBurnCompleted(true);
            } else if (res.data.status === 'failed') {
              setBackendBurning(false);
              setBurning(false);
              alert(`Burning failed: ${res.data.error || res.data.message}`);
            }
          }
        }
      } catch (err) {
        console.error('Error checking burn status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [backendBurning, jobId]);

  const handleSaveSubtitles = async () => {
    if (!jobId) return;
    setSaving(true);
    try {
      const res = await axios.post(`${API_BASE}/subtitles/${jobId}`, { subtitles });
      if (res.data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err) {
      alert('Failed to save subtitles');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyResegmentation = () => {
    const resegmented = resegmentSubtitles(subtitles, segmentConfig);
    setSubtitles(resegmented);
  };

  const handleTranslate = async () => {
    if (!jobId) return;
    setTranslating(true);
    try {
      const res = await axios.post(`${API_BASE}/translate/${jobId}`, {
        target_language: targetLang
      });
      if (res.data.success) {
        setSubtitles(res.data.subtitles);
      }
    } catch (err) {
      alert('Translation failed. Please try again.');
    } finally {
      setTranslating(false);
    }
  };

  const handleBurnSubtitles = async () => {
    if (!jobId) return;

    await handleSaveSubtitles();

    setBurning(true);
    setBackendBurning(false);
    setBurnCompleted(false);
    setBurnProgress(5);
    setBurnMessage('Snapshotting preview overlay frames matching preview window...');

    const combinedStyle = {
      ...styleConfig,
      animationPreset: animationConfig.preset,
      highlightColor: animationConfig.highlightColor
    };

    try {
      let frames = [];
      try {
        frames = await generateSubtitlePngFrames({
          subtitles,
          styleConfig,
          animationConfig,
          videoWidth: videoMeta.width || 1920,
          videoHeight: videoMeta.height || 1080,
          onProgress: (p) => {
            setBurnProgress(5 + Math.round(p * 0.7)); // 5% to 75%
            setBurnMessage(`Capturing exact preview overlay frames (${Math.round(p)}%)...`);
          }
        });
      } catch (frameErr) {
        console.warn('DOM PNG frame capture warning, using backend renderer:', frameErr);
      }

      setBurnProgress(80);
      setBurnMessage('Rendering video with exact overlay frames via FFmpeg...');

      setBackendBurning(true);

      await axios.post(`${API_BASE}/burn/${jobId}`, {
        style_config: combinedStyle,
        frames: frames && frames.length > 0 ? frames : null
      });
    } catch (err) {
      setBurning(false);
      setBackendBurning(false);
      alert('Failed to trigger subtitle export.');
    }
  };

  const downloadFile = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (!jobId) {
    return (
      <div className="app-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No active job specified.</p>
        <button className="btn-primary" onClick={() => router.push('/')} style={{ marginTop: '1rem' }}>
          Go to Dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app-container" style={{ textAlign: 'center', paddingTop: '6rem' }}>
        <Loader2 size={36} style={{ animation: 'spin 1.5s linear infinite', color: '#4F8CFF' }} />
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Loading Subtitle Studio...</p>
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const videoUrl = `${API_BASE}/video/${jobId}`;

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.25rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-secondary" onClick={() => router.push('/')} style={{ padding: '0.45rem' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {filename}
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Job ID: {jobId}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.35rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <Globe size={16} style={{ color: '#4F8CFF' }} />
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              disabled={translating}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="English">English</option>
              <option value="Nepali">Nepali (नेपाली)</option>
              <option value="Hindi">Hindi (हिन्दी)</option>
              <option value="Spanish">Spanish (Español)</option>
              <option value="French">French (Français)</option>
              <option value="German">German (Deutsch)</option>
              <option value="Japanese">Japanese (日本語)</option>
            </select>
          </div>

          <button className="btn-secondary" onClick={handleTranslate} disabled={translating}>
            {translating ? <Loader2 size={15} className="animate-spin" /> : 'Translate'}
          </button>

          <button className="btn-primary" onClick={handleSaveSubtitles} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : savedSuccess ? <Check size={15} /> : <Save size={15} />}
            {savedSuccess ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </header>

      {/* Main Grid Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: '1.25rem',
          alignItems: 'start'
        }}>
          {/* Left Column: Video Preview */}
          <div>
            <VideoPlayer
              videoUrl={videoUrl}
              subtitles={subtitles}
              onTimeUpdate={(t) => setCurrentTime(t)}
              onVideoMetadata={(meta) => setVideoMeta(meta)}
              activeSubtitleId={activeSubId}
              styleConfig={styleConfig}
              animationConfig={animationConfig}
            />
          </div>

          {/* Right Column: Styling & Animation Sidebar */}
          <div>
            <StylingPanel
              styleConfig={styleConfig}
              onChangeStyle={(upd) => setStyleConfig(prev => ({ ...prev, ...upd }))}
              segmentConfig={segmentConfig}
              onChangeSegment={(upd) => setSegmentConfig(prev => ({ ...prev, ...upd }))}
              animationConfig={animationConfig}
              onChangeAnimation={(upd) => setAnimationConfig(prev => ({ ...prev, ...upd }))}
              onApplyResegmentation={handleApplyResegmentation}
              onDownloadSrt={() => downloadFile(`${API_BASE}/download/${jobId}.srt`, `${jobId}.srt`)}
              onDownloadVtt={() => downloadFile(`${API_BASE}/download/${jobId}.vtt`, `${jobId}.vtt`)}
              onBurnSubtitles={handleBurnSubtitles}
              burning={burning}
            />
          </div>
        </div>

        {/* Burn Status Notifications */}
        {burning && (
          <div className="card">
            <ProgressBar progress={burnProgress} message={burnMessage} />
          </div>
        )}

        {burnCompleted && (
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' }}>
            <span style={{ color: '#4ade80', fontWeight: '600' }}>✓ Subtitled MP4 Ready for Download!</span>
            <button
              className="btn-primary"
              onClick={() => downloadFile(`${API_BASE}/download/${jobId}.mp4`, `${jobId}_subtitled.mp4`)}
              style={{ background: '#22c55e' }}
            >
              Download Subtitled MP4
            </button>
          </div>
        )}

        {/* Timeline */}
        <Timeline
          duration={videoDuration}
          currentTime={currentTime}
          subtitles={subtitles}
          activeSubtitleId={activeSubId}
          onSeek={(t) => setCurrentTime(t)}
        />

        {/* Subtitle Editor */}
        <div className="card">
          <SubtitleEditor
            subtitles={subtitles}
            onChange={(updated) => setSubtitles(updated)}
            activeSubtitleId={activeSubId}
          />
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <ThemeProvider>
      <Suspense fallback={<div style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--text-secondary)' }}>Loading...</div>}>
        <EditorContent />
      </Suspense>
    </ThemeProvider>
  );
}
