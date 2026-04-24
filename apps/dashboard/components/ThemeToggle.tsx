'use client';

import React, { useEffect, useState } from 'react';

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'light' | 'dark';
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  return (
    <button 
      onClick={toggle}
      style={{
        background: 'none',
        border: '1px solid var(--line-strong)',
        borderRadius: 'var(--r-md)',
        padding: '4px 8px',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--muted)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      {theme === 'light' ? '🌙' : '☀️'} {theme === 'light' ? 'Dark' : 'Light'}
    </button>
  );
};
