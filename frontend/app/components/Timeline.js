'use client';

import React, { useRef } from 'react';

export default function Timeline({
  duration = 60,
  currentTime = 0,
  subtitles = [],
  activeSubtitleId,
  onSeek
}) {
  const timelineRef = useRef(null);
  const maxTime = Math.max(duration || 1, 1);

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !onSeek) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const seekTime = percentage * maxTime;
    onSeek(seekTime);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  return (
    <div className="card-elevated" style={{ padding: '0.85rem 1.25rem', margin: '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '12px', fontWeight: '500', color: 'var(--text-secondary)' }}>
        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Timeline</span>
        <span>
          <strong style={{ color: 'var(--accent)' }}>{formatTime(currentTime)}</strong> / {formatTime(maxTime)}
        </span>
      </div>

      {/* Timeline Track */}
      <div
        ref={timelineRef}
        onClick={handleTimelineClick}
        style={{
          position: 'relative',
          height: '42px',
          backgroundColor: 'var(--bg-main)',
          borderRadius: '12px',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          overflow: 'hidden'
        }}
      >
        {/* Subtitle Blocks */}
        {subtitles.map((sub) => {
          const leftPercent = (sub.start / maxTime) * 100;
          const widthPercent = Math.max(0.6, ((sub.end - sub.start) / maxTime) * 100);
          const isActive = sub.id === activeSubtitleId;

          return (
            <div
              key={sub.id}
              style={{
                position: 'absolute',
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                height: '100%',
                backgroundColor: isActive ? 'var(--accent)' : 'var(--surface)',
                borderLeft: isActive ? '2px solid #ffffff' : '1px solid var(--border)',
                borderRight: isActive ? '2px solid #ffffff' : '1px solid var(--border)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                fontSize: '11px',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? '#ffffff' : '#A8B0BD',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                transition: 'all 150ms ease-in-out',
                zIndex: isActive ? 10 : 2
              }}
              title={`#${sub.id} (${sub.start}s - ${sub.end}s): ${sub.text}`}
            >
              {sub.text}
            </div>
          );
        })}

        {/* Playhead Marker */}
        <div
          style={{
            position: 'absolute',
            left: `${(currentTime / maxTime) * 100}%`,
            top: 0,
            bottom: 0,
            width: '2px',
            backgroundColor: '#ef4444',
            zIndex: 30,
            pointerEvents: 'none',
            boxShadow: '0 0 6px rgba(239, 68, 68, 0.9)'
          }}
        />
      </div>
    </div>
  );
}
