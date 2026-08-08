'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
      style={{ padding: '0.45rem 0.65rem', display: 'inline-flex', alignItems: 'center' }}
    >
      {theme === 'dark' ? (
        <Sun size={16} style={{ color: '#fbbf24' }} />
      ) : (
        <Moon size={16} style={{ color: '#4F8CFF' }} />
      )}
    </button>
  );
}
