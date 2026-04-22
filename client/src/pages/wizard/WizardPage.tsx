import React from 'react';
import { useTaxStore } from '../../store/taxStore';
import Step0UserType from './Step0UserType';
import Step1BasicInfo from './Step1BasicInfo';
import Step2Income from './Step2Income';
import Step3CapitalGains from './Step3CapitalGains';
import Step4Deductions from './Step4Deductions';
import Step5TDS from './Step5TDS';
import Step6Results from './Step6Results';

const STEPS = [
  Step0UserType,
  Step1BasicInfo,
  Step2Income,
  Step3CapitalGains,
  Step4Deductions,
  Step5TDS,
  Step6Results,
];

const WizardPage: React.FC = () => {
  const { currentStep } = useTaxStore();
  const StepComponent = STEPS[currentStep] ?? Step0UserType;
  return <StepComponent />;
};

export default WizardPage;
