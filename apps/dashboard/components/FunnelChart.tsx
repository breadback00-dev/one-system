import React from 'react';

interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

interface FunnelChartProps {
  steps: FunnelStep[];
}

export const FunnelChart = ({ steps }: FunnelChartProps) => {
  const max = Math.max(...steps.map(s => s.value), 1);

  return (
    <div className="funnel-container">
      {steps.map((step, idx) => {
        const width = (step.value / max) * 100;
        const next = steps[idx + 1];
        const nextWidth = next ? (next.value / max) * 100 : width;
        
        return (
          <div key={step.label} className="funnel-step-wrapper">
            <div className="funnel-step-meta">
              <span className="funnel-step-label">{step.label}</span>
              <span className="funnel-step-value">{step.value}</span>
            </div>
            <div 
              className="funnel-step-shape"
              style={{
                width: `${width}%`,
                background: step.color,
                clipPath: `polygon(0% 0%, 100% 0%, ${50 + (nextWidth/width)*50}% 100%, ${50 - (nextWidth/width)*50}% 100%)`
              }}
            />
          </div>
        );
      })}
    </div>
  );
};
