import React, { useState } from 'react';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import InputField from '../../components/InputField';
import { SalaryIncome, BusinessIncome, OtherIncome } from '../../types/tax';

const num = (v: unknown) => (v as number) ?? 0;
const inrFmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');

const Step2Income: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useTaxStore();
  const [guideOpen, setGuideOpen] = useState(false);
  const userType = formData.userType ?? 'salaried';
  const salary = formData.salaryIncome ?? ({} as SalaryIncome);
  const biz = formData.businessIncome ?? ({} as BusinessIncome);
  const other = formData.otherIncome;

  const patchSalary = (patch: Partial<SalaryIncome>) =>
    updateFormData({ salaryIncome: { ...salary, ...patch } });
  const patchBiz = (patch: Partial<BusinessIncome>) =>
    updateFormData({ businessIncome: { ...biz, ...patch } });

  const basicSalary = num(salary.basicSalary);
  const vpfPercent = num(salary.vpfPercent) || 0;
  const npsEmployerPercent = (salary.npsEmployerPercent as number) || 10;

  // ── Auto-calc helpers (called from onChange, not useEffect) ──────
  // When basic salary changes: recalculate EPF (if auto-mode), VPF, NPS employer
  const handleBasicSalaryChange = (newBasic: number) => {
    const currentEpf = num(salary.epfContribution);
    const prevBasic = basicSalary;
    // Keep EPF "auto" only if it still equals 12% of the previous basic (i.e. not manually overridden)
    const isEpfAuto = prevBasic === 0 || currentEpf === Math.round(prevBasic * 0.12);
    const newEpf = isEpfAuto ? Math.round(newBasic * 0.12) : currentEpf;
    const newVpf = Math.round(newBasic * vpfPercent / 100);
    const newNps = Math.round(newBasic * npsEmployerPercent / 100);
    const newHealthSelf = salary.companyHealthInsuranceOptedIn
      ? num(salary.companyHealthInsurance) : formData.otherDeductions!.healthInsuranceSelf;
    const newHealthParents = salary.parentsInsuranceOptedIn
      ? num(salary.parentsInsurancePremium) : formData.otherDeductions!.healthInsuranceParents;
    updateFormData({
      salaryIncome: { ...salary, basicSalary: newBasic, epfContribution: newEpf, vpfContribution: newVpf },
      deductions80C: { ...formData.deductions80C, epfEmployee: newEpf + newVpf },
      otherDeductions: {
        ...formData.otherDeductions!,
        npsEmployerContribution: newNps,
        healthInsuranceSelf: newHealthSelf,
        healthInsuranceParents: newHealthParents,
      },
    });
  };

  const handleEpfChange = (newEpf: number) => {
    const vpf = num(salary.vpfContribution);
    updateFormData({
      salaryIncome: { ...salary, epfContribution: newEpf },
      deductions80C: { ...formData.deductions80C, epfEmployee: newEpf + vpf },
    });
  };

  const handleVpfPercentChange = (pct: number) => {
    const newVpf = Math.round(basicSalary * pct / 100);
    const epf = num(salary.epfContribution);
    updateFormData({
      salaryIncome: { ...salary, vpfPercent: pct, vpfContribution: newVpf },
      deductions80C: { ...formData.deductions80C, epfEmployee: epf + newVpf },
    });
  };

  const handleVpfAmountChange = (newVpf: number) => {
    const epf = num(salary.epfContribution);
    updateFormData({
      salaryIncome: { ...salary, vpfContribution: newVpf, vpfPercent: 0 },
      deductions80C: { ...formData.deductions80C, epfEmployee: epf + newVpf },
    });
  };

  const handleNpsPercentChange = (pct: number) => {
    const newNps = Math.round(basicSalary * pct / 100);
    updateFormData({
      salaryIncome: { ...salary, npsEmployerPercent: pct },
      otherDeductions: { ...formData.otherDeductions!, npsEmployerContribution: newNps },
    });
  };

  const handleCompanyInsuranceToggle = (checked: boolean) => {
    const monthly = checked ? num(salary.companyHealthInsurance) : 0;
    updateFormData({
      salaryIncome: { ...salary, companyHealthInsuranceOptedIn: checked },
      // 80D deduction = annual amount
      otherDeductions: { ...formData.otherDeductions!, healthInsuranceSelf: monthly * 12 },
    });
  };

  const handleCompanyInsuranceAmount = (monthly: number) => {
    updateFormData({
      salaryIncome: { ...salary, companyHealthInsurance: monthly },
      otherDeductions: { ...formData.otherDeductions!, healthInsuranceSelf: monthly * 12 },
    });
  };

  const handleParentsInsuranceToggle = (checked: boolean) => {
    const monthly = checked ? num(salary.parentsInsurancePremium) : 0;
    updateFormData({
      salaryIncome: { ...salary, parentsInsuranceOptedIn: checked },
      otherDeductions: { ...formData.otherDeductions!, healthInsuranceParents: monthly * 12 },
    });
  };

  const handleParentsInsuranceAmount = (monthly: number) => {
    updateFormData({
      salaryIncome: { ...salary, parentsInsurancePremium: monthly },
      otherDeductions: { ...formData.otherDeductions!, healthInsuranceParents: monthly * 12 },
    });
  };
  const patchOther = (patch: Partial<OtherIncome>) =>
    updateFormData({ otherIncome: { ...other, ...patch } });

  const isSalaried = userType === 'salaried';
  const isBiz = userType === 'business';
  const isFreelancer = userType === 'freelancer' || userType === 'self_employed';


  return (
    <WizardLayout
      title="Income Details"
      subtitle="Enter annual amounts in ₹. Leave blank if not applicable."
      onNext={nextStep}
      onPrev={prevStep}
    >
      {/* ── Salary Income ──────────────────────────────────────────── */}
      {isSalaried && (
        <section>
          <h3 className="section-title">💼 Salary Income</h3>

          {/* ── Form 16 Guidance Card ──────────────────────────────── */}
          <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50">
            {/* Checkbox row */}
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                checked={formData.hasForm16 ?? false}
                onChange={(e) => updateFormData({ hasForm16: e.target.checked })}
              />
              <span className="text-sm font-semibold text-blue-900">
                I have Form 16 from my employer
              </span>
              <span className="ml-auto text-xs text-blue-500 font-medium">
                {formData.hasForm16 ? '✓ noted for your ITR report' : ''}
              </span>
            </label>

            {/* Guidance toggle */}
            <div className="border-t border-blue-100">
              <button
                type="button"
                onClick={() => setGuideOpen((o) => !o)}
                className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <span>📄 How to use Form 16 to fill this form</span>
                <span>{guideOpen ? '▲ Hide' : '▼ Show'}</span>
              </button>

              {guideOpen && (
                <div className="px-4 pb-4 pt-1 text-xs text-blue-900 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                      <p className="font-semibold text-blue-800 mb-1">Part B — Salary Breakdown</p>
                      <ul className="space-y-1 text-blue-700">
                        <li>• <b>Basic Salary</b> → look for "Basic Pay" or "Basic Salary" row</li>
                        <li>• <b>HRA Received</b> → "House Rent Allowance" component (not the exempt portion)</li>
                        <li>• <b>LTA</b> → "Leave Travel Allowance / Concession"</li>
                        <li>• <b>Special Allowance</b> → "Special / Performance Allowance"</li>
                        <li>• <b>Professional Tax</b> → Sec 16(iii) deduction row</li>
                        <li>• <b>EPF Employee</b> → "PF / Provident Fund" deduction</li>
                      </ul>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-blue-100">
                      <p className="font-semibold text-blue-800 mb-1">Part B — Key Summary Figures</p>
                      <ul className="space-y-1 text-blue-700">
                        <li>• <b>Gross Salary</b> → "Salary as per Sec 17(1)" — use this to cross-check your total</li>
                        <li>• <b>Income chargeable under Salaries</b> → your <em>taxable salary</em> after standard deduction</li>
                        <li>• Enter each allowance separately above for the most accurate calculation</li>
                      </ul>
                      <p className="font-semibold text-blue-800 mt-2 mb-1">Part A — TDS</p>
                      <ul className="space-y-1 text-blue-700">
                        <li>• <b>Total TDS Deducted</b> → enter in Step 5 (TDS &amp; Tax Paid) under "TDS on Salary"</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-blue-500 italic">
                    Tip: Part A is TRACES-generated; Part B is issued by your employer and shows the full salary &amp; deduction split.
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* ── End Form 16 Guidance Card ──────────────────────────── */}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <InputField label="Basic Salary" type="number" prefix="₹" value={num(salary.basicSalary) || ''} onChange={(e) => handleBasicSalaryChange(+e.target.value)} hint="Annual basic from salary slip" />
            <InputField label="HRA Received" type="number" prefix="₹" value={num(salary.hra) || ''} onChange={(e) => patchSalary({ hra: +e.target.value })} hint="House Rent Allowance (annual)" />
            <InputField label="LTA" type="number" prefix="₹" value={num(salary.lta) || ''} onChange={(e) => patchSalary({ lta: +e.target.value })} hint="Leave Travel Allowance" />
            <InputField label="Special Allowance" type="number" prefix="₹" value={num(salary.specialAllowance) || ''} onChange={(e) => patchSalary({ specialAllowance: +e.target.value })} />
            <InputField label="Other Allowances" type="number" prefix="₹" value={num(salary.otherAllowances) || ''} onChange={(e) => patchSalary({ otherAllowances: +e.target.value })} />
          </div>

          {/* HRA city type + rent paid */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-amber-900 mb-2">HRA Exemption (Old Regime)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <InputField label="Monthly Rent Paid" type="number" prefix="₹" value={num(salary.rentPaidMonthly) || ''} onChange={(e) => patchSalary({ rentPaidMonthly: +e.target.value })} />
              <div className="mb-4">
                <label className="input-label">City Type</label>
                <select className="input-field" value={salary.cityType ?? 'non_metro'} onChange={(e) => patchSalary({ cityType: e.target.value as 'metro' | 'non_metro' })}>
                  <option value="metro">Metro (Delhi/Mumbai/Kolkata/Chennai) — 50% HRA exempt</option>
                  <option value="non_metro">Non-Metro — 40% HRA exempt</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── EPF + VPF Panel ─────────────────────────────────────── */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-blue-900 mb-3">🏦 Provident Fund Contributions (80C)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              {/* EPF – auto 12% of basic */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="input-label mb-0">EPF Employee Contribution</label>
                  {basicSalary > 0 && (
                    <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full">
                      Auto: 12% = {inrFmt(basicSalary * 0.12)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <InputField
                      label=""
                      type="number"
                      prefix="₹"
                      value={num(salary.epfContribution) || ''}
                      onChange={(e) => handleEpfChange(+e.target.value)}
                      hint="12% of basic — auto-filled"
                    />
                  </div>
                  {basicSalary > 0 && (
                    <button
                      type="button"
                      className="self-start mt-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
                      onClick={() => handleEpfChange(Math.round(basicSalary * 0.12))}
                    >
                      Reset 12%
                    </button>
                  )}
                </div>
              </div>

              {/* VPF – x% of basic */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="input-label mb-0">VPF (Voluntary PF)</label>
                  {basicSalary > 0 && vpfPercent > 0 && (
                    <span className="text-xs text-blue-600 font-medium bg-blue-100 px-2 py-0.5 rounded-full">
                      {vpfPercent}% = {inrFmt(basicSalary * vpfPercent / 100)}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <div className="w-28">
                    <label className="input-label text-xs">% of Basic</label>
                    <select
                      className="input-field"
                      value={vpfPercent}
                      onChange={(e) => handleVpfPercentChange(+e.target.value)}
                    >
                      {[0, 2, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 50, 88].map((p) => (
                        <option key={p} value={p}>{p}%</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <InputField
                      label="VPF Amount"
                      type="number"
                      prefix="₹"
                      value={num(salary.vpfContribution) || ''}
                      onChange={(e) => handleVpfAmountChange(+e.target.value)}
                      hint="Auto-filled by % above"
                    />
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-1">EPF + VPF together count toward 80C (₹1.5L cap)</p>
              </div>
            </div>
          </div>

          {/* ── Employer NPS Panel ──────────────────────────────────── */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-green-900 mb-3">🏛️ Employer NPS Contribution [80CCD(2)]</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 items-end">
              <div className="mb-4">
                <label className="input-label">Employer NPS Rate</label>
                <div className="flex gap-3">
                  {[10, 14].map((pct) => (
                    <label key={pct} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="npsEmployerPercent"
                        value={pct}
                        checked={npsEmployerPercent === pct}
                        onChange={() => handleNpsPercentChange(pct)}
                        className="accent-green-600"
                      />
                      <span className="text-sm font-medium text-green-800">
                        {pct}%{pct === 10 ? ' (Private sector)' : ' (Govt / upgraded)'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="input-label mb-0">Employer NPS Amount (Annual)</label>
                  {basicSalary > 0 && (
                    <span className="text-xs text-green-700 font-medium bg-green-100 px-2 py-0.5 rounded-full">
                      Auto: {npsEmployerPercent}% = {inrFmt(basicSalary * npsEmployerPercent / 100)}
                    </span>
                  )}
                </div>
                <InputField
                  label=""
                  type="number"
                  prefix="₹"
                  value={formData.otherDeductions?.npsEmployerContribution || ''}
                  onChange={(e) => updateFormData({ otherDeductions: { ...formData.otherDeductions!, npsEmployerContribution: +e.target.value } })}
                  hint={`80CCD(2) — auto: ${npsEmployerPercent}% of basic. Allowed in both regimes.`}
                />
              </div>
            </div>
          </div>

          {/* ── Health Insurance Panel ──────────────────────────────── */}
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-rose-900 mb-3">🏥 Health Insurance (Salary Deductions)</p>

            {/* Company family insurance */}
            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-rose-600"
                checked={salary.companyHealthInsuranceOptedIn ?? false}
                onChange={(e) => handleCompanyInsuranceToggle(e.target.checked)}
              />
              <span className="text-sm font-medium text-rose-800">Company provides family health insurance (employer-sponsored)</span>
            </label>
            {salary.companyHealthInsuranceOptedIn && (
              <div className="ml-7 mb-4">
                <InputField
                  label="Monthly Premium Deducted from Salary"
                  type="number"
                  prefix="₹"
                  value={num(salary.companyHealthInsurance) || ''}
                  onChange={(e) => handleCompanyInsuranceAmount(+e.target.value)}
                  hint={`Monthly deduction from payslip — annual = ${inrFmt(num(salary.companyHealthInsurance) * 12)} → synced to 80D`}
                />
              </div>
            )}

            {/* Parent insurance */}
            <label className="flex items-center gap-3 mb-3 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-rose-600"
                checked={salary.parentsInsuranceOptedIn ?? false}
                onChange={(e) => handleParentsInsuranceToggle(e.target.checked)}
              />
              <span className="text-sm font-medium text-rose-800">I have opted for parents' insurance through company</span>
            </label>
            {salary.parentsInsuranceOptedIn && (
              <div className="ml-7">
                <InputField
                  label="Monthly Parents Insurance Premium"
                  type="number"
                  prefix="₹"
                  value={num(salary.parentsInsurancePremium) || ''}
                  onChange={(e) => handleParentsInsuranceAmount(+e.target.value)}
                  hint={`Monthly deduction from payslip — annual = ${inrFmt(num(salary.parentsInsurancePremium) * 12)} → synced to 80D`}
                />
              </div>
            )}
          </div>

          <InputField label="Professional Tax Paid" type="number" prefix="₹" value={num(salary.professionalTax) || ''} onChange={(e) => patchSalary({ professionalTax: +e.target.value })} hint="State PT deducted from salary" />
        </section>
      )}

      {/* ── Business / Freelancer Income ───────────────────────────── */}
      {(isBiz || isFreelancer) && (
        <section className="mb-6">
          <h3 className="section-title">🏢 Business / Professional Income</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <InputField label="Gross Receipts / Turnover" type="number" prefix="₹" value={num(biz.grossReceipts) || ''} onChange={(e) => patchBiz({ grossReceipts: +e.target.value })} hint="Total annual revenue" />
            <InputField label="Net Profit (if regular books)" type="number" prefix="₹" value={num(biz.netProfitIfRegular) || ''} onChange={(e) => patchBiz({ netProfitIfRegular: +e.target.value })} hint="Leave blank for presumptive scheme" />
          </div>
          <div className="mb-4">
            <label className="input-label">Taxation Scheme</label>
            <select className="input-field" value={biz.scheme ?? 'regular'} onChange={(e) => patchBiz({ scheme: e.target.value as BusinessIncome['scheme'] })}>
              <option value="regular">Regular (actual books)</option>
              <option value="presumptive_44ad">Section 44AD (Business – 6%/8% of turnover)</option>
              <option value="presumptive_44ada">Section 44ADA (Professionals – 50% of receipts)</option>
            </select>
          </div>
          {biz.scheme === 'presumptive_44ad' && (
            <div className="mb-4">
              <label className="input-label">Receipt Type</label>
              <select className="input-field" value={biz.businessType ?? 'digital'} onChange={(e) => patchBiz({ businessType: e.target.value as 'digital' | 'traditional' })}>
                <option value="digital">Mostly Digital / Banking — 6% taxable</option>
                <option value="traditional">Mostly Cash — 8% taxable</option>
              </select>
            </div>
          )}
          {biz.scheme === 'regular' && (
            <>
              <InputField label="Additional Depreciation [Sec 32(1)(iia)]" type="number" prefix="₹" value={num(biz.additionalDepreciation) || ''} onChange={(e) => patchBiz({ additionalDepreciation: +e.target.value })} hint="Disallowed in New Regime – added back automatically" />
              <div className="col-span-1 sm:col-span-2">
                <InputField label="WDV Adjustment – Unabsorbed Depreciation (one-time)" type="number" prefix="₹" value={num(biz.wdvAdjustment) || ''} onChange={(e) => patchBiz({ wdvAdjustment: +e.target.value })} hint="Sec 115BAC: one-time WDV adjustment for unabsorbed dep as of 1-Apr-2023 when opting into new regime" />
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Other Income ────────────────────────────────────────────── */}
      <section>
        <h3 className="section-title">💰 Other Income</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <InputField label="Savings Account Interest" type="number" prefix="₹" value={other.savingsInterest || ''} onChange={(e) => patchOther({ savingsInterest: +e.target.value })} hint="80TTA deduction applies (old regime, max ₹10K)" />
          <InputField label="FD Interest" type="number" prefix="₹" value={other.fdInterest || ''} onChange={(e) => patchOther({ fdInterest: +e.target.value })} />
          <InputField label="RD Interest" type="number" prefix="₹" value={other.rdInterest || ''} onChange={(e) => patchOther({ rdInterest: +e.target.value })} />
          <InputField label="Dividend Income" type="number" prefix="₹" value={other.dividendIncome || ''} onChange={(e) => patchOther({ dividendIncome: +e.target.value })} />
          <InputField label="Pension Income" type="number" prefix="₹" value={other.pensionIncome || ''} onChange={(e) => patchOther({ pensionIncome: +e.target.value })} hint="Commuted/uncommuted pension" />
          <InputField label="Family Pension" type="number" prefix="₹" value={other.familyPension || ''} onChange={(e) => patchOther({ familyPension: +e.target.value })} hint="1/3 or ₹15,000 is exempt (whichever lower)" />
          <InputField label="Rental Income" type="number" prefix="₹" value={other.rentalIncome || ''} onChange={(e) => patchOther({ rentalIncome: +e.target.value })} hint="30% standard deduction applied automatically" />
          <InputField label="Rental Property Loan Interest" type="number" prefix="₹" value={other.rentalPropertyLoanInterest || ''} onChange={(e) => patchOther({ rentalPropertyLoanInterest: +e.target.value })} hint="Interest on loan for let-out property" />
          <InputField label="Any Other Income" type="number" prefix="₹" value={other.otherIncome || ''} onChange={(e) => patchOther({ otherIncome: +e.target.value })} />
          <div className="mb-4">
            <label className="input-label">Minor Children (for Section 10(32) exemption)</label>
            <select className="input-field" value={other.minorChildrenCount ?? 0} onChange={(e) => patchOther({ minorChildrenCount: +e.target.value })}>
              <option value={0}>None</option>
              <option value={1}>1 minor child (₹1,500 exempt in Old Regime)</option>
              <option value={2}>2 or more minor children (₹3,000 exempt in Old Regime)</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Section 10(32): ₹1,500 per child when minor’s income is clubbed with parent’s. Old Regime only.</p>
          </div>
        </div>
      </section>
    </WizardLayout>
  );
};

export default Step2Income;
