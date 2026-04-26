import React from 'react';
import ProgressBar from './ProgressBar';
import { useTaxStore, TOTAL_STEPS } from '../store/taxStore';

const STEP_LABELS = ['Profile', 'Basic Info', 'Income', 'Cap. Gains', 'Deductions', 'TDS', 'Results'];

interface WizardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onNext?: () => void;
  onPrev?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  hideNav?: boolean;
}

const WizardLayout: React.FC<WizardLayoutProps> = ({
  children,
  title,
  subtitle,
  onNext,
  onPrev,
  nextLabel = 'Continue',
  nextDisabled = false,
  hideNav = false,
}) => {
  const { currentStep, isCalculating } = useTaxStore();

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-6">
          <ProgressBar
            currentStep={currentStep}
            totalSteps={TOTAL_STEPS}
            labels={STEP_LABELS}
          />
        </div>

        {/* Card */}
        <div className="card">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-brand-600 uppercase tracking-wider">
              Step {currentStep + 1} of {TOTAL_STEPS}
            </span>
            <span className="text-xs text-gray-400">FY 2025-26 / AY 2026-27</span>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mb-6">{subtitle}</p>}

          {/* Content */}
          <div className="mt-4">{children}</div>

          {/* Navigation */}
          {!hideNav && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={onPrev}
                disabled={currentStep === 0}
                className="btn-secondary disabled:opacity-40"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={nextDisabled || isCalculating}
                className="btn-primary"
              >
                {isCalculating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Calculating...
                  </span>
                ) : (
                  nextLabel
                )}
              </button>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          For guidance only. Consult a CA for final tax filing. File at{' '}
          <a href="https://www.incometaxindia.gov.in" target="_blank" rel="noopener noreferrer" className="underline">
            incometax.gov.in
          </a>
        </p>
      </div>
    </div>
  );
};

export default WizardLayout;
