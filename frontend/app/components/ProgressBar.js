'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function ProgressBar({ progress = 0, message = 'Processing...' }) {
  const pct = Math.round(Math.min(100, Math.max(0, progress)));
  return (
    <div style={{ marginTop: '1.25rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Loader2 size={16} className="animate-spin" />
          <span>{message}</span>
        </div>
        <strong style={{ color: 'var(--text-primary)' }}>{pct}%</strong>
      </div>
      <div className="progress-track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
