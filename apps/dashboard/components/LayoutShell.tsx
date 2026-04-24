'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface LayoutShellProps {
  children: React.ReactNode;
}

export const LayoutShell = ({ children }: LayoutShellProps) => {
  return (
    <div className="shell">
      <Sidebar />
      <div className="main">
        <Topbar title="Dashboard" status="Demo workspace" />
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
};
