import React, { useState } from 'react';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import InputField from '../../components/InputField';
import { ResidentialStatus, AssessmentYear } from '../../types/tax';

const Step1BasicInfo: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useTaxStore();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.age || formData.age < 0 || formData.age > 120) {
      errs.age = 'Enter a valid age (0–120)';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validate()) nextStep();
  };

  const hasBusiness = formData.userType === 'business' || formData.userType === 'freelancer' || formData.userType === 'self_employed';

  return (
    <WizardLayout
      title="Basic Information"
      subtitle="Your age determines which tax slab applies (senior citizen benefits etc.)."
      onNext={handleNext}
      onPrev={prevStep}
    >
      <div className="space-y-2">
        {/* Assessment Year */}
        <div className="mb-4">
          <label className="input-label">Assessment Year</label>
          <select
            className="input-field"
            value={formData.assessmentYear ?? '2026-27'}
            onChange={(e) => updateFormData({ assessmentYear: e.target.value as AssessmentYear })}
          >
            <option value="2026-27">AY 2026-27 (FY 2025-26) — Current year</option>
            <option value="2025-26">AY 2025-26 (FY 2024-25)</option>
          </select>
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mt-2">
            📌 <strong>New Tax Regime is the default</strong> from AY 2024-25 onwards (Section 115BAC(1A)).
            You must explicitly opt out to use the Old Regime.
          </p>
        </div>

        {/* Regime Choice */}
        <div className="mb-4">
          <label className="input-label">Tax Regime Preference</label>
          <select
            className="input-field"
            value={formData.regimeChoice ?? ''}
            onChange={(e) =>
              updateFormData({ regimeChoice: (e.target.value as 'new' | 'old') || undefined })
            }
          >
            <option value="">Show both (recommended — compare side-by-side)</option>
            <option value="new">New Regime (Section 115BAC) — lower slabs, fewer deductions</option>
            <option value="old">Old Regime — opt out of new regime, claim all deductions</option>
          </select>
          {hasBusiness && (
            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-800">
              <strong>⚠️ Business/Professional income — Regime lock-in rules (Sec 115BAC(5)):</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Once you opt into the <strong>New Regime</strong>, it applies to <strong>all subsequent years</strong> automatically.</li>
                <li>You may <strong>withdraw only once</strong> in your lifetime (by the due date of return filing).</li>
                <li>After withdrawal, you <strong>cannot opt back</strong> into the New Regime unless you cease to have business/professional income.</li>
              </ul>
            </div>
          )}
          {!hasBusiness && (
            <p className="text-xs text-gray-500 mt-1">
              Without business income you can switch regimes freely every year when filing your return.
            </p>
          )}
        </div>

        {/* Age */}
        <InputField
          label="Your Age (as of 31 March of FY)"
          type="number"
          min={0}
          max={120}
          value={formData.age ?? ''}
          onChange={(e) => updateFormData({ age: parseInt(e.target.value) || 0 })}
          error={errors.age}
          hint="Age determines senior citizen / super senior citizen slabs"
        />

        {/* Residential Status */}
        <div className="mb-4">
          <label className="input-label">Residential Status</label>
          <p className="text-xs text-gray-400 mb-1">
            NRI / RNOR? Different rules may apply. Most Indians = Resident.
          </p>
          <select
            className="input-field"
            value={formData.residentialStatus ?? 'resident'}
            onChange={(e) =>
              updateFormData({ residentialStatus: e.target.value as ResidentialStatus })
            }
          >
            <option value="resident">Resident Indian</option>
            <option value="nri">Non-Resident Indian (NRI)</option>
            <option value="rnor">Resident but Not Ordinarily Resident (RNOR)</option>
          </select>
        </div>

        {/* Info box about age tiers */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Age-based Tax Benefits (Old Regime)</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Below 60: Basic exemption ₹2.5 lakh</li>
            <li>60–79 (Senior Citizen): Basic exemption ₹3 lakh</li>
            <li>80+ (Super Senior): Basic exemption ₹5 lakh</li>
          </ul>
        </div>
      </div>
    </WizardLayout>
  );
};

export default Step1BasicInfo;
