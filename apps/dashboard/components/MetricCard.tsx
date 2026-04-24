import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  status?: {
    label: string;
    variant: 'green' | 'amber' | 'blue' | 'red' | 'muted';
  };
  onClick?: () => void;
}

export const MetricCard = ({ label, value, subtitle, status, onClick }: MetricCardProps) => {
  return (
    <div className="pulse-cell" onClick={onClick}>
      <div className="pulse-label">{label}</div>
      <div className="pulse-value">{value}</div>
      {subtitle && <div className="pulse-sub">{subtitle}</div>}
      {status && (
        <div className="pulse-status">
          <span className={`pill pill-${status.variant}`}>{status.label}</span>
        </div>
      )}
    </div>
  );
};
