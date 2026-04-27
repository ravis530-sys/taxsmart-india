import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTaxStore } from '../../store/taxStore';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
import TaxComparison from '../../components/TaxComparison';
import Recommendation from '../../components/Recommendation';

const Step6Results: React.FC = () => {
  const { formData, result, setResult, setCalculating, setError, isCalculating, error, prevStep, reset } =
    useTaxStore();
  const [name, setName] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current || result) return;
    hasFetched.current = true;

    const calculate = async () => {
      setCalculating(true);
      setError(null);
      try {
        const { data } = await axios.post(`${API_BASE}/api/calculate`, formData);
        setResult(data.data);
      } catch (err: unknown) {
        const msg =
          axios.isAxiosError(err)
            ? (err.response?.data?.error ?? err.message)
            : 'Unexpected error occurred';
        setError(msg as string);
      } finally {
        setCalculating(false);
      }
    };
    calculate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const downloadPdf = async () => {
    if (!result) return;
    setDownloadingPdf(true);
    try {
      const response = await axios.post(
        `${API_BASE}/api/calculate/report`,
        { taxInput: formData, name: name || 'Taxpayer' },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tax-Report-${formData.assessmentYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('PDF download failed. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isCalculating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-gray-100">
        <div className="card text-center max-w-sm">
          <div className="flex justify-center mb-4">
            <svg className="animate-spin h-10 w-10 text-brand-600" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Calculating your taxes…</h3>
          <p className="text-sm text-gray-500 mt-1">Comparing old vs new regime with all rules</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-gray-100">
        <div className="card text-center max-w-sm">
          <div className="text-5xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-600">Calculation Error</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <div className="mt-4 flex gap-3 justify-center">
            <button className="btn-secondary" onClick={prevStep}>← Back</button>
            <button className="btn-primary" onClick={() => { hasFetched.current = false; setError(null); }}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isSalaried = formData.userType === 'salaried';
  const regimeChoice = formData.regimeChoice; // 'new' | 'old' | undefined (show both)
  const showBoth = !regimeChoice;
  const preferredResult =
    result.recommendation.preferredRegime === 'new' ? result.newRegime : result.oldRegime;

  // Take-home helpers — only for salaried users
  const s = formData.salaryIncome;
  const grossSalary = s
    ? (s.basicSalary ?? 0) + (s.hra ?? 0) + (s.lta ?? 0) +
      (s.specialAllowance ?? 0) + (s.otherAllowances ?? 0)
    : 0;
  const epfDeducted = s?.epfContribution ?? 0;
  const ptDeducted = s?.professionalTax ?? 0;

  const takeHome = (taxLiability: number) => ({
    annual: grossSalary - taxLiability - epfDeducted - ptDeducted,
    monthly: (grossSalary - taxLiability - epfDeducted - ptDeducted) / 12,
  });

  const newTH = takeHome(result.newRegime.totalTaxLiability);
  const oldTH = takeHome(result.oldRegime.totalTaxLiability);
  const preferredTH = result.recommendation.preferredRegime === 'new' ? newTH : oldTH;

  const inr = (n: number) => '₹' + Math.round(Math.abs(n)).toLocaleString('en-IN');

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-gray-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Computation Result</h1>
            <p className="text-sm text-gray-500">FY 2025-26 / AY 2026-27</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary text-sm" onClick={prevStep}>← Edit</button>
            <button className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50" onClick={reset}>Start Over</button>
          </div>
        </div>

        {/* Take-Home Salary (salaried only) */}
        {isSalaried && grossSalary > 0 && (
          <div className="card mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
            <h3 className="font-semibold text-green-900 mb-4">💰 Estimated Take-Home Salary</h3>

            {/* Shared row: Gross, EPF, PT */}
            <div className="grid grid-cols-3 gap-3 mb-5 bg-white rounded-xl p-3 border border-green-100">
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Gross Annual Salary</p>
                <p className="text-base font-bold text-gray-800">{inr(grossSalary)}</p>
              </div>
              <div className="text-center border-x border-gray-100">
                <p className="text-xs text-gray-500 mb-1">EPF (Employee)</p>
                <p className="text-base font-bold text-orange-600">− {inr(epfDeducted)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">Professional Tax</p>
                <p className="text-base font-bold text-orange-600">− {inr(ptDeducted)}</p>
              </div>
            </div>

            {/* Single regime mode */}
            {!showBoth && (
              <div className={`rounded-xl p-4 border-2 ${regimeChoice === 'new' ? 'border-blue-300 bg-blue-50' : 'border-amber-300 bg-amber-50'}`}>
                <p className="text-xs font-semibold mb-3 uppercase tracking-wide ${regimeChoice === 'new' ? 'text-blue-700' : 'text-amber-700'}">
                  {regimeChoice === 'new' ? '🆕 New Regime' : '📜 Old Regime'} — Take-Home
                </p>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Income Tax</p>
                    <p className="text-lg font-bold text-red-600">
                      − {inr(regimeChoice === 'new' ? result.newRegime.totalTaxLiability : result.oldRegime.totalTaxLiability)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-600 mb-0.5">Net Annual Take-Home</p>
                    <p className="text-3xl font-bold text-green-700">
                      {inr(regimeChoice === 'new' ? newTH.annual : oldTH.annual)}
                    </p>
                    <p className="text-sm font-semibold text-green-600">
                      {inr(regimeChoice === 'new' ? newTH.monthly : oldTH.monthly)} / month
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Both regimes side-by-side */}
            {showBoth && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* New Regime */}
                <div className={`rounded-xl p-4 border-2 ${result.recommendation.preferredRegime === 'new' ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-blue-50/50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">🆕 New Regime</p>
                    {result.recommendation.preferredRegime === 'new' && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold">★ Recommended</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Income Tax</p>
                  <p className="text-base font-bold text-red-500 mb-3">− {inr(result.newRegime.totalTaxLiability)}</p>
                  <p className="text-xs text-gray-500">Net Annual Take-Home</p>
                  <p className="text-2xl font-bold text-green-700">{inr(newTH.annual)}</p>
                  <p className="text-sm font-semibold text-green-600 mt-0.5">{inr(newTH.monthly)} / month</p>
                </div>
                {/* Old Regime */}
                <div className={`rounded-xl p-4 border-2 ${result.recommendation.preferredRegime === 'old' ? 'border-amber-500 bg-amber-50' : 'border-amber-200 bg-amber-50/50'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">📜 Old Regime</p>
                    {result.recommendation.preferredRegime === 'old' && (
                      <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-semibold">★ Recommended</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-1">Income Tax</p>
                  <p className="text-base font-bold text-red-500 mb-3">− {inr(result.oldRegime.totalTaxLiability)}</p>
                  <p className="text-xs text-gray-500">Net Annual Take-Home</p>
                  <p className="text-2xl font-bold text-green-700">{inr(oldTH.annual)}</p>
                  <p className="text-sm font-semibold text-green-600 mt-0.5">{inr(oldTH.monthly)} / month</p>
                </div>
              </div>
            )}

            {/* Difference callout when showing both */}
            {showBoth && (
              <div className="mt-3 text-center text-sm font-medium text-gray-700">
                {newTH.annual >= oldTH.annual
                  ? <>New Regime gives you <span className="text-green-700 font-bold">{inr(newTH.annual - oldTH.annual)}</span> more in hand annually ({inr((newTH.annual - oldTH.annual) / 12)} / month)</>
                  : <>Old Regime gives you <span className="text-amber-700 font-bold">{inr(oldTH.annual - newTH.annual)}</span> more in hand annually ({inr((oldTH.annual - newTH.annual) / 12)} / month)</>
                }
              </div>
            )}

            <p className="text-xs text-gray-400 mt-3">
              ⚠️ Indicative only. Actual in-hand may differ based on employer perks, gratuity, bonus, reimbursements, and TDS timing.
            </p>
          </div>
        )}

        {/* Main recommendation */}
        <div className="mb-6">
          <Recommendation result={result} />
        </div>

        {/* Side-by-side comparison */}
        <div className="card mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Full Comparison: New vs Old Regime</h3>
          <TaxComparison
            newRegime={result.newRegime}
            oldRegime={result.oldRegime}
            preferred={result.recommendation.preferredRegime}
          />
        </div>

        {/* PDF Download */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-3">📄 Download Tax Report (PDF)</h3>
          <div className="flex gap-3 items-center flex-wrap">
            <input
              type="text"
              className="input-field max-w-xs"
              placeholder="Your name for the report"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={downloadPdf}
              disabled={downloadingPdf}
            >
              {downloadingPdf ? 'Generating...' : '⬇ Download PDF'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            CA-style report with regime comparison, ITR form guidance, and tax-saving tips.
          </p>
        </div>

        {/* Filing guidance */}
        <div className="card mt-6 bg-blue-50 border border-blue-100">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Next Steps to File ITR</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
            <li>Login to <a href="https://www.incometaxindia.gov.in" className="underline" target="_blank" rel="noopener noreferrer">incometax.gov.in</a></li>
            <li>Go to e-File → File Income Tax Return → Select AY 2026-27</li>
            <li>Choose the recommended form: <strong>{result.recommendation.preferredRegime === 'new' ? result.newRegime.itrFormRecommended : result.oldRegime.itrFormRecommended}</strong></li>
            <li>Verify details from Form 26AS / AIS match your entries</li>
            <li>Submit and e-Verify (Aadhaar OTP / Net Banking)</li>
          </ol>
          <p className="text-xs text-blue-600 mt-3 font-medium">
            ⚠️ This is a guidance tool. Consult a CA for complex cases before filing.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Step6Results;
