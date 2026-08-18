'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (status === 'loading' || status === 'authenticated') {
    return (
      <AppShell compact>
        <div className="auth-loading"><p>Loading…</p></div>
      </AppShell>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell compact>
      <div className="auth-page">
        <div className="auth-card">
          <h1>Log in</h1>
          <p className="auth-lead">Sign in to access your projects and captions.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input-text"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <label className="field-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input-text"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Log in'}
            </button>
          </form>
          <p className="auth-footer">
            <Link href="/register">Create account</Link>
          </p>
          <p className="auth-muted">Password reset requires email delivery (not configured yet).</p>
        </div>
      </div>
    </AppShell>
  );
}
