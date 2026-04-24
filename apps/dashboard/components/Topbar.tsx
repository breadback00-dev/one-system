import React from 'react';
import { ThemeToggle } from './ThemeToggle';

interface TopbarProps {
  title: string;
  status?: string;
  date?: string;
}

export const Topbar = ({ title, status, date }: TopbarProps) => {
  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      {date && <div className="topbar-meta">{date}</div>}
      {status && (
        <div className="topbar-badge badge-green">
          <span>{status}</span>
        </div>
      )}
      <ThemeToggle />
    </div>
  );
};
