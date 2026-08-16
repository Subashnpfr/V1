'use client';

import React from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import SubtitleOverlay from './SubtitleOverlay';

export default function AudioCaptionStage({
  mediaRef,
  containerRef,
  videoUrl,
  activeSub,
  styleConfig,
  animationConfig,
  currentTime,
  duration,
  isPlaying,
  isMuted,
  zoomScale,
  showSafeArea,
  showBoxBounds,
  targetHeight,
  onLoadedMetadata,
  onTimeUpdate,
  onPlay,
  onPause,
  onTogglePlay,
  onSeek,
  onToggleMute,
  formatTime
}) {
  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxHeight: '520px',
          aspectRatio: '16 / 9',
          background: '#000000',
          overflow: 'hidden',
          transform: `scale(${zoomScale})`,
          transition: 'transform 150ms ease'
        }}
      >
        <audio
          ref={mediaRef}
          src={videoUrl}
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onPause={onPause}
          style={{ display: 'none' }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.28,
            pointerEvents: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '72px' }}>
            {Array.from({ length: 32 }).map((_, i) => (
              <div
                key={i}
                className="waveform-bar"
                style={{
                  width: 4,
                  height: `${20 + ((i * 17) % 44)}px`,
                  animationPlayState: isPlaying ? 'running' : 'paused',
                  background: isPlaying ? 'var(--accent)' : 'var(--border)'
                }}
              />
            ))}
          </div>
        </div>
        {showSafeArea && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
            <div style={{ position: 'absolute', top: '5%', bottom: '5%', left: '5%', right: '5%', border: '1px dashed rgba(245, 158, 11, 0.5)' }} />
            <div style={{ position: 'absolute', top: '10%', bottom: '10%', left: '10%', right: '10%', border: '1px dashed rgba(59, 130, 246, 0.5)' }} />
          </div>
        )}
        {activeSub && activeSub.text && (
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10,
            overflow: 'hidden'
          }}>
            <SubtitleOverlay
              subtitle={activeSub}
              styleConfig={styleConfig}
              animationConfig={animationConfig}
              currentTime={currentTime}
              targetHeight={targetHeight}
              showBoxBounds={showBoxBounds}
            />
          </div>
        )}
      </div>
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '0.5rem 1rem'
      }}>
        <button
          type="button"
          className="btn-primary"
          onClick={onTogglePlay}
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
          onChange={onSeek}
          aria-label="Seek audio playback"
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: '12px', fontFamily: 'monospace', minWidth: '40px', color: 'var(--text-secondary)' }}>
          {formatTime(duration)}
        </span>
        <button
          type="button"
          className="btn-secondary"
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          style={{ padding: '0.4rem', borderRadius: '6px' }}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
      </div>
    </>
  );
}
