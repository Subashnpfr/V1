'use client';

import React, { useState } from 'react';
import AboutModal from './AboutModal';
import { Info, ExternalLink } from 'lucide-react';

export default function Footer() {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <footer style={{
        marginTop: 'auto',
        padding: '1.5rem 24px',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>
            Built by{' '}
            <a
              href="https://nepalsubash.com.np"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
            >
              Subash Nepal <ExternalLink size={11} />
            </a>
          </span>
          <span>•</span>
          <span>Offline AI captions</span>
          <span>•</span>
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              textDecoration: 'underline'
            }}
          >
            <Info size={12} /> About
          </button>
        </div>
      </footer>
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </>
  );
}
