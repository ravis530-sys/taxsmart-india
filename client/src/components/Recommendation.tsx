import React, { useState } from 'react';
import { TaxCalculationResult } from '../types/tax';

interface RecommendationProps {
  result: TaxCalculationResult;
}

const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const Recommendation: React.FC<RecommendationProps> = ({ result }) => {
  const { recommendation, newRegime, oldRegime } = result;
  const isNew = recommendation.preferredRegime === 'new';
  const preferred = isNew ? newRegime : oldRegime;
  const [showTips, setShowTips] = useState(false);

  return (
    <div className="space-y-4">
      {/* Recommendation Banner */}
      <div className={`rounded-2xl p-6 ${isNew ? 'bg-blue-600' : 'bg-amber-500'} text-white`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">{isNew ? '🆕' : '📜'}</span>
          <div>
            <p className="text-sm font-medium opacity-80">Best for you</p>
            <p className="text-2xl font-bold">{isNew ? 'New Tax Regime' : 'Old Tax Regime'}</p>
          </div>
          {recommendation.savings > 0 && (
            <div className="ml-auto text-right">
              <p className="text-xs opacity-80">You save</p>
              <p className="text-2xl font-bold">{inr(recommendation.savings)}</p>
            </div>
          )}
        </div>
        <p className="text-sm opacity-90">{recommendation.reason}</p>
      </div>

      {/* ITR Form */}
      <div className="card border-l-4 border-brand-600">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📝</span>
          <div>
            <p className="font-semibold text-gray-900">File using: {preferred.itrFormRecommended}</p>
            <p className="text-sm text-gray-600 mt-1">{preferred.itrFormReason}</p>
          </div>
        </div>
      </div>

      {/* Detailed Explanation */}
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-3">Why this regime?</h4>
        <ul className="space-y-2">
          {recommendation.detailedExplanation.map((line, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="text-brand-600 mt-0.5">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Tax-Saving Tips */}
      <div className="card">
        <button type="button" onClick={() => setShowTips((v) => !v)} className="w-full flex items-center justify-between font-semibold text-gray-900">
          <span>💡 Tax-Saving Tips ({preferred.taxSavingTips.length})</span>
          <span className="text-brand-600">{showTips ? '▲ Hide' : '▼ Show'}</span>
        </button>
        {showTips && (
          <ul className="mt-4 space-y-2">
            {preferred.taxSavingTips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="font-bold text-green-600">{i + 1}.</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Slab Breakdown */}
      <div className="card">
        <h4 className="font-semibold text-gray-900 mb-3">Slab-wise Tax Breakdown</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500">
                <th className="text-left pb-2">Income Slab</th>
                <th className="text-center pb-2">Rate</th>
                <th className="text-right pb-2">Income in Slab</th>
                <th className="text-right pb-2">Tax</th>
              </tr>
            </thead>
            <tbody>
              {preferred.slabBreakdown.map((row, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-700">{row.slabLabel}</td>
                  <td className="py-2 text-center text-gray-600">{row.rate}%</td>
                  <td className="py-2 text-right text-gray-900">{inr(row.income)}</td>
                  <td className="py-2 text-right font-medium text-gray-900">{inr(row.tax)}</td>
                </tr>
              ))}
              {preferred.slabBreakdown.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-sm text-green-700 bg-green-50 rounded-lg">
                    ✅ Your taxable income is nil — no slab tax applies.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capital Gains Details */}
      {preferred.capitalGainsTax.details.length > 0 && (
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3">Capital Gains Tax Details</h4>
          <ul className="space-y-1">
            {preferred.capitalGainsTax.details.map((d, i) => (
              <li key={i} className="text-sm text-gray-700 flex gap-2">
                <span className="text-amber-500">•</span>{d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Recommendation;
