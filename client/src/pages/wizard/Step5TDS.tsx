import React, { useRef, useState } from 'react';
import axios from 'axios';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import InputField from '../../components/InputField';
import { TDSEntry } from '../../types/tax';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

interface ParsedTaxPaid {
  tdsEntries: Array<{ source: string; amount: number; tdsDeducted: number }>;
  advanceTaxQ1: number;
  advanceTaxQ2: number;
  advanceTaxQ3: number;
  advanceTaxQ4: number;
  selfAssessmentTax: number;
  summary: string;
  warnings: string[];
}

const emptyTDS = (): TDSEntry => ({ source: '', amount: 0, tdsDeducted: 0 });
const fmtINR = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN');

const Step5TDS: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useTaxStore();
  const taxPaid = formData.taxPaid;
  const tdsEntries = taxPaid.tdsEntries;

  // ── File upload state ──────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'preview' | 'error'>('idle');
  const [uploadError, setUploadError] = useState('');
  const [parsed, setParsed] = useState<ParsedTaxPaid | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploadStatus('uploading');
    setUploadError('');
    setParsed(null);

    const payload = new FormData();
    payload.append('file', file);

    try {
      const { data } = await axios.post<{ success: boolean; data: ParsedTaxPaid }>(
        `${API_BASE}/api/tds/parse`,
        payload,
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
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const applyParsed = () => {
    if (!parsed) return;

    // Merge TDS entries — accumulate by source
    const newEntries = [...tdsEntries];
    for (const pe of parsed.tdsEntries) {
      if (!pe.tdsDeducted) continue;
      const existing = newEntries.find(
        (e) => e.source.toLowerCase() === pe.source.toLowerCase()
      );
      if (existing) {
        existing.amount += pe.amount;
        existing.tdsDeducted += pe.tdsDeducted;
      } else {
        newEntries.push({ source: pe.source, amount: pe.amount, tdsDeducted: pe.tdsDeducted });
      }
    }

    updateFormData({
      taxPaid: {
        ...taxPaid,
        tdsEntries: newEntries,
        advanceTaxQ1: taxPaid.advanceTaxQ1 + parsed.advanceTaxQ1,
        advanceTaxQ2: taxPaid.advanceTaxQ2 + parsed.advanceTaxQ2,
        advanceTaxQ3: taxPaid.advanceTaxQ3 + parsed.advanceTaxQ3,
        advanceTaxQ4: taxPaid.advanceTaxQ4 + parsed.advanceTaxQ4,
        selfAssessmentTax: taxPaid.selfAssessmentTax + parsed.selfAssessmentTax,
      },
    });

    setParsed(null);
    setUploadStatus('idle');
    setFileName('');
  };

  const patchEntries = (entries: TDSEntry[]) =>
    updateFormData({ taxPaid: { ...taxPaid, tdsEntries: entries } });
  const updateEntry = (idx: number, patch: Partial<TDSEntry>) =>
    patchEntries(tdsEntries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  const removeEntry = (idx: number) => patchEntries(tdsEntries.filter((_, i) => i !== idx));

  const totalTDS = tdsEntries.reduce((s, e) => s + (e.tdsDeducted ?? 0), 0);
  const advanceTotal = taxPaid.advanceTaxQ1 + taxPaid.advanceTaxQ2 + taxPaid.advanceTaxQ3 + taxPaid.advanceTaxQ4;
  const selfAssessmentTax = taxPaid.selfAssessmentTax;
  const totalPaid = totalTDS + advanceTotal + selfAssessmentTax;
  const inrFmt2 = (n: number) => n > 0 ? '₹' + n.toLocaleString('en-IN') : '—';

  return (
    <WizardLayout
      title="TDS & Taxes Already Paid"
      subtitle="Enter taxes already deducted/paid — this reduces your final payable amount."
      onNext={nextStep}
      onPrev={prevStep}
      nextLabel="Calculate Tax →"
    >
      {/* ── Import from Form 26AS / AIS / TDS Certificate ──────────────── */}
      <div className="border-2 border-dashed border-violet-300 rounded-xl mb-6 bg-violet-50 overflow-hidden">
        <div className="px-5 py-4">
          <div className="flex items-start gap-4">
            <div className="text-3xl leading-none">📋</div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800 mb-0.5">Import from Form 26AS / AIS / TDS Certificate</p>
              <p className="text-xs text-gray-500 mb-3">
                Upload a Form 26AS, AIS, Form 16/16A, or any TDS certificate downloaded from the Income Tax portal
                or your bank/broker. Supports Excel (.xlsx), Word (.docx), and PDF (.pdf). Data is merged into the
                fields below.
              </p>
              <label className="inline-flex items-center gap-2 btn-primary cursor-pointer text-sm px-4 py-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 12V4m0 8l-3-3m3 3l3-3" />
                </svg>
                {uploadStatus === 'uploading' ? 'Parsing…' : 'Upload TDS Document'}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.docx,.pdf"
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
            <div className="mt-4 flex items-center gap-2 text-violet-700 text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Reading your TDS document…
            </div>
          )}

          {/* Error */}
          {uploadStatus === 'error' && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Could not parse file:</strong> {uploadError}
              <button type="button" className="ml-3 text-red-500 underline text-xs" onClick={() => setUploadStatus('idle')}>
                Dismiss
              </button>
            </div>
          )}

          {/* Preview */}
          {uploadStatus === 'preview' && parsed && (
            <div className="mt-4 border border-violet-200 rounded-xl bg-white p-4">
              <p className="font-semibold text-gray-800 mb-2 text-sm">Parsed TDS & Tax Payments — Review before applying</p>

              {parsed.warnings.length > 0 && (
                <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                  {parsed.warnings.map((w, i) => <p key={i}>⚠️ {w}</p>)}
                </div>
              )}

              {/* TDS entries */}
              {parsed.tdsEntries.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">TDS Credits</p>
                  <div className="space-y-1">
                    {parsed.tdsEntries.map((e, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                        <span className="font-medium">{e.source}</span>
                        <span>
                          {e.amount > 0 && <>{fmtINR(e.amount)} → </>}
                          TDS {fmtINR(e.tdsDeducted)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Advance tax */}
              {(parsed.advanceTaxQ1 || parsed.advanceTaxQ2 || parsed.advanceTaxQ3 || parsed.advanceTaxQ4) > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Advance Tax</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'Q1 (Jun)', val: parsed.advanceTaxQ1 },
                      { label: 'Q2 (Sep)', val: parsed.advanceTaxQ2 },
                      { label: 'Q3 (Dec)', val: parsed.advanceTaxQ3 },
                      { label: 'Q4 (Mar)', val: parsed.advanceTaxQ4 },
                    ].map(({ label, val }) => val > 0 && (
                      <div key={label} className="text-xs bg-gray-50 px-3 py-1.5 rounded-lg text-center">
                        <div className="text-gray-500">{label}</div>
                        <div className="font-medium text-gray-800">{fmtINR(val)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Self-assessment */}
              {parsed.selfAssessmentTax > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-1 uppercase tracking-wide">Self-Assessment Tax</p>
                  <div className="text-xs bg-gray-50 px-3 py-1.5 rounded-lg">
                    <span className="font-medium">{fmtINR(parsed.selfAssessmentTax)}</span>
                  </div>
                </div>
              )}

              {parsed.tdsEntries.length === 0 && !parsed.advanceTaxQ1 && !parsed.advanceTaxQ2 && !parsed.advanceTaxQ3 && !parsed.advanceTaxQ4 && !parsed.selfAssessmentTax && (
                <p className="text-xs text-gray-500 italic mb-2">No tax payment data detected in the file.</p>
              )}

              <div className="flex gap-3 mt-3">
                <button type="button" className="btn-primary text-sm flex-1" onClick={applyParsed}>
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

      {/* ── TDS Entries ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="section-title">📄 TDS Deducted at Source</h3>
        <p className="text-xs text-gray-500 mb-3">Check Form 26AS / AIS on the Income Tax portal for all TDS credits.</p>
        {tdsEntries.map((entry, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-4 mb-3 relative">
            <button type="button" onClick={() => removeEntry(i)} className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-lg">×</button>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
              <div className="mb-4">
                <label className="input-label">Source</label>
                <input type="text" className="input-field" value={entry.source} onChange={(e) => updateEntry(i, { source: e.target.value })} placeholder="e.g. Employer, Bank FD" />
              </div>
              <InputField label="Amount (₹)" type="number" prefix="₹" value={entry.amount || ''} onChange={(e) => updateEntry(i, { amount: +e.target.value })} />
              <InputField label="TDS Deducted (₹)" type="number" prefix="₹" value={entry.tdsDeducted || ''} onChange={(e) => updateEntry(i, { tdsDeducted: +e.target.value })} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => patchEntries([...tdsEntries, emptyTDS()])} className="btn-secondary text-sm w-full">+ Add TDS Entry</button>
      </div>

      {/* ── Advance Tax (4 quarters) ──────────────────────────────────── */}
      <div className="mb-6">
        <h3 className="section-title">🏦 Advance Tax Paid (Quarterly)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4">
          {(['Q1 (Jun)', 'Q2 (Sep)', 'Q3 (Dec)', 'Q4 (Mar)'] as const).map((label, qi) => {
            const key = `advanceTaxQ${qi + 1}` as keyof typeof taxPaid;
            return (
              <InputField key={qi} label={label} prefix="₹" type="number" value={(taxPaid[key] as number) || ''} onChange={(e) => updateFormData({ taxPaid: { ...taxPaid, [key]: +e.target.value } })} />
            );
          })}
        </div>
      </div>

      <InputField label="Self-Assessment Tax (Challan 280)" prefix="₹" type="number" value={selfAssessmentTax || ''} onChange={(e) => updateFormData({ taxPaid: { ...taxPaid, selfAssessmentTax: +e.target.value } })} hint="Paid before filing ITR" />

      {/* ── Summary ───────────────────────────────────────────────────── */}
      {totalPaid > 0 && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mt-4">
          <h4 className="font-semibold text-green-900 mb-2">Taxes Already Paid Summary</h4>
          <div className="space-y-1 text-sm text-green-800">
            {totalTDS > 0 && <div className="flex justify-between"><span>Total TDS Credit</span><span className="font-medium">{inrFmt2(totalTDS)}</span></div>}
            {advanceTotal > 0 && <div className="flex justify-between"><span>Advance Tax</span><span className="font-medium">{inrFmt2(advanceTotal)}</span></div>}
            {selfAssessmentTax > 0 && <div className="flex justify-between"><span>Self-Assessment Tax</span><span className="font-medium">{inrFmt2(selfAssessmentTax)}</span></div>}
            <div className="flex justify-between font-bold pt-2 border-t border-green-200"><span>Total Paid</span><span>{inrFmt2(totalPaid)}</span></div>
          </div>
        </div>
      )}
    </WizardLayout>
  );
};

export default Step5TDS;
