'use client';

import React from 'react';
import { ThemeProvider } from './components/ThemeProvider';

export default function Providers({ children }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
