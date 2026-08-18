'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Youtube, ArrowRight, Video, Sparkles, Mic } from 'lucide-react';
import UploadZone from './components/UploadZone';
import VoiceRecorder from './components/VoiceRecorder';
import ProgressBar from './components/ProgressBar';
import AppShell from './components/AppShell';
import AuthGate from './components/AuthGate';
import { api } from './utils/api';

function DashboardContent() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [language, setLanguage] = useState('auto');
  const [outputScript, setOutputScript] = useState('native');
  const [transcriptionQuality, setTranscriptionQuality] = useState('fast');
  const [projectId, setProjectId] = useState(null);
  const [projectError, setProjectError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [processLogs, setProcessLogs] = useState([]);
  const [uiReady, setUiReady] = useState(false);
  const [createMode, setCreateMode] = useState('upload');
  const [fromRecording, setFromRecording] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    setUiReady(true);
  }, []);

  useEffect(() => {
    async function ensureProject() {
      try {
        const res = await api.get('/api/projects');
        let projects = res.data.projects || [];
        if (!projects.length) {
          const created = await api.post('/api/projects', { name: 'My Project' });
          projects = [created.data.project];
        }
        setProjectId(projects[0].id);
      } catch (err) {
        setProjectError('Could not load your project. Try refreshing.');
        console.error(err);
      }
    }
    ensureProject();
  }, []);

  useEffect(() => {
    if (!jobId || status === 'completed' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/status/${jobId}`);
        if (res.data.success) {
          setStatus(res.data.status);
          setProgress(res.data.progress);
          setMessage(res.data.message);
          if (res.data.logs && Array.isArray(res.data.logs)) {
            setProcessLogs(res.data.logs);
          }
          if (res.data.status === 'completed') {
            setLoading(false);
            if (res.data.asr_fallback) {
              setMessage(
                res.data.message
                  + ' High Accuracy requested, but this system could not load large-v3; the Medium model was used.'
              );
            }
            if (fromRecording) {
              router.push(`/editor?job_id=${jobId}`);
            }
          } else if (res.data.status === 'failed') {
            setLoading(false);
            setError(res.data.error || res.data.message || 'Job processing failed');
          }
        }
      } catch (err) {
        console.error('Error fetching job status:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [jobId, status, fromRecording, router]);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [processLogs]);

  const handleRecordingUpload = async ({ blob, filename }) => {
    if (!blob || !projectId) return;
    setFromRecording(true);
    setLoading(true);
    setError(null);
    setProgress(8);
    setMessage('Uploading recording...');
    const formData = new FormData();
    formData.append('file', blob, filename || 'recording.webm');
    formData.append('source_type', 'recording');
    formData.append('project_id', projectId);
    if (language && language !== 'auto') formData.append('language', language);
    formData.append('output_script', language === 'en' ? 'native' : outputScript);
    formData.append('transcription_quality', transcriptionQuality);
    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setJobId(res.data.job_id);
        setStatus('processing');
        setMessage('Transcribing...');
      } else {
        setLoading(false);
        setError(res.data.message || 'Upload failed');
      }
    } catch (err) {
      setLoading(false);
      if (err.code === 'ERR_NETWORK' || !err.response) {
        setError('Cannot reach the API. Start the FastAPI backend and try again.');
      } else {
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : err.message || 'Failed to upload recording');
      }
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !projectId) return;
    setFromRecording(false);
    setLoading(true);
    setError(null);
    setProgress(5);
    setMessage('Uploading file...');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('project_id', projectId);
    if (language && language !== 'auto') formData.append('language', language);
    formData.append('output_script', language === 'en' ? 'native' : outputScript);
    formData.append('transcription_quality', transcriptionQuality);

    try {
      const res = await api.post('/upload', formData, {
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
        setError('Cannot reach the API. Start the FastAPI backend and try again.');
      } else {
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : err.message || 'Failed to upload video');
      }
    }
  };

  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim() || !projectId) return;
    setFromRecording(false);
    setLoading(true);
    setError(null);
    setProgress(10);
    setMessage('Connecting to YouTube...');
    try {
      const res = await api.post('/youtube', {
        url: youtubeUrl.trim(),
        language: language === 'auto' ? null : language,
        output_script: language === 'en' ? 'native' : outputScript,
        transcription_quality: transcriptionQuality,
        project_id: projectId,
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
          <div className="eyebrow"><Sparkles size={14} /> Local AI studio</div>
          <h1>Captions that feel <em>shipped</em>, not sketched.</h1>
          <p className="lead">
            Transcribe with Whisper on this machine, then style and burn an MP4.
            Optional translation uses Google Translate and sends caption text over the internet.
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
          {!uiReady ? (
            <p className="lead">Loading studio…</p>
          ) : (
            <>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          {projectError && <div className="alert alert-error" role="alert">{projectError}</div>}

          <label className="field-label" htmlFor="language">Spoken language</label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={loading}
            style={{ marginBottom: '1.15rem' }}
            suppressHydrationWarning
          >
            <option value="auto">Auto detect</option>
            <option value="en">English</option>
            <option value="ne">Nepali (नेपाली)</option>
            <option value="hi">Hindi / Hinglish</option>
          </select>

          <label className="field-label" htmlFor="transcription-quality">Transcription quality</label>
          <select
            id="transcription-quality"
            value={transcriptionQuality}
            onChange={(e) => setTranscriptionQuality(e.target.value)}
            disabled={loading}
            style={{ marginBottom: '1.15rem' }}
          >
            <option value="fast">Fast — everyday use (medium model)</option>
            <option value="high_accuracy">High accuracy — large-v3 if this PC can load it (slower, more RAM)</option>
          </select>

          {language !== 'en' && (
            <>
              <label className="field-label" htmlFor="output-script">Caption script</label>
              <select
                id="output-script"
                value={outputScript}
                onChange={(e) => setOutputScript(e.target.value)}
                disabled={loading}
                style={{ marginBottom: '1.15rem' }}
              >
                <option value="native">Native (Devanagari)</option>
                <option value="roman">
                  {language === 'hi' ? 'Romanized / Hinglish (still Hindi)' : 'Romanized Nepali (still Nepali)'}
                </option>
              </select>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '-0.65rem 0 1rem' }}>
                Romanized changes letters, not meaning. Use Translate in the studio to change language.
              </p>
            </>
          )}

          <label className="field-label">Create captions</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              type="button"
              className={createMode === 'upload' ? 'btn-primary' : 'btn-secondary'}
              disabled={loading}
              onClick={() => setCreateMode('upload')}
            >
              <Video size={16} /> Upload media
            </button>
            <button
              type="button"
              className={createMode === 'record' ? 'btn-primary' : 'btn-secondary'}
              disabled={loading}
              onClick={() => setCreateMode('record')}
            >
              <Mic size={16} /> Record
            </button>
          </div>

          {createMode === 'upload' ? (
            <>
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
            </>
          ) : (
            <VoiceRecorder disabled={loading} onUseRecording={handleRecordingUpload} />
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
                suppressHydrationWarning
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
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}

export default function Dashboard() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}
