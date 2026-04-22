import React from 'react';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import InputField from '../../components/InputField';
import { TDSEntry } from '../../types/tax';

const emptyTDS = (): TDSEntry => ({ source: '', amount: 0, tdsDeducted: 0 });

const Step5TDS: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useTaxStore();
  const taxPaid = formData.taxPaid;
  const tdsEntries = taxPaid.tdsEntries;

  const patchEntries = (entries: TDSEntry[]) =>
    updateFormData({ taxPaid: { ...taxPaid, tdsEntries: entries } });
  const updateEntry = (idx: number, patch: Partial<TDSEntry>) =>
    patchEntries(tdsEntries.map((e, i) => (i === idx ? { ...e, ...patch } : e)));
  const removeEntry = (idx: number) => patchEntries(tdsEntries.filter((_, i) => i !== idx));

  const totalTDS = tdsEntries.reduce((s, e) => s + (e.tdsDeducted ?? 0), 0);
  const advanceTotal = taxPaid.advanceTaxQ1 + taxPaid.advanceTaxQ2 + taxPaid.advanceTaxQ3 + taxPaid.advanceTaxQ4;
  const selfAssessmentTax = taxPaid.selfAssessmentTax;
  const totalPaid = totalTDS + advanceTotal + selfAssessmentTax;
  const inrFmt = (n: number) => n > 0 ? '₹' + n.toLocaleString('en-IN') : '—';

  return (
    <WizardLayout
      title="TDS & Taxes Already Paid"
      subtitle="Enter taxes already deducted/paid — this reduces your final payable amount."
      onNext={nextStep}
      onPrev={prevStep}
      nextLabel="Calculate Tax →"
    >
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
            {totalTDS > 0 && <div className="flex justify-between"><span>Total TDS Credit</span><span className="font-medium">{inrFmt(totalTDS)}</span></div>}
            {advanceTotal > 0 && <div className="flex justify-between"><span>Advance Tax</span><span className="font-medium">{inrFmt(advanceTotal)}</span></div>}
            {selfAssessmentTax > 0 && <div className="flex justify-between"><span>Self-Assessment Tax</span><span className="font-medium">{inrFmt(selfAssessmentTax)}</span></div>}
            <div className="flex justify-between font-bold pt-2 border-t border-green-200"><span>Total Paid</span><span>{inrFmt(totalPaid)}</span></div>
          </div>
        </div>
      )}
    </WizardLayout>
  );
};

export default Step5TDS;
