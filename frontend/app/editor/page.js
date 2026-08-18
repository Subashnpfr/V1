'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Globe, Save, Check, Loader2 } from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer';
import Timeline from '../components/Timeline';
import SubtitleEditor from '../components/SubtitleEditor';
import StylingPanel from '../components/StylingPanel';
import ProgressBar from '../components/ProgressBar';
import AppShell from '../components/AppShell';
import AuthGate from '../components/AuthGate';
import { resegmentSubtitles } from '../utils/segmentation';
import { sanitizeSubtitleList } from '../utils/captionText';
import { API_BASE, api } from '../utils/api';
import { generateSubtitlePngFrames } from '../utils/exportRenderer';

function EditorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('job_id');

  const [subtitles, setSubtitles] = useState([]);
  const [filename, setFilename] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [isAudio, setIsAudio] = useState(false);
  const [seekTo, setSeekTo] = useState(null);
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
    fontFamily: 'Montserrat',
    fontSize: 32,
    fontWeight: '900',
    textColor: '#FFFFFF',
    bgColor: '#000000',
    bgOpacity: 0,
    outlineWidth: 5,
    outlineColor: '#000000',
    shadowBlur: 8,
    shadowColor: '#000000',
    position: 'bottom',
    marginV: 40,
    letterSpacing: -0.02,
    textTransform: 'uppercase',
    accentMode: 'last-word'
  });

  // Creator Animation Configuration State
  const [animationConfig, setAnimationConfig] = useState({
    preset: 'none',
    typewriterSpeed: 'medium',
    showCursor: true,
    highlightColor: '#FF2BD6',
    roundedBackground: false
  });

  // Re-segmentation Configuration State
  const [segmentConfig, setSegmentConfig] = useState({
    maxWords: 4,
    maxCharsPerLine: 18,
    maxLines: 1,
    minDuration: 0.6,
    maxDuration: 2.4
  });

  // Subtitle burning states
  const [burning, setBurning] = useState(false);
  const [backendBurning, setBackendBurning] = useState(false);
  const [burnProgress, setBurnProgress] = useState(0);
  const [burnMessage, setBurnMessage] = useState('');
  const [burnCompleted, setBurnCompleted] = useState(false);
  const [notice, setNotice] = useState(null);
  const [outputScript, setOutputScript] = useState('native');
  const [convertingScript, setConvertingScript] = useState(false);
  const [retranscribing, setRetranscribing] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState('auto');

  useEffect(() => {
    if (!jobId) return;

    async function fetchSubtitles() {
      try {
        const res = await api.get(`/subtitles/${jobId}`);
        if (res.data.success) {
          setJobStatus(res.data.transcription_status || res.data.status);
          setIsAudio(!!res.data.is_audio);
          setOutputScript(res.data.output_script || 'native');
          setCaptionLanguage(res.data.source_language || 'auto');
          const trans = res.data.transcription_status || res.data.status;
          if (trans && trans !== 'completed' && trans !== 'failed' && !(res.data.subtitles || []).length) {
            setLoadError('Transcription is still running. Return to the dashboard and wait until it finishes.');
            setLoading(false);
            return;
          }
          const subs = sanitizeSubtitleList(res.data.subtitles || []);
          setSubtitles(subs);
          if ((res.data.output_script || 'native') === 'roman') {
            setSegmentConfig((prev) => ({ ...prev, maxCharsPerLine: Math.max(prev.maxCharsPerLine, 28) }));
          }
          setFilename(res.data.filename || 'Video');

          if (subs.length > 0) {
            setVideoDuration(Math.max(...subs.map(s => s.end), 10));
          }
        }
      } catch (err) {
        const status = err.response?.status;
        if (status === 404) setLoadError('Job not found. The backend may have been restarted without a saved project file.');
        else if (status === 403) setLoadError('You do not have access to this job.');
        else if (status === 401) setLoadError('Please sign in to open this project.');
        else setLoadError('Could not load this project. Check that the API is running.');
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
        const res = await api.get(`/status/${jobId}`);
        if (res.data.success) {
          setBurnProgress(res.data.progress);
          setBurnMessage(res.data.message);
          if (res.data.export_status === 'completed') {
            setBackendBurning(false);
            setBurning(false);
            setBurnCompleted(true);
          } else if (res.data.export_status === 'failed') {
            setBackendBurning(false);
            setBurning(false);
            setNotice(res.data.error || res.data.message);
          } else if (res.data.export_status === 'burning') {
            setBurnProgress(res.data.progress || 90);
          }
        }
      } catch (err) {
        console.error('Error checking burn status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [backendBurning, jobId]);

  const handleSaveSubtitles = async () => {
    if (!jobId) return false;
    setSaving(true);
    try {
      const res = await api.post(`/subtitles/${jobId}`, { subtitles });
      if (res.data.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        return true;
      }
      setNotice('Failed to save subtitles');
      return false;
    } catch (err) {
      setNotice('Failed to save subtitles');
      return false;
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
    const ok = window.confirm(
      'Translation uses Google Translate and requires internet. Caption text is sent to Google. Continue?'
    );
    if (!ok) return;
    setTranslating(true);
    try {
      const res = await api.post(`/translate/${jobId}`, {
        target_language: targetLang
      });
      if (res.data.success) {
        setSubtitles(res.data.subtitles);
        setNotice(res.data.privacy || 'Translated. Word timings are approximate.');
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setNotice(typeof detail === 'string' ? detail : 'Translation failed. Google Translate requires internet.');
    } finally {
      setTranslating(false);
    }
  };

  const handleConvertScript = async () => {
    if (!jobId) return;
    await handleSaveSubtitles();
    setConvertingScript(true);
    try {
      const res = await api.post(`/script/${jobId}`, { output_script: outputScript });
      if (res.data.success) {
        setSubtitles(res.data.subtitles || []);
        setOutputScript(res.data.output_script);
        setNotice(res.data.note || 'Script updated. Meaning is unchanged.');
        if (res.data.output_script === 'roman') {
          setSegmentConfig((prev) => ({ ...prev, maxCharsPerLine: Math.max(prev.maxCharsPerLine, 28) }));
        }
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setNotice(typeof detail === 'string' ? detail : 'Script conversion failed.');
    } finally {
      setConvertingScript(false);
    }
  };

  const handleRetranscribe = async () => {
    if (!jobId) return;
    const ok = window.confirm('Re-transcribe this media with the selected spoken language? Captions will be replaced.');
    if (!ok) return;
    setRetranscribing(true);
    try {
      await api.post(`/retranscribe/${jobId}`, {
        language: captionLanguage,
        output_script: outputScript
      });
      setNotice('Re-transcribing… stay on this page.');
      const poll = setInterval(async () => {
        try {
          const st = await api.get(`/status/${jobId}`);
          if (st.data.status === 'completed') {
            clearInterval(poll);
            const res = await api.get(`/subtitles/${jobId}`);
            setSubtitles(sanitizeSubtitleList(res.data.subtitles || []));
            setOutputScript(res.data.output_script || outputScript);
            setRetranscribing(false);
            setNotice('Re-transcription finished.');
          } else if (st.data.status === 'failed') {
            clearInterval(poll);
            setRetranscribing(false);
            setNotice(st.data.error || 'Re-transcription failed.');
          }
        } catch (e) {
          clearInterval(poll);
          setRetranscribing(false);
          setNotice('Could not check re-transcription status.');
        }
      }, 800);
    } catch (err) {
      setRetranscribing(false);
      const detail = err.response?.data?.detail;
      setNotice(typeof detail === 'string' ? detail : 'Could not start re-transcription.');
    }
  };

  const handleBurnSubtitles = async () => {
    if (!jobId) return;
    const saved = await handleSaveSubtitles();
    if (!saved) return;

    setBurning(true);
    setBackendBurning(false);
    setBurnCompleted(false);
    setBurnProgress(5);
    setBurnMessage('Capturing studio overlay (same renderer as preview)...');

    const combinedStyle = {
      ...styleConfig,
      animationPreset: animationConfig.preset,
      highlightColor: animationConfig.highlightColor,
      maxWordsPerLine: segmentConfig.maxWords,
      maxCharsPerLine: segmentConfig.maxCharsPerLine
    };

    try {
      const vw = isAudio ? 1920 : (videoMeta.width || 1920);
      const vh = isAudio ? 1080 : (videoMeta.height || 1080);
      const frames = await generateSubtitlePngFrames({
        subtitles,
        styleConfig: combinedStyle,
        animationConfig,
        videoWidth: vw,
        videoHeight: vh,
        onProgress: (pct) => {
          setBurnProgress(Math.min(80, 5 + Math.round(pct * 0.7)));
          setBurnMessage(`Capturing overlay ${pct}%`);
        }
      });
      setBurnMessage('Compositing overlay onto video...');
      setBackendBurning(true);
      await api.post(
        `/burn/${jobId}`,
        { style_config: combinedStyle, frames },
        { timeout: 600000, maxBodyLength: Infinity, maxContentLength: Infinity }
      );
    } catch (err) {
      setBurning(false);
      setBackendBurning(false);
      const detail = err.response?.data?.detail;
      setNotice(typeof detail === 'string' ? detail : (err.message || 'Failed to start subtitle export.'));
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
      <AppShell compact>
        <div className="card" style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
          <h2>No project selected</h2>
          <p style={{ margin: '0.75rem 0 1.25rem' }}>Start from the dashboard to generate captions first.</p>
          <button className="btn-primary" onClick={() => router.push('/')}>
            Back to dashboard
          </button>
        </div>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell compact>
        <div style={{ textAlign: 'center', paddingTop: '6rem' }}>
          <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p style={{ marginTop: '1rem' }}>Loading studio…</p>
        </div>
      </AppShell>
    );
  }

  if (loadError) {
    return (
      <AppShell compact>
        <div className="card" style={{ maxWidth: 520, margin: '4rem auto', textAlign: 'center' }}>
          <h2>Cannot open studio</h2>
          <p style={{ margin: '0.75rem 0 1.25rem' }}>{loadError}</p>
          <button className="btn-primary" onClick={() => router.push('/')}>Back to dashboard</button>
        </div>
      </AppShell>
    );
  }

  const videoUrl = `${API_BASE}/video/${jobId}`;

  return (
    <AppShell compact>
      <div className="studio-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
          <button className="btn-secondary" onClick={() => router.push('/')} aria-label="Back">
            <ArrowLeft size={18} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: '18px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filename}
            </h1>
            <p style={{ fontSize: '12px' }}>{subtitles.length} cues · local job</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.35rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <select
              value={captionLanguage}
              onChange={(e) => setCaptionLanguage(e.target.value)}
              disabled={retranscribing}
              aria-label="Spoken language for re-transcribe"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px' }}
            >
              <option value="auto">Auto detect</option>
              <option value="ne">Nepali</option>
              <option value="hi">Hindi / Hinglish</option>
              <option value="en">English</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={handleRetranscribe} disabled={retranscribing}>
            {retranscribing ? <Loader2 size={15} className="animate-spin" /> : 'Re-transcribe'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.35rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <select
              value={outputScript}
              onChange={(e) => setOutputScript(e.target.value)}
              disabled={convertingScript || captionLanguage === 'en'}
              aria-label="Caption script"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px' }}
            >
              <option value="native">Native script</option>
              <option value="roman">Romanized / Hinglish</option>
            </select>
          </div>
          <button className="btn-secondary" onClick={handleConvertScript} disabled={convertingScript || captionLanguage === 'en'}>
            {convertingScript ? <Loader2 size={15} className="animate-spin" /> : 'Convert script'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface)', padding: '0.35rem 0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <Globe size={16} style={{ color: 'var(--accent)' }} />
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
            {savedSuccess ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {notice && <div className="alert alert-error">{notice}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="editor-grid">
          <VideoPlayer
            videoUrl={videoUrl}
            subtitles={subtitles}
            onTimeUpdate={(t) => setCurrentTime(t)}
            onVideoMetadata={(meta) => setVideoMeta(meta)}
            seekTo={seekTo}
            activeSubtitleId={activeSubId}
            isAudio={isAudio}
            styleConfig={{
              ...styleConfig,
              maxCharsPerLine: segmentConfig.maxCharsPerLine,
              maxWordsPerLine: segmentConfig.maxWords
            }}
            animationConfig={animationConfig}
          />

          <StylingPanel
            styleConfig={styleConfig}
            onChangeStyle={(upd) => setStyleConfig(prev => ({ ...prev, ...upd }))}
            segmentConfig={segmentConfig}
            onChangeSegment={(upd) => setSegmentConfig(prev => ({ ...prev, ...upd }))}
            animationConfig={animationConfig}
            onChangeAnimation={(upd) => setAnimationConfig(prev => ({ ...prev, ...upd }))}
            onApplyLook={(look) => {
              setStyleConfig(prev => ({ ...prev, ...look.style }));
              setAnimationConfig(prev => ({ ...prev, ...look.animation }));
            }}
            onApplyResegmentation={handleApplyResegmentation}
            onDownloadSrt={() => downloadFile(`${API_BASE}/download/${jobId}.srt`, `${jobId}.srt`)}
            onDownloadVtt={() => downloadFile(`${API_BASE}/download/${jobId}.vtt`, `${jobId}.vtt`)}
            onBurnSubtitles={handleBurnSubtitles}
            canBurnVideo
            burning={burning}
          />
        </div>

        {burning && (
          <div className="card">
            <ProgressBar progress={burnProgress} message={burnMessage} />
          </div>
        )}

        {burnCompleted && (
          <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>Subtitled MP4 is ready</span>
            <button
              className="btn-primary"
              onClick={() => downloadFile(`${API_BASE}/download/${jobId}.mp4`, `${jobId}_subtitled.mp4`)}
            >
              Download MP4
            </button>
          </div>
        )}

        <Timeline
          duration={videoDuration}
          currentTime={currentTime}
          subtitles={subtitles}
          activeSubtitleId={activeSubId}
          onSeek={(t) => {
            setCurrentTime(t);
            setSeekTo(t);
          }}
        />

        <div className="card">
          <SubtitleEditor
            subtitles={subtitles}
            onChange={(updated) => setSubtitles(updated)}
            activeSubtitleId={activeSubId}
            onTogglePlay={() => setSeekTo((t) => (t == null ? currentTime : t))}
          />
        </div>
      </div>
    </AppShell>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', paddingTop: '4rem', color: 'var(--text-secondary)' }}>Loading studio…</div>}>
      <AuthGate>
        <EditorContent />
      </AuthGate>
    </Suspense>
  );
}
