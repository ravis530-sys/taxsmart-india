import React from 'react';
import { useTaxStore } from '../../store/taxStore';
import WizardLayout from '../../components/WizardLayout';
import { UserType } from '../../types/tax';

const USER_TYPES: { value: UserType; label: string; icon: string; desc: string }[] = [
  { value: 'salaried', label: 'Salaried Employee', icon: '💼', desc: 'Govt / Private job, gets Form 16' },
  { value: 'business', label: 'Business Owner', icon: '🏢', desc: 'Shop, firm, company, entrepreneur' },
  { value: 'freelancer', label: 'Freelancer / Consultant', icon: '💻', desc: 'Contract work, professional fees' },
  { value: 'retired', label: 'Retired / Senior', icon: '🏖️', desc: 'Pension, FD income, savings' },
  { value: 'homemaker', label: 'Home Maker', icon: '🏡', desc: 'Investments, rental, other income' },
  { value: 'self_employed', label: 'Self Employed', icon: '🔧', desc: 'Doctor, lawyer, architect, etc.' },
  { value: 'huf', label: 'Hindu Undivided Family (HUF)', icon: '👨‍👩‍👧‍👦', desc: 'HUF entity – Sec 115BAC applies (AY 2021-22+)' },
  { value: 'aop', label: 'Association of Persons (AoP)', icon: '🤝', desc: 'AoP (not co-op society) – Sec 115BAC from AY 2024-25' },
  { value: 'boi', label: 'Body of Individuals (BoI)', icon: '👥', desc: 'BoI or Artificial Juridical Person – Sec 115BAC from AY 2024-25' },
];

const Step0UserType: React.FC = () => {
  const { formData, updateFormData, nextStep } = useTaxStore();
  const selected = formData.userType ?? 'salaried';

  return (
    <WizardLayout
      title="Who are you?"
      subtitle="This helps us show only the relevant income fields for your profile."
      onNext={nextStep}
      nextLabel="Next →"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {USER_TYPES.map((ut) => (
          <button
            key={ut.value}
            type="button"
            onClick={() => updateFormData({ userType: ut.value })}
            className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all
              ${
                selected === ut.value
                  ? 'border-brand-600 bg-brand-50 shadow-md'
                  : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
              }`}
          >
            <span className="text-3xl">{ut.icon}</span>
            <div>
              <p className="font-semibold text-gray-900">{ut.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{ut.desc}</p>
            </div>
            {selected === ut.value && (
              <span className="ml-auto text-brand-600">✓</span>
            )}
          </button>
        ))}
      </div>
    </WizardLayout>
  );
};

export default Step0UserType;
