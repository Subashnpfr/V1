'use client';

import React, { useState } from 'react';
import AboutModal from './AboutModal';
import { Info, ExternalLink } from 'lucide-react';

export default function Footer() {
  const [showAbout, setShowAbout] = useState(false);

  return (
    <>
      <footer style={{
        marginTop: '3rem',
        padding: '1.25rem 0',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        opacity: 0.85,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>
            Created by{' '}
            <a
              href="https://nepalsubash.com.np"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--accent)',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
            >
              Subash Nepal <ExternalLink size={11} />
            </a>{' '}
            ·{' '}
            <a
              href="https://nepalsubash.com.np"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
            >
              nepalsubash.com.np
            </a>
          </span>

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
            <Info size={12} /> About Subtitle Studio
          </button>
        </div>
      </footer>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </>
  );
}
