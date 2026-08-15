'use client';

import React from 'react';
import Link from 'next/link';
import { Subtitles, Shield } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';

export default function AppShell({ children, compact = false, actions = null }) {
  return (
    <div className="app-shell">
      <header className="app-nav">
        <div className="app-nav-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <Subtitles size={18} />
            </span>
            <span className="brand-copy">
              <span className="brand-name">V1 Captions</span>
              <span className="brand-sub">Studio</span>
            </span>
          </Link>

          <div className="nav-meta">
            <span className="pill">
              <Shield size={12} /> Offline-first
            </span>
            {actions}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className={compact ? 'app-main app-main-compact' : 'app-main'}>
        {children}
      </main>

      {!compact && <Footer />}
    </div>
  );
}
