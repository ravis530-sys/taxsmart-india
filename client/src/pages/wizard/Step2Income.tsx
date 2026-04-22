import React from 'react';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import InputField from '../../components/InputField';
import { SalaryIncome, BusinessIncome, OtherIncome } from '../../types/tax';

const num = (v: unknown) => (v as number) ?? 0;

const Step2Income: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useTaxStore();
  const userType = formData.userType ?? 'salaried';
  const salary = formData.salaryIncome ?? ({} as SalaryIncome);
  const biz = formData.businessIncome ?? ({} as BusinessIncome);
  const other = formData.otherIncome;

  const patchSalary = (patch: Partial<SalaryIncome>) =>
    updateFormData({ salaryIncome: { ...salary, ...patch } });
  const patchBiz = (patch: Partial<BusinessIncome>) =>
    updateFormData({ businessIncome: { ...biz, ...patch } });
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <InputField label="Basic Salary" type="number" prefix="₹" value={num(salary.basicSalary) || ''} onChange={(e) => patchSalary({ basicSalary: +e.target.value })} hint="Annual basic from salary slip" />
            <InputField label="HRA Received" type="number" prefix="₹" value={num(salary.hra) || ''} onChange={(e) => patchSalary({ hra: +e.target.value })} hint="House Rent Allowance (annual)" />
            <InputField label="LTA" type="number" prefix="₹" value={num(salary.lta) || ''} onChange={(e) => patchSalary({ lta: +e.target.value })} hint="Leave Travel Allowance" />
            <InputField label="Special Allowance" type="number" prefix="₹" value={num(salary.specialAllowance) || ''} onChange={(e) => patchSalary({ specialAllowance: +e.target.value })} />
            <InputField label="Other Allowances" type="number" prefix="₹" value={num(salary.otherAllowances) || ''} onChange={(e) => patchSalary({ otherAllowances: +e.target.value })} />
            <InputField label="Employer NPS Contribution (Annual)" type="number" prefix="₹" value={formData.otherDeductions?.npsEmployerContribution || ''} onChange={(e) => updateFormData({ otherDeductions: { ...formData.otherDeductions!, npsEmployerContribution: +e.target.value } })} hint="80CCD(2) — enter annual total; capped at 10% of annual basic" />
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

          <InputField label="EPF Employee Contribution" type="number" prefix="₹" value={num(salary.epfContribution) || ''} onChange={(e) => patchSalary({ epfContribution: +e.target.value })} hint="Usually 12% of basic — already in 80C" />
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
