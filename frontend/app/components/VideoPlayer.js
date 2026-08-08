'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Music, Volume2, VolumeX, Maximize2, Eye, Box, RefreshCw, Bug } from 'lucide-react';
import SubtitleOverlay from './SubtitleOverlay';

export default function VideoPlayer({
  videoUrl,
  subtitles = [],
  onTimeUpdate,
  onVideoMetadata,
  seekTo,
  activeSubtitleId,
  styleConfig = {},
  animationConfig = {},
  isAudio = false
}) {
  const mediaRef = useRef(null);
  const animFrameRef = useRef(null);
  const containerRef = useRef(null);

  const [aspectRatio, setAspectRatio] = useState('16 / 9');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoBounds, setVideoBounds] = useState({ left: 0, top: 0, width: 0, height: 0, intrinsicW: 1920, intrinsicH: 1080 });

  // Preview Control & Debug States
  const [zoomScale, setZoomScale] = useState(1.0);
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [showBoxBounds, setShowBoxBounds] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  const activeSub = subtitles.find(s => s.id === activeSubtitleId);

  useEffect(() => {
    if (seekTo == null || !mediaRef.current) return;
    if (Math.abs(mediaRef.current.currentTime - seekTo) < 0.05) return;
    mediaRef.current.currentTime = seekTo;
    setCurrentTime(seekTo);
    if (onTimeUpdate) onTimeUpdate(seekTo);
  }, [seekTo, onTimeUpdate]);

  // 60fps high precision time tracking loop
  useEffect(() => {
    const updateLoop = () => {
      if (mediaRef.current && !mediaRef.current.paused) {
        const time = mediaRef.current.currentTime;
        setCurrentTime(time);
        if (onTimeUpdate) onTimeUpdate(time);
      }
      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [onTimeUpdate]);

  const updateVideoBounds = () => {
    if (!mediaRef.current || !containerRef.current || isAudio) return;
    const vW = mediaRef.current.videoWidth || 1920;
    const vH = mediaRef.current.videoHeight || 1080;
    const vAspect = vW / vH;

    const rect = containerRef.current.getBoundingClientRect();
    const cW = rect.width;
    const cH = rect.height;
    if (!cW || !cH) return;

    let renderW, renderH, renderLeft, renderTop;
    if (cW / cH > vAspect) {
      renderH = cH;
      renderW = cH * vAspect;
      renderLeft = (cW - renderW) / 2;
      renderTop = 0;
    } else {
      renderW = cW;
      renderH = cW / vAspect;
      renderLeft = 0;
      renderTop = (cH - renderH) / 2;
    }

    setVideoBounds({
      left: Math.round(renderLeft),
      top: Math.round(renderTop),
      width: Math.round(renderW),
      height: Math.round(renderH),
      intrinsicW: vW,
      intrinsicH: vH
    });

    if (onVideoMetadata) {
      onVideoMetadata({
        width: vW,
        height: vH,
        duration: mediaRef.current?.duration || 0
      });
    }
  };

  useEffect(() => {
    window.addEventListener('resize', updateVideoBounds);
    return () => window.removeEventListener('resize', updateVideoBounds);
  }, [aspectRatio, isAudio]);

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration || 0);
      if (!isAudio) {
        const width = mediaRef.current.videoWidth || 1920;
        const height = mediaRef.current.videoHeight || 1080;
        setAspectRatio(`${width} / ${height}`);
        if (onVideoMetadata) {
          onVideoMetadata({
            width,
            height,
            duration: mediaRef.current.duration || 0
          });
        }
        setTimeout(updateVideoBounds, 50);
      }
    }
  };

  const handleManualTimeUpdate = () => {
    if (mediaRef.current) {
      const time = mediaRef.current.currentTime;
      setCurrentTime(time);
      if (onTimeUpdate) onTimeUpdate(time);
    }
  };

  const togglePlay = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (mediaRef.current) {
      mediaRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (e) => {
    const seekTime = parseFloat(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
      if (onTimeUpdate) onTimeUpdate(seekTime);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  // Shared deterministic line wrapping function (matches backend wrap_subtitle_text 1:1)
  const wrapSubtitleText = (text, maxChars = 36) => {
    if (!text || text.length <= maxChars || text.includes('\n')) return text;
    const words = text.split(/\s+/);
    const lines = [];
    let currLine = [];
    let currLen = 0;
    for (const w of words) {
      if (currLen + w.length + (currLine.length > 0 ? 1 : 0) <= maxChars) {
        currLine.push(w);
        currLen += w.length + (currLine.length > 1 ? 1 : 0);
      } else {
        if (currLine.length > 0) lines.push(currLine.join(' '));
        currLine = [w];
        currLen = w.length;
      }
    }
    if (currLine.length > 0) lines.push(currLine.join(' '));
    return lines.join('\n');
  };

  // ===== ASS-AUTHORITATIVE STYLE MODEL =====
  // All values are derived using the EXACT same math as backend generate_ass_file().
  // Reference base: 540 (the design-time preview height all slider values are calibrated against).
  // ASS values use intrinsic video height (PlayResY). CSS values use rendered container height.
  // Both use the same scale factor: value / 540.
  const getNormalizedStyleModel = () => {
    const baseFontSize = styleConfig.fontSize || 24;
    const fontScale = baseFontSize / 540; // Same as backend: (base_font_size / 540.0)

    const currentH = videoBounds.height || 480;
    const intrinsicH = videoBounds.intrinsicH || 1080;

    // CSS preview font size: scale to rendered container height
    const fontPx = Math.max(12, Math.round(currentH * fontScale));
    // ASS font size: scale to intrinsic video height (PlayResY)
    const assFontSize = Math.round(intrinsicH * fontScale);

    const baseMarginV = styleConfig.marginV ?? 30;
    const marginScale = baseMarginV / 540;
    const bottomMarginPx = Math.round(currentH * marginScale);
    const assMarginV = Math.round(intrinsicH * marginScale);

    // Left/right margins: 20 base units at 540 reference
    const marginLRPx = Math.round(currentH * (20 / 540));
    const assMarginLR = Math.round(intrinsicH * (20 / 540));

    // Outline and shadow: scale proportionally to container height
    const rawOutline = styleConfig.outlineWidth ?? 1;
    const rawShadow = styleConfig.shadowBlur ?? 4;
    const outlineW = Math.max(0, Math.round((rawOutline / 540) * currentH));
    const shadowB = Math.max(0, Math.round((rawShadow / 540) * currentH));
    const assOutline = Math.max(0, Math.round((rawOutline / 540) * intrinsicH));
    const assShadow = Math.max(0, Math.round((rawShadow / 540) * intrinsicH));

    // Padding: In ASS BorderStyle=3, the outline width acts as box padding.
    // Approximate this in CSS with padding proportional to outline.
    const paddingV = Math.max(2, Math.round(outlineW * 1.5 + fontPx * 0.08));
    const paddingH = Math.max(4, Math.round(outlineW * 2.0 + fontPx * 0.15));

    return {
      fontPx,
      assFontSize,
      bottomMarginPx,
      assMarginV,
      marginLRPx,
      assMarginLR,
      outlineW,
      shadowB,
      assOutline,
      assShadow,
      paddingV,
      paddingH,
      fontScale,
      intrinsicH
    };
  };

  const model = getNormalizedStyleModel();

  const getOverlayPositionStyle = () => {
    const pos = styleConfig.position || 'bottom';
    if (pos === 'top') {
      return { top: `${model.bottomMarginPx}px`, bottom: 'auto' };
    }
    if (pos === 'center') {
      return { top: '50%', transform: 'translateY(-50%)', bottom: 'auto' };
    }
    return { bottom: `${model.bottomMarginPx}px`, top: 'auto' };
  };

  const hexToRgba = (hex, alpha = 1.0) => {
    if (!hex) return `rgba(0, 0, 0, ${alpha})`;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    if (c.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  };

  // Outline + shadow: approximate libass stroke rendering with CSS text-shadow.
  // libass renders a uniform outline around glyphs, so we use 8-directional offsets
  // at the outline width, plus a drop shadow offset.
  const getOutlineShadowStyle = () => {
    const outlineC = styleConfig.outlineColor || '#000000';
    const shadowC = styleConfig.shadowColor || 'rgba(0,0,0,0.7)';
    const ow = model.outlineW;
    const sb = model.shadowB;

    const shadows = [];
    if (ow > 0) {
      // 8-directional outline approximation (N, NE, E, SE, S, SW, W, NW)
      shadows.push(`0 -${ow}px 0 ${outlineC}`);
      shadows.push(`${ow}px -${ow}px 0 ${outlineC}`);
      shadows.push(`${ow}px 0 0 ${outlineC}`);
      shadows.push(`${ow}px ${ow}px 0 ${outlineC}`);
      shadows.push(`0 ${ow}px 0 ${outlineC}`);
      shadows.push(`-${ow}px ${ow}px 0 ${outlineC}`);
      shadows.push(`-${ow}px 0 0 ${outlineC}`);
      shadows.push(`-${ow}px -${ow}px 0 ${outlineC}`);
    }
    if (sb > 0) {
      shadows.push(`${Math.round(sb * 0.5)}px ${Math.round(sb * 0.7)}px ${sb}px ${shadowC}`);
    }

    return shadows.length > 0 ? shadows.join(', ') : 'none';
  };

  const resetPreviewControls = () => {
    setZoomScale(1.0);
    setShowSafeArea(false);
    setShowBoxBounds(false);
    setShowDebugInfo(false);
  };

  // Font Family Fallback Stack (Latin + Devanagari)
  const getFontFamilyStack = () => {
    const chosenFont = styleConfig.fontFamily || 'Noto Sans Devanagari';
    return `"${chosenFont}", "Noto Sans Devanagari", "Inter", sans-serif`;
  };

  // Render animated subtitle content
  const renderAnimatedSubtitle = () => {
    if (!activeSub || !activeSub.text) return null;

    const preset = animationConfig.preset || 'none';
    const highlightColor = animationConfig.highlightColor || '#F59E0B';
    const enablePill = animationConfig.roundedBackground !== false;
    const typewriterSpeed = animationConfig.typewriterSpeed || 'medium';
    const cursorOn = animationConfig.showCursor !== false;

    const wrappedText = wrapSubtitleText(activeSub.text, 36);

    let words = activeSub.words;
    if (!words || !Array.isArray(words) || words.length === 0) {
      const rawWords = wrappedText.trim().split(/\s+/).filter(Boolean);
      const totalDur = Math.max(0.1, activeSub.end - activeSub.start);
      const wordDur = totalDur / Math.max(1, rawWords.length);
      words = rawWords.map((w, idx) => ({
        text: w,
        start: activeSub.start + idx * wordDur,
        end: activeSub.start + (idx + 1) * wordDur,
        emphasized: false
      }));
    }

    if (preset === 'none') {
      return <span>{wrappedText}</span>;
    }

    if (preset === 'typewriter') {
      const speedMultiplier = typewriterSpeed === 'fast' ? 40 : typewriterSpeed === 'slow' ? 15 : 25;
      const elapsedSec = Math.max(0, currentTime - activeSub.start);
      const charCount = Math.floor(elapsedSec * speedMultiplier);
      const visibleText = wrappedText.slice(0, Math.min(wrappedText.length, charCount));

      return (
        <span>
          {visibleText}
          {cursorOn && charCount < wrappedText.length && <span className="typewriter-cursor" />}
        </span>
      );
    }

    if (preset === 'typewriter-word') {
      const visibleWords = words.filter(w => currentTime >= w.start).map(w => w.text);
      return <span>{visibleWords.join(' ')}</span>;
    }

    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.35em' }}>
        {words.map((wObj, idx) => {
          const isSpoken = currentTime >= wObj.start && currentTime <= wObj.end;
          const isPast = currentTime > wObj.end;
          const isEmphasized = wObj.emphasized;

          let wordStyle = {
            display: 'inline-block',
            transition: 'all 120ms ease-in-out',
            borderRadius: enablePill ? '6px' : '0',
            padding: enablePill ? '0.1em 0.3em' : '0'
          };

          let wordClass = '';

          if (isEmphasized) {
            wordStyle.fontWeight = '900';
            wordStyle.color = highlightColor;
            wordStyle.transform = 'scale(1.08)';
          }

          if (preset === 'highlight-word' && isSpoken) {
            wordStyle.color = '#111111';
            wordStyle.backgroundColor = highlightColor;
            wordStyle.fontWeight = '700';
          } else if (preset === 'karaoke') {
            if (isSpoken) {
              const wordDur = Math.max(0.05, wObj.end - wObj.start);
              const progress = Math.max(0, Math.min(1, (currentTime - wObj.start) / wordDur));
              const fillPercent = Math.round(progress * 100);
              wordStyle.background = `linear-gradient(90deg, ${highlightColor} ${fillPercent}%, ${styleConfig.textColor || '#FAFAFA'} ${fillPercent}%)`;
              wordStyle.WebkitBackgroundClip = 'text';
              wordStyle.WebkitTextFillColor = 'transparent';
              wordStyle.fontWeight = '700';
            } else if (isPast) {
              wordStyle.color = highlightColor;
            }
          } else if (preset === 'bounce' && isSpoken) {
            wordClass = 'word-bounce';
            wordStyle.color = highlightColor;
          } else if (preset === 'popup-word' && isSpoken) {
            wordClass = 'word-popup';
          } else if (preset === 'slide-up' && isSpoken) {
            wordClass = 'word-slide-up';
          } else if (preset === 'fade-in' && isSpoken) {
            wordClass = 'word-fade-in';
          } else if (preset === 'scale-in' && isSpoken) {
            wordClass = 'word-scale-in';
          } else if (preset === 'pulse' && (isSpoken || isEmphasized)) {
            wordClass = 'word-pulse';
            wordStyle.color = highlightColor;
          }

          return (
            <span key={idx} className={wordClass} style={wordStyle}>
              {wObj.text}
            </span>
          );
        })}
      </span>
    );
  };

  const activeLinesCount = activeSub && activeSub.text ? wrapSubtitleText(activeSub.text, 36).split('\n').length : 0;

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      backgroundColor: '#0B0B0B',
      borderRadius: '16px',
      border: '1px solid var(--border)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '340px',
      maxHeight: '560px',
      boxShadow: 'var(--shadow-subtle)'
    }}>
      {/* Top Preview Controls Bar (Zoom, Safe Area, Box Bounds, Debug, Reset) */}
      {!isAudio && (
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.4rem 0.85rem',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          zIndex: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>Zoom:</span>
            {[
              { label: 'Fit', val: 1.0 },
              { label: '50%', val: 0.5 },
              { label: '75%', val: 0.75 },
              { label: '100%', val: 1.0 }
            ].map(z => (
              <button
                key={z.label}
                type="button"
                className={`btn-secondary ${zoomScale === z.val ? 'active' : ''}`}
                onClick={() => setZoomScale(z.val)}
                style={{ padding: '0.2rem 0.45rem', fontSize: '11px', borderRadius: '4px' }}
              >
                {z.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button
              type="button"
              className={`btn-secondary ${showSafeArea ? 'active' : ''}`}
              onClick={() => setShowSafeArea(!showSafeArea)}
              title="Toggle Action & Title Safe Area Lines"
              style={{ padding: '0.25rem 0.5rem', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Eye size={13} /> Safe Area
            </button>
            <button
              type="button"
              className={`btn-secondary ${showBoxBounds ? 'active' : ''}`}
              onClick={() => setShowBoxBounds(!showBoxBounds)}
              title="Toggle Subtitle Box Bounds Outline"
              style={{ padding: '0.25rem 0.5rem', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Box size={13} /> Box Bounds
            </button>
            <button
              type="button"
              className={`btn-secondary ${showDebugInfo ? 'active' : ''}`}
              onClick={() => setShowDebugInfo(!showDebugInfo)}
              title="Toggle Parity Debug Info Overlay"
              style={{ padding: '0.25rem 0.5rem', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <Bug size={13} /> Debug
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={resetPreviewControls}
              title="Reset Preview Options"
              style={{ padding: '0.25rem', borderRadius: '4px' }}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      )}

      {isAudio ? (
        /* AUDIO ONLY PLAYER DISPLAY */
        <div style={{
          width: '100%',
          height: '340px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          background: 'linear-gradient(180deg, #111111 0%, #0B0B0B 100%)',
          position: 'relative'
        }}>
          <audio
            ref={mediaRef}
            src={videoUrl}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleManualTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            style={{ display: 'none' }}
          />

          {/* Top Audio Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            padding: '0.4rem 0.85rem',
            borderRadius: '20px',
            fontSize: '12px',
            color: 'var(--text-primary)'
          }}>
            <Music size={14} style={{ color: 'var(--accent)' }} /> Audio Track Active
          </div>

          {/* Center Generated Waveform Bars */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            height: '64px',
            width: '100%',
            maxWidth: '380px',
            margin: '1rem 0'
          }}>
            {Array.from({ length: 32 }).map((_, i) => {
              const animDelay = `${(i % 5) * 0.25}s`;
              const animDur = `${0.8 + (i % 3) * 0.3}s`;
              return (
                <div
                  key={i}
                  className="waveform-bar"
                  style={{
                    height: `${20 + ((i * 17) % 44)}px`,
                    animationPlayState: isPlaying ? 'running' : 'paused',
                    animationDelay: animDelay,
                    animationDuration: animDur,
                    background: isPlaying ? 'var(--accent)' : 'var(--border)'
                  }}
                />
              );
            })}
          </div>

          {/* Subtitle Overlay for Audio */}
          {activeSub && activeSub.text && (
            <div style={{
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 10,
              margin: '0.5rem 0',
              width: '90%'
            }}>
              <span
                style={{
                  fontFamily: getFontFamilyStack(),
                  fontSize: `${model.fontPx}px`,
                  fontWeight: styleConfig.fontWeight || '600',
                  color: styleConfig.textColor || '#FAFAFA',
                  backgroundColor: hexToRgba(styleConfig.bgColor || '#000000', styleConfig.bgOpacity ?? 0.6),
                  padding: '0.45rem 1rem',
                  borderRadius: '10px',
                  textShadow: getOutlineShadowStyle(),
                  display: 'inline-block',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.15,
                  maxWidth: '100%',
                  wordBreak: 'break-word'
                }}
              >
                {renderAnimatedSubtitle()}
              </span>
            </div>
          )}

          {/* Bottom Audio Controls */}
          <div style={{
            width: '100%',
            maxWidth: '460px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            padding: '0.5rem 1rem',
            borderRadius: '12px'
          }}>
            <button
              type="button"
              className="btn-primary"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause Audio' : 'Play Audio'}
              style={{ padding: '0.45rem', borderRadius: '50%', width: '36px', height: '36px', justifyContent: 'center' }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <span style={{ fontSize: '12px', fontFamily: 'monospace', minWidth: '40px', color: 'var(--text-secondary)' }}>
              {formatTime(currentTime)}
            </span>

            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              aria-label="Seek audio playback"
              style={{ flex: 1 }}
            />

            <span style={{ fontSize: '12px', fontFamily: 'monospace', minWidth: '40px', color: 'var(--text-secondary)' }}>
              {formatTime(duration)}
            </span>

            <button
              type="button"
              className="btn-secondary"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              style={{ padding: '0.4rem', borderRadius: '6px' }}
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
          </div>
        </div>
      ) : (
        /* STANDARD VIDEO PLAYER DISPLAY - CONSTRAINED RATIO CANVAS BOX */
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            maxHeight: '520px',
            aspectRatio: aspectRatio,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
            overflow: 'hidden',
            transform: `scale(${zoomScale})`,
            transition: 'transform 150ms ease'
          }}
        >
          <video
            ref={mediaRef}
            src={videoUrl}
            controls
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleManualTimeUpdate}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />

          {/* Action Safe (10%) & Title Safe (5%) Guidelines Overlay */}
          {showSafeArea && (
            <div style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 15
            }}>
              {/* Action Safe 10% */}
              <div style={{
                position: 'absolute',
                top: '5%', bottom: '5%', left: '5%', right: '5%',
                border: '1px dashed rgba(245, 158, 11, 0.5)'
              }} />
              {/* Title Safe 10% */}
              <div style={{
                position: 'absolute',
                top: '10%', bottom: '10%', left: '10%', right: '10%',
                border: '1px dashed rgba(59, 130, 246, 0.5)'
              }} />
            </div>
          )}

          {/* Live Debug Info Overlay (Parity Inspector) */}
          {showDebugInfo && (
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: 'rgba(0, 0, 0, 0.85)',
              border: '1px solid var(--accent)',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#FAFAFA',
              zIndex: 25,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>[PARITY DEBUG INSPECTOR]</span>
              <span>Video: {videoBounds.intrinsicW}x{videoBounds.intrinsicH} → PlayRes {videoBounds.intrinsicW}:{videoBounds.intrinsicH}</span>
              <span>Preview H: {videoBounds.height}px</span>
              <span>CSS fontPx: {model.fontPx}px → ASS FontSize: {model.assFontSize}</span>
              <span>CSS marginBottom: {model.bottomMarginPx}px → ASS MarginV: {model.assMarginV}</span>
              <span>CSS marginLR: {model.marginLRPx}px → ASS MarginLR: {model.assMarginLR}</span>
              <span>CSS outline: {model.outlineW}px → ASS Outline: {model.assOutline}</span>
              <span>CSS shadow: {model.shadowB}px → ASS Shadow: {model.assShadow}</span>
              <span>CSS padding: {model.paddingV}px {model.paddingH}px</span>
              <span>Scale: {model.fontScale.toFixed(4)} | Lines: {activeLinesCount}</span>
            </div>
          )}

          {/* Subtitle Overlay — strictly clipped to visible video rectangle. */}
          {activeSub && activeSub.text && (
            <div style={{
              position: 'absolute',
              left: videoBounds.width > 0 ? `${videoBounds.left}px` : '0',
              top: videoBounds.height > 0 ? `${videoBounds.top}px` : '0',
              width: videoBounds.width > 0 ? `${videoBounds.width}px` : '100%',
              height: videoBounds.height > 0 ? `${videoBounds.height}px` : '100%',
              pointerEvents: 'none',
              zIndex: 10,
              overflow: 'hidden'
            }}>
              <SubtitleOverlay
                subtitle={activeSub}
                styleConfig={styleConfig}
                animationConfig={animationConfig}
                currentTime={currentTime}
                targetHeight={videoBounds.height || 540}
                showBoxBounds={showBoxBounds}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
