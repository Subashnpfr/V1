'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AppShell from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register, status } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        confirm_password: confirmPassword,
      });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell compact>
      <div className="auth-page">
        <div className="auth-card">
          <h1>Create account</h1>
          <p className="auth-lead">Your projects, media, and captions stay tied to your account.</p>
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="field-label" htmlFor="name">Name</label>
            <input
              id="name"
              type="text"
              className="input-text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <label className="field-label" htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              className="input-text"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
            <button type="submit" className="btn-primary auth-submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <p className="auth-footer">
            Already have an account? <Link href="/login">Log in</Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
