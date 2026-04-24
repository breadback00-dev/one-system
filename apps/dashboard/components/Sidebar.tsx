import React from 'react';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';

interface NavItemProps {
  href: string;
  label: string;
  icon?: React.ReactNode;
  dotColor?: 'green' | 'amber' | 'blue';
  count?: number | string;
}

const NavItem = ({ href, label, icon, dotColor, count }: NavItemProps) => {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link href={href} className={`nav-item ${isActive ? 'active' : ''}`}>
      {icon && <span className="nav-icon-wrapper">{icon}</span>}
      {dotColor && <div className={`nav-dot ${dotColor}`}></div>}
      <span className="nav-label">{label}</span>
      {count !== undefined && <span className="nav-item-count">{count}</span>}
    </Link>
  );
};

export const Sidebar = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">One System</div>
        <div className="sidebar-brand-sub">Operator Platform · Demo</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Overview</div>
        <NavItem
          href="/dashboard"
          label="Dashboard"
          icon={
            <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="6" height="6" rx="1.5"/>
              <rect x="9" y="1" width="6" height="6" rx="1.5"/>
              <rect x="1" y="9" width="6" height="6" rx="1.5"/>
              <rect x="9" y="9" width="6" height="6" rx="1.5"/>
            </svg>
          }
        />
      </div>

      <div className="sidebar-section" style={{ flex: 1 }}>
        <div className="sidebar-section-label">Modules</div>
        <NavItem href="/leads" label="Lead Capture" dotColor="green" count={3} />
        <NavItem href="/reactivation" label="Reactivation" dotColor="green" count={7} />
        <NavItem href="/reviews" label="Reviews & Referrals" dotColor="amber" />
        <NavItem href="/ads" label="Paid Ads" dotColor="green" />
        <NavItem href="/sales" label="Sales Enablement" dotColor="blue" />

        <div className="sidebar-section-label" style={{ marginTop: '16px' }}>System</div>
        <NavItem 
          href="/platform" 
          label="Platform Closure" 
          count="M6"
          icon={
            <svg className="nav-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5"/>
              <path d="M8 4.5v4l2.5 1.5"/>
            </svg>
          }
        />
      </div>

      <div className="sidebar-footer">
        <div className="workspace-chip">
          <div className="workspace-avatar">DW</div>
          <div>
            <div className="workspace-name">Demo Workspace</div>
            <div className="workspace-plan">Preview · M6 Active</div>
          </div>
          <UserButton />
        </div>
      </div>
    </aside>
  );
};
