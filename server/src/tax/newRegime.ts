import { AssessmentYear, SlabBreakdown } from './types';

/**
 * New Tax Regime (Section 115BAC) – AY-aware slab computation.
 *
 * AY 2025-26 (FY 2024-25) – Budget 2024 slabs:
 *   0%   – up to ₹3,00,000
 *   5%   – ₹3,00,001 to ₹7,00,000
 *  10%   – ₹7,00,001 to ₹10,00,000
 *  15%   – ₹10,00,001 to ₹12,00,000
 *  20%   – ₹12,00,001 to ₹15,00,000
 *  30%   – above ₹15,00,000
 *  Rebate u/s 87A: up to ₹25,000 if total income ≤ ₹7,00,000
 *
 * AY 2026-27 (FY 2025-26) – Budget 2025 slabs:
 *   0%   – up to ₹4,00,000
 *   5%   – ₹4,00,001 to ₹8,00,000
 *  10%   – ₹8,00,001 to ₹12,00,000
 *  15%   – ₹12,00,001 to ₹16,00,000
 *  20%   – ₹16,00,001 to ₹20,00,000
 *  25%   – ₹20,00,001 to ₹24,00,000
 *  30%   – above ₹24,00,000
 *  Rebate u/s 87A: up to ₹60,000 if total income ≤ ₹12,00,000
 *
 * Standard Deduction: ₹75,000 for salaried / pensioners (both AYs)
 */

interface NewRegimeSlabEntry {
  from: number;
  to: number;
  rate: number;
  label: string;
}

interface AYConfig {
  slabs: NewRegimeSlabEntry[];
  rebateLimit: number;
  rebateMax: number;
}

const AY_2025_26_CONFIG: AYConfig = {
  slabs: [
    { from: 0,        to: 300000,   rate: 0.00, label: 'Up to ₹3L (0%)' },
    { from: 300000,   to: 700000,   rate: 0.05, label: '₹3L – ₹7L (5%)' },
    { from: 700000,   to: 1000000,  rate: 0.10, label: '₹7L – ₹10L (10%)' },
    { from: 1000000,  to: 1200000,  rate: 0.15, label: '₹10L – ₹12L (15%)' },
    { from: 1200000,  to: 1500000,  rate: 0.20, label: '₹12L – ₹15L (20%)' },
    { from: 1500000,  to: Infinity, rate: 0.30, label: 'Above ₹15L (30%)' },
  ],
  rebateLimit: 700000,   // ₹7,00,000
  rebateMax: 25000,      // max rebate = ₹25,000
};

const AY_2026_27_CONFIG: AYConfig = {
  slabs: [
    { from: 0,        to: 400000,   rate: 0.00, label: 'Up to ₹4L (0%)' },
    { from: 400000,   to: 800000,   rate: 0.05, label: '₹4L – ₹8L (5%)' },
    { from: 800000,   to: 1200000,  rate: 0.10, label: '₹8L – ₹12L (10%)' },
    { from: 1200000,  to: 1600000,  rate: 0.15, label: '₹12L – ₹16L (15%)' },
    { from: 1600000,  to: 2000000,  rate: 0.20, label: '₹16L – ₹20L (20%)' },
    { from: 2000000,  to: 2400000,  rate: 0.25, label: '₹20L – ₹24L (25%)' },
    { from: 2400000,  to: Infinity, rate: 0.30, label: 'Above ₹24L (30%)' },
  ],
  rebateLimit: 1200000,  // ₹12,00,000
  rebateMax: 60000,       // max rebate = ₹60,000
};

function getAYConfig(assessmentYear: AssessmentYear): AYConfig {
  return assessmentYear === '2025-26' ? AY_2025_26_CONFIG : AY_2026_27_CONFIG;
}

export const NEW_REGIME_STANDARD_DEDUCTION = 75000;

export function computeNewRegimeTax(
  taxableIncome: number,       // after standard deduction; slab-rate CG included
  assessmentYear: AssessmentYear
): {
  taxableIncomeAfterSD: number;
  slabTax: number;
  breakdown: SlabBreakdown[];
  rebate: number;
  taxAfterRebate: number;
} {
  const { slabs, rebateLimit, rebateMax } = getAYConfig(assessmentYear);
  const breakdown: SlabBreakdown[] = [];
  let slabTax = 0;
  const income = Math.max(0, taxableIncome);

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

  // Rebate u/s 87A applies when total income ≤ rebate limit (before special-rate CG)
  const rebate = taxableIncome <= rebateLimit
    ? Math.min(slabTax, rebateMax)
    : 0;

  return {
    taxableIncomeAfterSD: income,
    slabTax,
    breakdown,
    rebate,
    taxAfterRebate: Math.max(0, slabTax - rebate),
  };
}
