'use client';

import React, { useEffect } from 'react';
import { X, Sparkles, Zap, Globe, Keyboard, ExternalLink, Subtitles } from 'lucide-react';

export default function AboutModal({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="card" style={{
        maxWidth: '560px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.75rem',
        position: 'relative',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
      }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Modal"
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          <X size={16} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'var(--accent)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#111111'
          }}>
            <Subtitles size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)' }}>
              V1 Captions Studio
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: '600' }}>
              Created by Subash Nepal · nepalsubash.com.np
            </p>
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
          A creator-grade subtitle editor engineered for high-accuracy Nepali (नेपाली), English, and Hindi video captions, karaoke word highlighting, custom animations, and hardcoded ASS/MP4 video exports.
        </p>

        {/* Key Features List */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
              <Globe size={14} style={{ color: 'var(--accent)' }} /> High Accuracy STT
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Whisper large-v3 for Nepali with VAD filter & word timestamps.
            </p>
          </div>

          <div style={{ background: 'var(--surface-elevated)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: '600', fontSize: '12px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.2rem' }}>
              <Sparkles size={14} style={{ color: 'var(--accent)' }} /> 12 Creator Animations
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Karaoke fill, pop-up, typewriter, bounce, and pulse.
            </p>
          </div>
        </div>

        {/* Keyboard Shortcuts Section */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Keyboard size={14} style={{ color: 'var(--accent)' }} /> Keyboard Shortcuts
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '12px' }}>
            <div><kbd style={{ background: 'var(--surface-elevated)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>Space</kbd> Play / Pause Media</div>
            <div><kbd style={{ background: 'var(--surface-elevated)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>Ctrl + Z</kbd> Undo Edit</div>
            <div><kbd style={{ background: 'var(--surface-elevated)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>Enter</kbd> Split Selected Line</div>
            <div><kbd style={{ background: 'var(--surface-elevated)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>Delete</kbd> Delete Active Subtitle</div>
          </div>
        </div>

        {/* Footer & Link */}
        <div style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '1rem',
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--text-secondary)'
        }}>
          <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
            Created by Subash Nepal ·{' '}
            <a
              href="https://nepalsubash.com.np"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              nepalsubash.com.np <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
