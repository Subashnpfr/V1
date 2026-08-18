'use client';

import React from 'react';
import { ThemeProvider } from './components/ThemeProvider';
import { AuthProvider } from './context/AuthContext';

export default function Providers({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
