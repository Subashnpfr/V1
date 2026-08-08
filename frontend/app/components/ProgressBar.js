'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

export default function ProgressBar({ progress = 0, message = 'Processing...' }) {
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: '500'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8' }}>
          <Loader2 size={16} style={{ animation: 'spin 1.5s linear infinite' }} />
          <span>{message}</span>
        </div>
        <span style={{ color: '#60a5fa', fontWeight: '600' }}>{Math.round(progress)}%</span>
      </div>

      <div style={{
        width: '100%',
        height: '10px',
        backgroundColor: '#0f172a',
        borderRadius: '5px',
        overflow: 'hidden',
        border: '1px solid #334155'
      }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #2563eb, #3b82f6)',
            borderRadius: '5px',
            transition: 'width 0.3s ease-in-out'
          }}
        />
      </div>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
