'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

interface LayoutShellProps {
  children: React.ReactNode;
  workspaceName: string;
  workspacePlan: string;
  statusLabel: string;
}

export const LayoutShell = ({
  children,
  workspaceName,
  workspacePlan,
  statusLabel,
}: LayoutShellProps) => {
  return (
    <div className="shell">
      <Sidebar workspaceName={workspaceName} workspacePlan={workspacePlan} />
      <div className="main">
        <Topbar title="Dashboard" status={statusLabel} />
        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
};
