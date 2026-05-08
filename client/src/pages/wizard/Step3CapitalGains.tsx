import React, { useRef, useState } from 'react';
import axios from 'axios';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import InputField from '../../components/InputField';
import { EquityGain, PropertyGain, DebtMFGain } from '../../types/tax';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface ParsedCGResult {
  equityGains: Array<{ type: EquityGain['type']; shortTermGain: number; longTermGain: number; tdsDeducted: number }>;
  debtMFGains: { shortTermGain: number; longTermGain: number };
  bondGains: Array<{ interestIncome: number; capitalGainOnSale: number; isLongTerm: boolean }>;
  summary: string;
  warnings: string[];
}

const emptyEquity = (type: EquityGain['type']): EquityGain => ({
  type, shortTermGain: 0, longTermGain: 0, tdsDeducted: 0,
});

const emptyProperty = (): PropertyGain => ({
  saleValue: 0, purchaseValue: 0, yearOfPurchase: 2020, yearOfSale: 2025,
  isResidentialProperty: true, acquisitionBeforeJul2024: false,
  improvementCost: 0, stampDutyRegistration: 0,
});

const fmtINR = (n: number) =>
  (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN');

const Step3CapitalGains: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useTaxStore();
  const cg = formData.capitalGains;
  const [open, setOpen] = useState({ equity: false, usStocks: false, property: false, debtMF: false });
  const toggle = (k: keyof typeof open) => setOpen((s) => ({ ...s, [k]: !s[k] }));

  // ── File upload state ────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'preview' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [parsed, setParsed] = useState<ParsedCGResult | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadStatus('uploading');
    setUploadError('');
    setParsed(null);

    const formDataPayload = new FormData();
    formDataPayload.append('file', file);

    try {
      const { data } = await axios.post<{ success: boolean; data: ParsedCGResult }>(
        `${API_BASE}/api/capital-gains/parse`,
        formDataPayload,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setParsed(data.data);
      setUploadStatus('preview');
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.error ?? err.message)
        : 'Failed to parse file';
      setUploadError(msg as string);
      setUploadStatus('error');
    } finally {
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyParsed = () => {
    if (!parsed) return;
    const newEquity = [...cg.equityGains];

    for (const eg of parsed.equityGains) {
      if (eg.shortTermGain === 0 && eg.longTermGain === 0) continue;
      // Merge into existing entry of same type or add new
      const existing = newEquity.find((g) => g.type === eg.type);
      if (existing) {
        existing.shortTermGain += eg.shortTermGain;
        existing.longTermGain += eg.longTermGain;
        existing.tdsDeducted += eg.tdsDeducted;
      } else {
        newEquity.push({ ...eg });
      }
    }

    updateFormData({
      capitalGains: {
        ...cg,
        equityGains: newEquity,
        debtMFGains: {
          shortTermGain: cg.debtMFGains.shortTermGain + parsed.debtMFGains.shortTermGain,
          longTermGain: cg.debtMFGains.longTermGain + parsed.debtMFGains.longTermGain,
        },
        bondGains: [
          ...cg.bondGains,
          ...parsed.bondGains.filter((b) => b.capitalGainOnSale !== 0 || b.interestIncome !== 0),
        ],
      },
    });

    setParsed(null);
    setUploadStatus('idle');
    setFileName('');

    // Auto-open relevant sections
    setOpen({ equity: true, usStocks: true, property: false, debtMF: true });
  };

  const patchCG = (patch: Partial<typeof cg>) =>
    updateFormData({ capitalGains: { ...cg, ...patch } });

  const equityGains = cg.equityGains;
  const propertyGains = cg.propertyGains;
  const debtMF = cg.debtMFGains;

  const updateEquity = (idx: number, patch: Partial<EquityGain>) =>
    patchCG({ equityGains: equityGains.map((g, i) => (i === idx ? { ...g, ...patch } : g)) });
  const removeEquity = (idx: number) =>
    patchCG({ equityGains: equityGains.filter((_, i) => i !== idx) });

  const updateProperty = (idx: number, patch: Partial<PropertyGain>) =>
    patchCG({ propertyGains: propertyGains.map((g, i) => (i === idx ? { ...g, ...patch } : g)) });
  const removeProperty = (idx: number) =>
    patchCG({ propertyGains: propertyGains.filter((_, i) => i !== idx) });

  const patchDebtMF = (patch: Partial<DebtMFGain>) =>
    patchCG({ debtMFGains: { ...debtMF, ...patch } });

  return (
    <WizardLayout
      title="Capital Gains"
      subtitle="Enter net gain/loss amounts. Skip sections that don't apply to you."
      onNext={nextStep}
      onPrev={prevStep}
    >
      {/* ── Import from Broker Statement ─────────────────────────────── */}
      <div className="border-2 border-dashed border-indigo-300 rounded-xl mb-6 bg-indigo-50 overflow-hidden">
        <div className="px-5 py-4">
          <div className="flex items-start gap-4">
            <div className="text-3xl leading-none">📁</div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 mb-0.5">Import from Broker Statement</p>
              <p className="text-xs text-gray-500 mb-3">
                Upload an Excel (.xlsx) or Word (.docx) capital gains statement downloaded from your broker —
                Zerodha, Groww, Kuvera, CAMS, Angel One, Upstox, INDmoney, 5paisa and more.
                Data will be merged into the fields below.
              </p>
              <label className="inline-flex items-center gap-2 btn-primary cursor-pointer text-sm px-4 py-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 8l-3-3m3 3l3-3" />
                </svg>
                {uploadStatus === 'uploading' ? 'Parsing…' : 'Upload Statement'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploadStatus === 'uploading'}
                />
              </label>
              {fileName && uploadStatus !== 'idle' && (
                <span className="ml-3 text-xs text-gray-500">{fileName}</span>
              )}
            </div>
          </div>

          {/* Uploading spinner */}
          {uploadStatus === 'uploading' && (
            <div className="mt-4 flex items-center gap-2 text-indigo-700 text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Reading your broker statement…
            </div>
          )}

          {/* Error */}
          {uploadStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Could not parse file:</strong> {uploadError}
              <button
                type="button"
                className="ml-3 text-red-500 underline text-xs"
                onClick={() => setUploadStatus('idle')}
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Preview parsed data */}
          {uploadStatus === 'preview' && parsed && (
            <div className="mt-4 border border-indigo-200 rounded-xl bg-white p-4">
              <p className="font-semibold text-gray-800 mb-2 text-sm">Parsed Capital Gains — Review before applying</p>

              {/* Warnings */}
              {parsed.warnings.length > 0 && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  {parsed.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
                </div>
              )}

              {/* Equity gains preview */}
              {parsed.equityGains.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Equity / MF Gains</p>
                  <div className="space-y-1">
                    {parsed.equityGains.map((eg, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                        <span className="font-medium">
                          {eg.type === 'indian_listed' ? 'Indian Listed Equity' :
                           eg.type === 'equity_mf' ? 'Equity Mutual Fund' :
                           eg.type === 'us_stocks' ? 'US Stocks' : 'Indian Unlisted'}
                        </span>
                        <span>
                          STCG {fmtINR(eg.shortTermGain)} &nbsp;|&nbsp; LTCG {fmtINR(eg.longTermGain)}
                          {eg.tdsDeducted > 0 && <> &nbsp;|&nbsp; TDS {fmtINR(eg.tdsDeducted)}</>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Debt MF preview */}
              {(parsed.debtMFGains.shortTermGain !== 0 || parsed.debtMFGains.longTermGain !== 0) && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Debt MF Gains</p>
                  <div className="flex justify-between text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                    <span className="font-medium">Debt Mutual Fund</span>
                    <span>
                      STCG {fmtINR(parsed.debtMFGains.shortTermGain)} &nbsp;|&nbsp; LTCG {fmtINR(parsed.debtMFGains.longTermGain)}
                    </span>
                  </div>
                </div>
              )}

              {/* Bond gains preview */}
              {parsed.bondGains.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Bond Gains</p>
                  {parsed.bondGains.map((b, i) => (
                    <div key={i} className="flex justify-between text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                      <span className="font-medium">Bond / NCD</span>
                      <span>Capital Gain {fmtINR(b.capitalGainOnSale)} ({b.isLongTerm ? 'LT' : 'ST'})</span>
                    </div>
                  ))}
                </div>
              )}

              {parsed.equityGains.length === 0 && parsed.debtMFGains.shortTermGain === 0 && parsed.debtMFGains.longTermGain === 0 && parsed.bondGains.length === 0 && (
                <p className="text-xs text-gray-500 italic mb-2">No capital gains data detected in the file.</p>
              )}

              <div className="flex gap-3 mt-3">
                <button
                  type="button"
                  className="btn-primary text-sm flex-1"
                  onClick={applyParsed}
                >
                  Apply & Merge into Form
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm"
                  onClick={() => { setParsed(null); setUploadStatus('idle'); setFileName(''); }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Manual entry sections ─────────────────────────────────────── */}
      <p className="text-xs text-gray-500 mb-3">
        Or enter details manually below. Imported data is already merged into these fields.
      </p>

      {/* ── Indian Equity / MF ──────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
        <button type="button" onClick={() => toggle('equity')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 font-medium text-left">
          <span>📈 Indian Stocks &amp; Equity MF</span><span>{open.equity ? '▲' : '▼'}</span>
        </button>
        {open.equity && (
          <div className="p-4 space-y-4">
            <div className="text-xs bg-blue-50 p-3 rounded-lg text-blue-800">
              <strong>Tax:</strong> STCG (≤12 mo) = 20% | LTCG (&gt;12 mo) = 12.5% on gains above ₹1.25 lakh exemption
            </div>
            {equityGains.filter(g => g.type === 'indian_listed' || g.type === 'equity_mf').map((g, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 relative">
                <button type="button" onClick={() => removeEquity(equityGains.indexOf(g))} className="absolute top-3 right-3 text-red-400 text-lg">×</button>
                <div className="mb-2">
                  <label className="input-label">Type</label>
                  <select className="input-field" value={g.type} onChange={(e) => updateEquity(equityGains.indexOf(g), { type: e.target.value as EquityGain['type'] })}>
                    <option value="indian_listed">Indian Listed Stock</option>
                    <option value="equity_mf">Equity Mutual Fund</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-x-4">
                  <InputField label="Short-term Gain (₹)" prefix="₹" type="number" value={g.shortTermGain || ''} onChange={(e) => updateEquity(equityGains.indexOf(g), { shortTermGain: +e.target.value })} hint="Held ≤12 months" />
                  <InputField label="Long-term Gain (₹)" prefix="₹" type="number" value={g.longTermGain || ''} onChange={(e) => updateEquity(equityGains.indexOf(g), { longTermGain: +e.target.value })} hint="Held >12 months" />
                  <InputField label="TDS Deducted" prefix="₹" type="number" value={g.tdsDeducted || ''} onChange={(e) => updateEquity(equityGains.indexOf(g), { tdsDeducted: +e.target.value })} />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => patchCG({ equityGains: [...equityGains, emptyEquity('indian_listed')] })} className="btn-secondary text-sm w-full">+ Add Indian Stock / MF</button>
          </div>
        )}
      </div>

      {/* ── US Stocks ──────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
        <button type="button" onClick={() => toggle('usStocks')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 font-medium text-left">
          <span>🌐 US Stocks (Vested / INDmoney)</span><span>{open.usStocks ? '▲' : '▼'}</span>
        </button>
        {open.usStocks && (
          <div className="p-4 space-y-4">
            <div className="text-xs bg-amber-50 p-3 rounded-lg text-amber-800">
              <strong>Tax:</strong> STCG (≤24 mo) = slab rate | LTCG (&gt;24 mo) = 12.5% without indexation. Convert USD→INR at transaction date rate.
            </div>
            {equityGains.filter(g => g.type === 'us_stocks').map((g) => (
              <div key={equityGains.indexOf(g)} className="border border-gray-100 rounded-xl p-4 relative">
                <button type="button" onClick={() => removeEquity(equityGains.indexOf(g))} className="absolute top-3 right-3 text-red-400 text-lg">×</button>
                <div className="grid grid-cols-2 gap-x-4">
                  <InputField label="Short-term Gain (₹)" prefix="₹" type="number" value={g.shortTermGain || ''} onChange={(e) => updateEquity(equityGains.indexOf(g), { shortTermGain: +e.target.value })} hint="≤24 months, taxed at slab" />
                  <InputField label="Long-term Gain (₹)" prefix="₹" type="number" value={g.longTermGain || ''} onChange={(e) => updateEquity(equityGains.indexOf(g), { longTermGain: +e.target.value })} hint=">24 months, 12.5% tax" />
                </div>
              </div>
            ))}
            <button type="button" onClick={() => patchCG({ equityGains: [...equityGains, emptyEquity('us_stocks')] })} className="btn-secondary text-sm w-full">+ Add US Stock Transaction</button>
          </div>
        )}
      </div>

      {/* ── Property ───────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
        <button type="button" onClick={() => toggle('property')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 font-medium text-left">
          <span>🏠 Property (Land / Building)</span><span>{open.property ? '▲' : '▼'}</span>
        </button>
        {open.property && (
          <div className="p-4 space-y-4">
            <div className="text-xs bg-green-50 p-3 rounded-lg text-green-800">
              <strong>LTCG (&gt;24 months):</strong> Post Jul 23, 2024 = 12.5% without indexation | Pre Jul 23, 2024 = lower of 12.5% or 20% with CII indexation
            </div>
            {propertyGains.map((g, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 relative">
                <button type="button" onClick={() => removeProperty(i)} className="absolute top-3 right-3 text-red-400 text-lg">×</button>
                <div className="grid grid-cols-2 gap-x-4">
                  <InputField label="Sale Value" prefix="₹" type="number" value={g.saleValue || ''} onChange={(e) => updateProperty(i, { saleValue: +e.target.value })} />
                  <InputField label="Purchase Value" prefix="₹" type="number" value={g.purchaseValue || ''} onChange={(e) => updateProperty(i, { purchaseValue: +e.target.value })} />
                  <InputField label="Year of Purchase" type="number" value={g.yearOfPurchase || ''} onChange={(e) => updateProperty(i, { yearOfPurchase: +e.target.value })} />
                  <InputField label="Year of Sale" type="number" value={g.yearOfSale || ''} onChange={(e) => updateProperty(i, { yearOfSale: +e.target.value })} />
                  <InputField label="Improvement Cost" prefix="₹" type="number" value={g.improvementCost || ''} onChange={(e) => updateProperty(i, { improvementCost: +e.target.value })} />
                  <InputField label="Stamp Duty / Registration" prefix="₹" type="number" value={g.stampDutyRegistration || ''} onChange={(e) => updateProperty(i, { stampDutyRegistration: +e.target.value })} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input type="checkbox" id={`pre24-${i}`} checked={g.acquisitionBeforeJul2024} onChange={(e) => updateProperty(i, { acquisitionBeforeJul2024: e.target.checked })} className="h-4 w-4" />
                  <label htmlFor={`pre24-${i}`} className="text-sm text-gray-700">Acquired before Jul 23, 2024 (can choose CII indexation)</label>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => patchCG({ propertyGains: [...propertyGains, emptyProperty()] })} className="btn-secondary text-sm w-full">+ Add Property Transaction</button>
          </div>
        )}
      </div>

      {/* ── Debt MF ─────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl mb-4 overflow-hidden">
        <button type="button" onClick={() => toggle('debtMF')} className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 font-medium text-left">
          <span>📊 Debt Mutual Funds &amp; Bonds</span><span>{open.debtMF ? '▲' : '▼'}</span>
        </button>
        {open.debtMF && (
          <div className="p-4">
            <div className="text-xs bg-gray-50 p-3 rounded-lg text-gray-700 mb-4">
              Post April 1, 2023: All debt MF gains (STCG &amp; LTCG) taxed at your slab rate.
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              <InputField label="Short-term Gain (₹)" prefix="₹" type="number" value={debtMF.shortTermGain || ''} onChange={(e) => patchDebtMF({ shortTermGain: +e.target.value })} />
              <InputField label="Long-term Gain (₹)" prefix="₹" type="number" value={debtMF.longTermGain || ''} onChange={(e) => patchDebtMF({ longTermGain: +e.target.value })} />
            </div>
          </div>
        )}
      </div>
    </WizardLayout>
  );
};

export default Step3CapitalGains;