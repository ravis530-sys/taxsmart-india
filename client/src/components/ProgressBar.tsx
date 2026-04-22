import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, totalSteps, labels }) => {
  const pct = Math.round((currentStep / (totalSteps - 1)) * 100);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1 text-xs text-gray-500">
        {labels ? (
          labels.map((label, i) => (
            <span
              key={i}
              className={
                i <= currentStep ? 'text-brand-600 font-medium' : 'text-gray-400'
              }
            >
              {label}
            </span>
          ))
        ) : (
          <span>{pct}% Complete</span>
        )}
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-600 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
