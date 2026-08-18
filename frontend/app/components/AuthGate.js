'use client';

import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthGate({ children }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div className="auth-loading">
        <p>Checking session…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return children;
}
