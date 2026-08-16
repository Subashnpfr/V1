'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Square, RotateCcw } from 'lucide-react';
import {
  MAX_RECORDING_DURATION_SECONDS,
  extensionForMime,
  formatTimer,
  pickRecordingMimeType
} from '../utils/recordingMime';
import { RECORDING_PHASE, revokePreviewUrl, stopMediaTracks } from '../utils/recordingMachine';

function levelFromAnalyser(analyser, data) {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(data);
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) {
    const v = (data[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / data.length) * 4);
}

export default function VoiceRecorder({ disabled, onUseRecording }) {
  const [phase, setPhase] = useState(RECORDING_PHASE.idle);
  const [error, setError] = useState(null);
  const [errorCode, setErrorCode] = useState(null);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [mimeType, setMimeType] = useState('');

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const elapsedOffsetRef = useRef(0);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const previewUrlRef = useRef(null);

  const fail = (code, message) => {
    setErrorCode(code);
    setError(message);
    setPhase(RECORDING_PHASE.error);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const teardownStream = () => {
    stopMediaTracks(streamRef.current);
    streamRef.current = null;
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  const discardPreview = () => {
    if (previewUrlRef.current) {
      revokePreviewUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
    setBlob(null);
  };

  useEffect(() => {
    return () => {
      clearTimer();
      teardownStream();
      if (previewUrlRef.current) revokePreviewUrl(previewUrlRef.current);
    };
  }, []);

  const refreshDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const mics = list.filter((d) => d.kind === 'audioinput');
    setDevices(mics);
  };

  const attachAnalyser = (stream) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        setLevel(levelFromAnalyser(analyser, data));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      analyserRef.current = null;
    }
  };

  const requestMic = async (nextDeviceId) => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      fail('RECORDING_NOT_SUPPORTED', 'This browser does not support microphone recording.');
      return null;
    }
    setPhase(RECORDING_PHASE.requesting_permission);
    setError(null);
    setErrorCode(null);
    teardownStream();
    const constraints = {
      audio: nextDeviceId ? { deviceId: { exact: nextDeviceId } } : true
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      await refreshDevices();
      attachAnalyser(stream);
      setPhase(RECORDING_PHASE.ready);
      return stream;
    } catch (err) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        fail(
          'MICROPHONE_PERMISSION_DENIED',
          'Microphone access is required to record audio. Enable the microphone in browser settings, then try again.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        fail('MICROPHONE_UNAVAILABLE', 'No microphone was found on this device.');
      } else {
        fail('MICROPHONE_UNAVAILABLE', 'Could not open the microphone.');
      }
      return null;
    }
  };

  const startClock = () => {
    startedAtRef.current = Date.now();
    clearTimer();
    timerRef.current = setInterval(() => {
      const next = elapsedOffsetRef.current + (Date.now() - startedAtRef.current) / 1000;
      setElapsed(next);
      if (next >= MAX_RECORDING_DURATION_SECONDS) {
        stopRecording();
      }
    }, 200);
  };

  const assembleBlob = () => {
    const mime = mimeType || pickRecordingMimeType((t) => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
    const fileBlob = new Blob(chunksRef.current, { type: mime });
    chunksRef.current = [];
    return { fileBlob, mime };
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      setPhase(RECORDING_PHASE.processing_recording);
      rec.stop();
    }
  };

  const beginRecording = async () => {
    discardPreview();
    let stream = streamRef.current;
    if (!stream) {
      stream = await requestMic(deviceId);
      if (!stream) return;
    }
    const mime = pickRecordingMimeType((t) => MediaRecorder.isTypeSupported(t));
    if (!mime && typeof MediaRecorder === 'undefined') {
      fail('RECORDING_NOT_SUPPORTED', 'This browser does not support microphone recording.');
      return;
    }
    chunksRef.current = [];
    elapsedOffsetRef.current = 0;
    setElapsed(0);
    setMimeType(mime);
    let recorder;
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (err) {
      fail('RECORDING_FAILED', 'Could not start the recorder.');
      return;
    }
    recorderRef.current = recorder;
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };
    recorder.onerror = () => {
      fail('RECORDING_FAILED', 'Recording failed.');
      teardownStream();
    };
    recorder.onstop = () => {
      clearTimer();
      const liveElapsed = elapsedOffsetRef.current + Math.max(0, (Date.now() - startedAtRef.current) / 1000);
      teardownStream();
      const { fileBlob, mime: usedMime } = assembleBlob();
      if (fileBlob.size < 1) {
        fail('RECORDING_EMPTY', 'No audio was captured. Try recording again.');
        return;
      }
      const url = URL.createObjectURL(fileBlob);
      previewUrlRef.current = url;
      setPreviewUrl(url);
      setBlob(fileBlob);
      setMimeType(usedMime);
      setElapsed(Math.min(liveElapsed, MAX_RECORDING_DURATION_SECONDS));
      setPhase(RECORDING_PHASE.completed);
    };
    recorder.start(250);
    setPhase(RECORDING_PHASE.recording);
    startClock();
  };

  const pauseRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'recording') return;
    rec.pause();
    elapsedOffsetRef.current += (Date.now() - startedAtRef.current) / 1000;
    clearTimer();
    setPhase(RECORDING_PHASE.paused);
  };

  const resumeRecording = () => {
    const rec = recorderRef.current;
    if (!rec || rec.state !== 'paused') return;
    rec.resume();
    startClock();
    setPhase(RECORDING_PHASE.recording);
  };

  const cancelAll = () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
    } catch (err) {
      console.error('Failed to stop recorder', err);
    }
    clearTimer();
    teardownStream();
    discardPreview();
    chunksRef.current = [];
    elapsedOffsetRef.current = 0;
    setElapsed(0);
    setLevel(0);
    setPhase(RECORDING_PHASE.idle);
    setError(null);
    setErrorCode(null);
  };

  const rerecord = () => {
    discardPreview();
    elapsedOffsetRef.current = 0;
    setElapsed(0);
    setPhase(RECORDING_PHASE.idle);
    requestMic(deviceId);
  };

  const remaining = Math.max(0, MAX_RECORDING_DURATION_SECONDS - elapsed);

  return (
    <div className="voice-recorder">
      <p className="lead" style={{ fontSize: '13px', marginBottom: '0.85rem' }}>
        The recording is captured from your microphone on this device. When you use it, audio is sent to the
        local V1 Captions backend and transcribed with Whisper on this machine. Optional translation still uses Google.
      </p>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
          {errorCode === 'MICROPHONE_PERMISSION_DENIED' && (
            <span> You will not be prompted again until you change the site permission.</span>
          )}
        </div>
      )}

      {phase !== RECORDING_PHASE.idle && phase !== RECORDING_PHASE.error && devices.length > 0 && (
        <>
          <label className="field-label" htmlFor="mic-select">Microphone</label>
          <select
            id="mic-select"
            value={deviceId}
            disabled={disabled || phase === RECORDING_PHASE.recording || phase === RECORDING_PHASE.paused}
            onChange={async (e) => {
              const next = e.target.value;
              setDeviceId(next);
              if (phase === RECORDING_PHASE.ready) await requestMic(next);
            }}
            style={{ marginBottom: '0.85rem' }}
          >
            <option value="">Default microphone</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Microphone'}
              </option>
            ))}
          </select>
        </>
      )}

      {(phase === RECORDING_PHASE.recording || phase === RECORDING_PHASE.paused) && (
        <div
          className="recorder-meter"
          role="img"
          aria-hidden="true"
          style={{
            height: 8,
            borderRadius: 99,
            background: 'var(--border)',
            overflow: 'hidden',
            marginBottom: '0.75rem'
          }}
        >
          <div style={{ width: `${Math.round(level * 100)}%`, height: '100%', background: 'var(--accent)' }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <strong aria-live="polite">
          {phase === RECORDING_PHASE.recording && 'Recording'}
          {phase === RECORDING_PHASE.paused && 'Recording paused'}
          {phase === RECORDING_PHASE.ready && 'Ready to record'}
          {phase === RECORDING_PHASE.completed && 'Recording complete'}
          {phase === RECORDING_PHASE.requesting_permission && 'Waiting for microphone permission'}
          {phase === RECORDING_PHASE.processing_recording && 'Processing recording'}
          {(phase === RECORDING_PHASE.idle || phase === RECORDING_PHASE.error) && 'Record voice'}
        </strong>
        <span className="mono" aria-label={`Elapsed ${formatTimer(elapsed)}, maximum ${formatTimer(MAX_RECORDING_DURATION_SECONDS)}`}>
          {formatTimer(elapsed)} / {formatTimer(MAX_RECORDING_DURATION_SECONDS)}
        </span>
      </div>
      {(phase === RECORDING_PHASE.recording || phase === RECORDING_PHASE.paused) && (
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          Remaining {formatTimer(remaining)}
        </p>
      )}

      {phase === RECORDING_PHASE.completed && previewUrl && (
        <audio controls src={previewUrl} style={{ width: '100%', marginBottom: '0.85rem' }}>
          Your browser does not support audio playback.
        </audio>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {(phase === RECORDING_PHASE.idle || phase === RECORDING_PHASE.error) && (
          <button type="button" className="btn-primary" disabled={disabled} onClick={() => requestMic(deviceId)}>
            <Mic size={16} /> Enable microphone
          </button>
        )}
        {phase === RECORDING_PHASE.ready && (
          <button type="button" className="btn-primary" disabled={disabled} onClick={beginRecording}>
            <Mic size={16} /> Start recording
          </button>
        )}
        {phase === RECORDING_PHASE.recording && (
          <>
            <button type="button" className="btn-secondary" onClick={pauseRecording}><Pause size={16} /> Pause</button>
            <button type="button" className="btn-primary" onClick={stopRecording}><Square size={16} /> Stop</button>
          </>
        )}
        {phase === RECORDING_PHASE.paused && (
          <>
            <button type="button" className="btn-primary" onClick={resumeRecording}><Play size={16} /> Resume</button>
            <button type="button" className="btn-secondary" onClick={stopRecording}><Square size={16} /> Stop</button>
          </>
        )}
        {phase === RECORDING_PHASE.completed && blob && (
          <>
            <button
              type="button"
              className="btn-primary"
              disabled={disabled}
              onClick={() => onUseRecording({
                blob,
                mimeType,
                filename: `recording.${extensionForMime(mimeType)}`,
                duration: elapsed
              })}
            >
              Use recording
            </button>
            <button type="button" className="btn-secondary" disabled={disabled} onClick={rerecord}>
              <RotateCcw size={16} /> Re-record
            </button>
          </>
        )}
        {phase !== RECORDING_PHASE.idle && (
          <button type="button" className="btn-secondary" disabled={disabled} onClick={cancelAll}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
