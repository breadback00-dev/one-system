import React from 'react';

interface ReadinessItem {
  label: string;
  ready: boolean;
  detail: string;
}

interface ReadinessListProps {
  items: ReadinessItem[];
}

export const ReadinessList = ({ items }: ReadinessListProps) => {
  return (
    <div className="readiness-list">
      {items.map((item, index) => (
        <div className="readiness-row" key={index}>
          <div className={`readiness-check ${item.ready ? 'pass' : 'fail'}`}>
            {item.ready ? (
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 5l2 2 4-4" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 2l6 6M8 2L2 8" />
              </svg>
            )}
          </div>
          <div className="readiness-text">
            <div className="readiness-name">{item.label}</div>
            <div className="readiness-detail">{item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
