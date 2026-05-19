import React, { useMemo } from 'react';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import InputField from '../../components/InputField';
import { BroughtForwardLoss, Deductions80C, OtherDeductions } from '../../types/tax';
import { defaultBroughtForwardLoss } from '../../types/tax';

const CAP_80C = 150000;

const Step4Deductions: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useTaxStore();
  const d80c = formData.deductions80C;
  const other = formData.otherDeductions;
  const bfl = formData.broughtForwardLoss ?? defaultBroughtForwardLoss();

  const patch80C = (patch: Partial<Deductions80C>) =>
    updateFormData({ deductions80C: { ...d80c, ...patch } });
  const patchOther = (patch: Partial<OtherDeductions>) =>
    updateFormData({ otherDeductions: { ...other, ...patch } });
  const patchBFL = (patch: Partial<BroughtForwardLoss>) =>
    updateFormData({ broughtForwardLoss: { ...bfl, ...patch } });

  const total80C = useMemo(() => {
    return Math.min(
      CAP_80C,
      (d80c.ppf ?? 0) + (d80c.elss ?? 0) + (d80c.lic ?? 0) + (d80c.nsc ?? 0) +
      (d80c.homeLoanPrincipal ?? 0) + (d80c.tuitionFees ?? 0) + (d80c.epfEmployee ?? 0) +
      (d80c.sukanyaSamriddhi ?? 0) + (d80c.taxSavingFD ?? 0) +
      (d80c.nps80CCD1 ?? 0) + (d80c.other80C ?? 0)
    );
  }, [d80c]);

  const inrFmt = (n: number) => '₹' + n.toLocaleString('en-IN');

  // Values auto-synced from Step 2
  const syncedEpfVpf = (formData.salaryIncome?.epfContribution ?? 0) + (formData.salaryIncome?.vpfContribution ?? 0);
  const syncedNpsEmployer = formData.otherDeductions?.npsEmployerContribution ?? 0;
  const isSalaried = formData.userType === 'salaried';

  return (
    <WizardLayout
      title="Deductions & Exemptions"
      subtitle="Only applicable in Old Regime. Fill as much as possible to compare regimes accurately."
      onNext={nextStep}
      onPrev={prevStep}
    >
      {/* ── Section 80C ──────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-title mb-0">📋 Section 80C Investments</h3>
          <span className={`badge-${total80C >= CAP_80C ? 'green' : 'new'} text-sm`}>
            {inrFmt(total80C)} / {inrFmt(CAP_80C)}
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
          <div className="bg-brand-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, (total80C / CAP_80C) * 100)}%` }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {/* EPF + VPF — auto-synced from Step 2 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">EPF + VPF Employee Contribution</label>
              {isSalaried && syncedEpfVpf > 0 && (
                <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full">
                  ↩ Synced from Step 2
                </span>
              )}
            </div>
            <InputField label="" prefix="₹" type="number"
              value={d80c.epfEmployee || ''}
              onChange={(e) => patch80C({ epfEmployee: +e.target.value })}
              hint={isSalaried && syncedEpfVpf > 0 ? `Auto-filled: EPF + VPF = ${inrFmt(syncedEpfVpf)}` : 'Employee PF contribution (12% of basic + VPF)'}
            />
          </div>
          <InputField label="PPF" prefix="₹" type="number" value={d80c.ppf || ''} onChange={(e) => patch80C({ ppf: +e.target.value })} />
          <InputField label="ELSS / Tax-saving MF" prefix="₹" type="number" value={d80c.elss || ''} onChange={(e) => patch80C({ elss: +e.target.value })} hint="Min 3-year lock-in" />
          <InputField label="Life Insurance Premium (LIC)" prefix="₹" type="number" value={d80c.lic || ''} onChange={(e) => patch80C({ lic: +e.target.value })} />
          <InputField label="NSC" prefix="₹" type="number" value={d80c.nsc || ''} onChange={(e) => patch80C({ nsc: +e.target.value })} />
          <InputField label="Home Loan Principal" prefix="₹" type="number" value={d80c.homeLoanPrincipal || ''} onChange={(e) => patch80C({ homeLoanPrincipal: +e.target.value })} />
          <InputField label="Children Tuition Fees (max 2)" prefix="₹" type="number" value={d80c.tuitionFees || ''} onChange={(e) => patch80C({ tuitionFees: +e.target.value })} />
          <InputField label="Sukanya Samriddhi Yojana" prefix="₹" type="number" value={d80c.sukanyaSamriddhi || ''} onChange={(e) => patch80C({ sukanyaSamriddhi: +e.target.value })} />
          <InputField label="5-Year Tax-saving FD" prefix="₹" type="number" value={d80c.taxSavingFD || ''} onChange={(e) => patch80C({ taxSavingFD: +e.target.value })} />
          <InputField label="NPS 80CCD(1) – part of 80C" prefix="₹" type="number" value={d80c.nps80CCD1 || ''} onChange={(e) => patch80C({ nps80CCD1: +e.target.value })} />
          <InputField label="Others (80C)" prefix="₹" type="number" value={d80c.other80C || ''} onChange={(e) => patch80C({ other80C: +e.target.value })} />
        </div>
        {total80C >= CAP_80C && (
          <p className="text-xs text-green-700 bg-green-50 p-2 rounded-lg">✅ 80C limit of ₹1.5 lakh fully utilized!</p>
        )}
      </div>

      {/* ── Other Deductions ─────────────────────────────────────────── */}
      <div>
        <h3 className="section-title">🏥 Other Deductions (Old Regime)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <InputField label="NPS 80CCD(1B) – extra ₹50K" prefix="₹" type="number" value={other.nps80CCD1B || ''} onChange={(e) => patchOther({ nps80CCD1B: Math.min(50000, +e.target.value) })} hint="Over &amp; above 80C — max ₹50,000" />
          {/* Employer NPS — auto-synced from Step 2 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">Employer NPS 80CCD(2)</label>
              {isSalaried && syncedNpsEmployer > 0 && (
                <span className="text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                  ↩ Synced from Step 2
                </span>
              )}
            </div>
            <InputField label="" prefix="₹" type="number"
              value={other.npsEmployerContribution || ''}
              onChange={(e) => patchOther({ npsEmployerContribution: +e.target.value })}
              hint={isSalaried && syncedNpsEmployer > 0 ? `Auto-filled: ${inrFmt(syncedNpsEmployer)} — Allowed in both regimes` : 'Available in new regime too'}
            />
          </div>
          {/* Health Insurance Self — auto-synced from Step 2 if company insurance */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">Health Insurance – Self &amp; Family</label>
              {isSalaried && formData.salaryIncome?.companyHealthInsuranceOptedIn && (formData.salaryIncome?.companyHealthInsurance ?? 0) > 0 && (
                <span className="text-xs text-rose-600 font-medium bg-rose-100 px-2 py-0.5 rounded-full">
                  ↩ Synced from Step 2
                </span>
              )}
            </div>
            <InputField label="" prefix="₹" type="number"
              value={other.healthInsuranceSelf || ''}
              onChange={(e) => patchOther({ healthInsuranceSelf: +e.target.value })}
              hint={
                isSalaried && formData.salaryIncome?.companyHealthInsuranceOptedIn && (formData.salaryIncome?.companyHealthInsurance ?? 0) > 0
                  ? `Auto-filled: ₹${(formData.salaryIncome.companyHealthInsurance! * 12).toLocaleString('en-IN')}/yr (₹${formData.salaryIncome.companyHealthInsurance!.toLocaleString('en-IN')}/mo × 12) — 80D max ₹25K`
                  : '80D – max ₹25K (₹50K if senior citizen)'
              }
            />
          </div>
          {/* Health Insurance Parents — auto-synced from Step 2 if parents insurance */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="input-label mb-0">Health Insurance – Parents</label>
              {isSalaried && formData.salaryIncome?.parentsInsuranceOptedIn && (formData.salaryIncome?.parentsInsurancePremium ?? 0) > 0 && (
                <span className="text-xs text-rose-600 font-medium bg-rose-100 px-2 py-0.5 rounded-full">
                  ↩ Synced from Step 2
                </span>
              )}
            </div>
            <InputField label="" prefix="₹" type="number"
              value={other.healthInsuranceParents || ''}
              onChange={(e) => patchOther({ healthInsuranceParents: +e.target.value })}
              hint={
                isSalaried && formData.salaryIncome?.parentsInsuranceOptedIn && (formData.salaryIncome?.parentsInsurancePremium ?? 0) > 0
                  ? `Auto-filled: ₹${(formData.salaryIncome.parentsInsurancePremium! * 12).toLocaleString('en-IN')}/yr (₹${formData.salaryIncome.parentsInsurancePremium!.toLocaleString('en-IN')}/mo × 12) — extra 80D`
                  : 'Extra ₹25K/₹50K for parents under 80D'
              }
            />
          </div>
          <InputField label="Preventive Health Check-up" prefix="₹" type="number" value={other.preventiveHealthCheckup || ''} onChange={(e) => patchOther({ preventiveHealthCheckup: +e.target.value })} hint="Within 80D limit, max ₹5,000" />
          <InputField label="Home Loan Interest (Section 24)" prefix="₹" type="number" value={other.homeLoanInterest || ''} onChange={(e) => patchOther({ homeLoanInterest: +e.target.value })} hint="Max ₹2 lakh for self-occupied" />
          <InputField label="Education Loan Interest (80E)" prefix="₹" type="number" value={other.educationLoanInterest || ''} onChange={(e) => patchOther({ educationLoanInterest: +e.target.value })} hint="No limit, for 8 years" />
          <InputField label="Donations – 50% deductible (80G)" prefix="₹" type="number" value={other.donations50Percent || ''} onChange={(e) => patchOther({ donations50Percent: +e.target.value })} />
          <InputField label="Donations – 100% deductible (80G)" prefix="₹" type="number" value={other.donations100Percent || ''} onChange={(e) => patchOther({ donations100Percent: +e.target.value })} hint="PM CARES, etc." />
          <InputField label="Savings Interest Deduction (80TTA/TTB)" prefix="₹" type="number" value={other.savingsInterestDeduction || ''} onChange={(e) => patchOther({ savingsInterestDeduction: +e.target.value })} hint="Max ₹10K (₹50K for senior)" />
        </div>

        {/* ── New Regime Allowed Deductions ─────────────────────────── */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-4">
          <h4 className="text-sm font-semibold text-green-900 mb-3">✅ Also Allowed in New Regime</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <InputField label="Agniveer Corpus Fund [80CCH(2)]" prefix="₹" type="number" value={other.agniveer80CCH2 || ''} onChange={(e) => patchOther({ agniveer80CCH2: +e.target.value })} hint="Employer contribution to Agniveer fund" />
            <InputField label="New Employment Deduction [80JJAA]" prefix="₹" type="number" value={other.newEmployment80JJAA || ''} onChange={(e) => patchOther({ newEmployment80JJAA: +e.target.value })} hint="30% of additional employee cost (eligible amount)" />
            <InputField label="IFSC Unit Deduction [80LA]" prefix="₹" type="number" value={other.ifscUnit80LA || ''} onChange={(e) => patchOther({ ifscUnit80LA: +e.target.value })} hint="For units in International Financial Services Centre" />
          </div>
        </div>

        <div className="mt-2">
          <div className="flex items-center gap-3">
            <input type="checkbox" id="parentsAreSenior" className="h-4 w-4 rounded border-gray-300" checked={other.parentsSeniorCitizen} onChange={(e) => patchOther({ parentsSeniorCitizen: e.target.checked })} />
            <label htmlFor="parentsAreSenior" className="text-sm text-gray-700">Parents are Senior Citizens (60+) — higher 80D limit</label>
          </div>
        </div>
      </div>

      {/* ── Brought-Forward Losses ───────────────────────────────────── */}
      <div className="mt-6">
        <h3 className="section-title">📉 Brought-Forward Losses (from prior years)</h3>
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-xs text-amber-800">
          <strong>New Regime restriction (Sec 115BAC(2)(ii)):</strong> Losses carried forward from
          years when disallowed deductions were claimed cannot be set off in the New Regime.
          Capital losses (STCL/LTCL) can still be set off against capital gains in both regimes.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <InputField label="House Property Loss b/f" prefix="₹" type="number" value={bfl.housePropertyLoss || ''} onChange={(e) => patchBFL({ housePropertyLoss: +e.target.value })} hint="Old Regime only – capped at ₹2L set-off/year" />
          <InputField label="Business Loss b/f" prefix="₹" type="number" value={bfl.businessLoss || ''} onChange={(e) => patchBFL({ businessLoss: +e.target.value })} hint="Old Regime only" />
          <InputField label="Speculative Business Loss b/f" prefix="₹" type="number" value={bfl.speculativeLoss || ''} onChange={(e) => patchBFL({ speculativeLoss: +e.target.value })} hint="Old Regime only" />
          <InputField label="Short-Term Capital Loss b/f" prefix="₹" type="number" value={bfl.capitalLossShortTerm || ''} onChange={(e) => patchBFL({ capitalLossShortTerm: +e.target.value })} hint="Can offset STCG + LTCG in both regimes" />
          <InputField label="Long-Term Capital Loss b/f" prefix="₹" type="number" value={bfl.capitalLossLongTerm || ''} onChange={(e) => patchBFL({ capitalLossLongTerm: +e.target.value })} hint="Can offset LTCG only in both regimes" />
          <InputField label="Other Sources Loss b/f" prefix="₹" type="number" value={bfl.otherSourcesLoss || ''} onChange={(e) => patchBFL({ otherSourcesLoss: +e.target.value })} hint="Old Regime only" />
        </div>
      </div>
    </WizardLayout>
  );
};

export default Step4Deductions;
