import React from 'react';

interface CardProps {
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children: React.ReactNode;
}

export const Card = ({ title, action, children }: CardProps) => {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title">{title}</div>
        {action && (
          <div className="card-action" onClick={action.onClick}>
            {action.label}
          </div>
        )}
      </div>
      <div className="card-body">
        {children}
      </div>
    </div>
  );
};
