import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  TaxInput, TaxCalculationResult,
  defaultOtherIncome, defaultCapitalGains, defaultDeductions80C,
  defaultOtherDeductions, defaultTaxPaid,
} from '../types/tax';

export const TOTAL_STEPS = 7; // 0..6 (step 6 = results)

interface TaxStore {
  currentStep: number;
  formData: Partial<TaxInput> & {
    otherIncome: TaxInput['otherIncome'];
    capitalGains: TaxInput['capitalGains'];
    deductions80C: TaxInput['deductions80C'];
    otherDeductions: TaxInput['otherDeductions'];
    taxPaid: TaxInput['taxPaid'];
  };
  result: TaxCalculationResult | null;
  isCalculating: boolean;
  error: string | null;

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateFormData: (patch: Partial<TaxInput>) => void;
  setResult: (result: TaxCalculationResult) => void;
  setCalculating: (v: boolean) => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

const makeDefault = () => ({
  assessmentYear: '2026-27' as const,
  userType: 'salaried' as const,
  age: 30,
  residentialStatus: 'resident' as const,
  salaryIncome: {
    basicSalary: 0, hra: 0, lta: 0, specialAllowance: 0, otherAllowances: 0,
    rentPaidMonthly: 0, cityType: 'non_metro' as const, professionalTax: 0, epfContribution: 0,
  },
  businessIncome: {
    grossReceipts: 0, scheme: 'regular' as const, businessType: 'digital' as const,
  },
  otherIncome: defaultOtherIncome(),
  capitalGains: defaultCapitalGains(),
  deductions80C: defaultDeductions80C(),
  otherDeductions: defaultOtherDeductions(),
  taxPaid: defaultTaxPaid(),
});

export const useTaxStore = create<TaxStore>()(
  devtools(
    (set) => ({
      currentStep: 0,
      formData: makeDefault(),
      result: null,
      isCalculating: false,
      error: null,

      setStep: (step) => set({ currentStep: step }),
      nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, TOTAL_STEPS - 1) })),
      prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 0) })),
      updateFormData: (patch) =>
        set((s) => ({ formData: { ...s.formData, ...patch } })),
      setResult: (result) => set({ result }),
      setCalculating: (v) => set({ isCalculating: v }),
      setError: (err) => set({ error: err }),
      reset: () => set({ currentStep: 0, formData: makeDefault(), result: null, error: null }),
    }),
    { name: 'TaxStore' }
  )
);
