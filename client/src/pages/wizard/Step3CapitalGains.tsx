import React, { useState } from 'react';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import InputField from '../../components/InputField';
import { EquityGain, PropertyGain, DebtMFGain } from '../../types/tax';

const emptyEquity = (type: EquityGain['type']): EquityGain => ({
  type, shortTermGain: 0, longTermGain: 0, tdsDeducted: 0,
});

const emptyProperty = (): PropertyGain => ({
  saleValue: 0, purchaseValue: 0, yearOfPurchase: 2020, yearOfSale: 2025,
  isResidentialProperty: true, acquisitionBeforeJul2024: false,
  improvementCost: 0, stampDutyRegistration: 0,
});

const Step3CapitalGains: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useTaxStore();
  const cg = formData.capitalGains;
  const [open, setOpen] = useState({ equity: false, usStocks: false, property: false, debtMF: false });
  const toggle = (k: keyof typeof open) => setOpen((s) => ({ ...s, [k]: !s[k] }));

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
