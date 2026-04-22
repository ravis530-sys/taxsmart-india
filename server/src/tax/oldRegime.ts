import { SlabBreakdown, TaxInput } from './types';

/**
 * Old Tax Regime slabs (unchanged for FY 2025-26)
 * Below 60 years:
 *   0%   – up to ₹2,50,000
 *   5%   – ₹2,50,001 to ₹5,00,000
 *   20%  – ₹5,00,001 to ₹10,00,000
 *   30%  – above ₹10,00,000
 *
 * Senior Citizens (60–80 years):
 *   0%   – up to ₹3,00,000
 *   5%   – ₹3,00,001 to ₹5,00,000
 *   20%  – ₹5,00,001 to ₹10,00,000
 *   30%  – above ₹10,00,000
 *
 * Super Senior Citizens (80+ years):
 *   0%   – up to ₹5,00,000
 *   20%  – ₹5,00,001 to ₹10,00,000
 *   30%  – above ₹10,00,000
 *
 * Rebate u/s 87A: ₹12,500 if total income ≤ ₹5,00,000
 * Standard Deduction: ₹50,000 for salaried / pensioners
 */

export const OLD_REGIME_STANDARD_DEDUCTION = 50000;

interface SlabEntry { from: number; to: number; rate: number; label: string; }

function getOldRegimeSlabs(age: number): SlabEntry[] {
  if (age >= 80) {
    return [
      { from: 0,       to: 500000,   rate: 0.00, label: 'Up to ₹5L (0%)' },
      { from: 500000,  to: 1000000,  rate: 0.20, label: '₹5L – ₹10L (20%)' },
      { from: 1000000, to: Infinity, rate: 0.30, label: 'Above ₹10L (30%)' },
    ];
  }
  if (age >= 60) {
    return [
      { from: 0,       to: 300000,   rate: 0.00, label: 'Up to ₹3L (0%)' },
      { from: 300000,  to: 500000,   rate: 0.05, label: '₹3L – ₹5L (5%)' },
      { from: 500000,  to: 1000000,  rate: 0.20, label: '₹5L – ₹10L (20%)' },
      { from: 1000000, to: Infinity, rate: 0.30, label: 'Above ₹10L (30%)' },
    ];
  }
  return [
    { from: 0,       to: 250000,   rate: 0.00, label: 'Up to ₹2.5L (0%)' },
    { from: 250000,  to: 500000,   rate: 0.05, label: '₹2.5L – ₹5L (5%)' },
    { from: 500000,  to: 1000000,  rate: 0.20, label: '₹5L – ₹10L (20%)' },
    { from: 1000000, to: Infinity, rate: 0.30, label: 'Above ₹10L (30%)' },
  ];
}

export function computeOldRegimeTax(
  taxableIncome: number,
  age: number
): {
  slabTax: number;
  breakdown: SlabBreakdown[];
  rebate: number;
  taxAfterRebate: number;
} {
  const slabs = getOldRegimeSlabs(age);
  const income = Math.max(0, taxableIncome);
  let slabTax = 0;
  const breakdown: SlabBreakdown[] = [];

  for (const slab of slabs) {
    if (income <= slab.from) break;
    const taxableInSlab = Math.min(income, slab.to) - slab.from;
    const slabTaxAmount = taxableInSlab * slab.rate;
    slabTax += slabTaxAmount;
    if (taxableInSlab > 0) {
      breakdown.push({
        slabLabel: slab.label,
        income: taxableInSlab,
        rate: slab.rate * 100,
        tax: slabTaxAmount,
      });
    }
  }

  // Rebate u/s 87A: ₹12,500 if total income ≤ ₹5,00,000
  const rebate = taxableIncome <= 500000 ? Math.min(slabTax, 12500) : 0;

  return {
    slabTax,
    breakdown,
    rebate,
    taxAfterRebate: Math.max(0, slabTax - rebate),
  };
}

/**
 * Compute all deductions available under the Old Regime.
 */
export function computeOldRegimeDeductions(input: TaxInput): {
  standardDeduction: number;
  hraExemption: number;
  ltaExemption: number;
  deduction80C: number;
  deduction80D: number;
  deduction80E: number;
  deduction80G: number;
  deduction80TTA_TTB: number;
  deduction80CCD1B: number;
  deduction80CCD2: number;
  homeLoanInterest: number; // Section 24
  familyPensionExemption: number;
  minorChildExemption: number;
  deduction80CCH2: number;
  deduction80JJAA: number;
  deduction80LA: number;
  total: number;
} {
  const isSalaried = input.userType === 'salaried' || input.userType === 'retired';
  // HUF, AoP, BoI are not natural persons – no senior citizen benefit
  const isNonPerson = input.userType === 'huf' || input.userType === 'aop' || input.userType === 'boi';
  const isSenior = input.age >= 60 && !isNonPerson;

  // Standard Deduction
  const standardDeduction = isSalaried ? OLD_REGIME_STANDARD_DEDUCTION : 0;

  // HRA Exemption (least of 3 conditions)
  let hraExemption = 0;
  if (input.salaryIncome && input.userType === 'salaried') {
    const { basicSalary = 0, hra = 0, rentPaidMonthly = 0, cityType } = input.salaryIncome;
    const da = 0; // DA assumed 0 unless specified
    const actualHRA = hra;
    const rentPaidAnnual = rentPaidMonthly * 12;
    const rentMinusBasic = Math.max(0, rentPaidAnnual - 0.1 * (basicSalary + da));
    const percentOfBasic = cityType === 'metro'
      ? 0.5 * (basicSalary + da)
      : 0.4 * (basicSalary + da);
    hraExemption = rentPaidMonthly > 0
      ? Math.min(actualHRA, rentMinusBasic, percentOfBasic)
      : 0;
  }

  // LTA (assumed claimed at declared value; simplification)
  const ltaExemption = input.salaryIncome?.lta ?? 0;

  // 80C — capped at ₹1,50,000
  const d = input.deductions80C;
  const raw80C =
    (d.ppf ?? 0) + (d.elss ?? 0) + (d.lic ?? 0) + (d.nsc ?? 0) +
    (d.homeLoanPrincipal ?? 0) + (d.tuitionFees ?? 0) + (d.epfEmployee ?? 0) +
    (d.sukanyaSamriddhi ?? 0) + (d.taxSavingFD ?? 0) + (d.nps80CCD1 ?? 0) + (d.other80C ?? 0);
  const deduction80C = Math.min(raw80C, 150000);

  // 80D Health Insurance
  const od = input.otherDeductions;
  const selfHealthLimit = isSenior ? 50000 : 25000;
  const parentsLimit = od.parentsSeniorCitizen ? 50000 : 25000;
  const preventiveLimit = 5000;
  const preventiveCapped = Math.min(od.preventiveHealthCheckup, preventiveLimit);
  const deduction80D =
    Math.min(od.healthInsuranceSelf + preventiveCapped, selfHealthLimit) +
    Math.min(od.healthInsuranceParents, parentsLimit);

  // 80E Education Loan Interest (no limit)
  const deduction80E = od.educationLoanInterest;

  // 80G Donations
  const deduction80G = od.donations100Percent + od.donations50Percent * 0.5;

  // 80TTA (non-senior ≤₹10,000) / 80TTB (senior ≤₹50,000)
  const ttaLimit = isSenior ? 50000 : 10000;
  const deduction80TTA_TTB = Math.min(od.savingsInterestDeduction, ttaLimit);

  // 80CCD(1B) NPS Additional — max ₹50,000
  const deduction80CCD1B = Math.min(od.nps80CCD1B, 50000);

  // 80CCD(2) Employer NPS (max 10% of basic)
  const basicForNPS = input.salaryIncome?.basicSalary ?? 0;
  const deduction80CCD2 = Math.min(od.npsEmployerContribution, basicForNPS * 0.10);

  // Section 24 Home Loan Interest — max ₹2,00,000 (self-occupied)
  const homeLoanInterest = Math.min(od.homeLoanInterest, 200000);

  // Family Pension Exemption: 1/3 of pension or ₹15,000 whichever lower
  const familyPensionExemption = Math.min(
    input.otherIncome.familyPension / 3,
    15000
  );

  // Section 10(32) Minor Child Income Exemption: ₹1,500 per minor child (max 2 children)
  const minorChildExemption = Math.min(input.otherIncome.minorChildrenCount ?? 0, 2) * 1500;

  // 80CCH(2) Agniveer Corpus Fund (also allowed in new regime)
  const deduction80CCH2 = od.agniveer80CCH2 ?? 0;

  // 80JJAA New employment (30% of additional employee cost, 3 years; user enters deductible amount)
  const deduction80JJAA = od.newEmployment80JJAA ?? 0;

  // 80LA IFSC Unit (also allowed in new regime)
  const deduction80LA = od.ifscUnit80LA ?? 0;

  const total =
    standardDeduction +
    hraExemption +
    ltaExemption +
    deduction80C +
    deduction80D +
    deduction80E +
    deduction80G +
    deduction80TTA_TTB +
    deduction80CCD1B +
    deduction80CCD2 +
    homeLoanInterest +
    familyPensionExemption +
    minorChildExemption +
    deduction80CCH2 +
    deduction80JJAA +
    deduction80LA;

  return {
    standardDeduction,
    hraExemption,
    ltaExemption,
    deduction80C,
    deduction80D,
    deduction80E,
    deduction80G,
    deduction80TTA_TTB,
    deduction80CCD1B,
    deduction80CCD2,
    homeLoanInterest,
    familyPensionExemption,
    minorChildExemption,
    deduction80CCH2,
    deduction80JJAA,
    deduction80LA,
    total,
  };
}
