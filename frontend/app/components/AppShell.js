'use client';

import React from 'react';
import Link from 'next/link';
import { Subtitles, Shield, User, LogOut } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';
import { useAuth } from '../context/AuthContext';

export default function AppShell({ children, compact = false, actions = null }) {
  const { status, user, logout } = useAuth();
  const authenticated = status === 'authenticated';

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
            {authenticated && (
              <>
                <Link href="/account" className="nav-link">
                  <User size={14} /> {user?.name || 'Account'}
                </Link>
                <button type="button" className="nav-link nav-link-btn" onClick={() => logout()}>
                  <LogOut size={14} /> Logout
                </button>
              </>
            )}
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
