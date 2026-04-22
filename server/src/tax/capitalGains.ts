import {
  CapitalGainsInput,
  CapitalGainsTax,
  EquityGain,
  PropertyGain,
  DebtMFGain,
  BondGain,
} from './types';
import { computePropertyGain } from './capitalGainsHelpers';

const LTCG_EQUITY_EXEMPTION = 125000; // ₹1,25,000 exemption under Sec 112A (Budget 2024)

/**
 * Compute all capital gains taxes.
 * Returns total CG tax and a breakdown of how much falls under
 * slab-rate (to be added to normal taxable income by the caller).
 */
export function computeCapitalGainsTax(
  input: CapitalGainsInput,
  slabRateTaxFn: (extraIncome: number) => number
): CapitalGainsTax {
  const details: string[] = [];

  // ─── 1. Indian Listed Equity & Equity MF ─────────────────────────────────────
  let stcgEquityTotal = 0;
  let ltcgEquityTotal = 0;
  let tdsFromEquity = 0;

  for (const eg of input.equityGains) {
    if (eg.type === 'indian_listed' || eg.type === 'equity_mf') {
      stcgEquityTotal += eg.shortTermGain;
      ltcgEquityTotal += eg.longTermGain;
      tdsFromEquity += eg.tdsDeducted;
    }
  }

  // STCG on listed equity: 20% (Section 111A, Budget 2024 changed from 15% to 20%)
  const stcgEquityTax = Math.max(0, stcgEquityTotal) * 0.20;
  if (stcgEquityTotal > 0) {
    details.push(`Indian Equity STCG ₹${fmt(stcgEquityTotal)} × 20% = ₹${fmt(stcgEquityTax)}`);
  }

  // LTCG on listed equity: 12.5% above ₹1,25,000 exemption (Section 112A)
  const ltcgEquityTaxable = Math.max(0, ltcgEquityTotal - LTCG_EQUITY_EXEMPTION);
  const ltcgEquityTax = ltcgEquityTaxable * 0.125;
  if (ltcgEquityTotal > 0) {
    details.push(
      `Indian Equity LTCG ₹${fmt(ltcgEquityTotal)} − ₹1.25L exemption = ₹${fmt(ltcgEquityTaxable)} × 12.5% = ₹${fmt(ltcgEquityTax)}`
    );
  }

  // ─── 2. US Stocks (Foreign Listed Equity) ────────────────────────────────────
  let stcgUsTax = 0;
  let ltcgUsTax = 0;

  for (const eg of input.equityGains) {
    if (eg.type === 'us_stocks') {
      // STCG (<24 months): taxed at slab rate → add to ordinary income
      // We return the slab-rate amount separately; caller handles it
      // LTCG (≥24 months): 12.5% without indexation under Section 112
      ltcgUsTax += Math.max(0, eg.longTermGain) * 0.125;
      if (eg.longTermGain > 0) {
        details.push(
          `US Stocks LTCG ₹${fmt(eg.longTermGain)} × 12.5% = ₹${fmt(Math.max(0, eg.longTermGain) * 0.125)}`
        );
      }
      // Note: STCG from US stocks is added to slab-income by caller (getCapitalGainsAtSlabRate)
    }
  }
  const stcgUsStocksTax = stcgUsTax; // placeholder; actual slab tax computed by caller

  // ─── 3. Indian Unlisted Equity ───────────────────────────────────────────────
  // STCG and LTCG are both at slab rate (handled via getCapitalGainsAtSlabRate)

  // ─── 4. Property Gains ───────────────────────────────────────────────────────
  let propertyStcgAmount = 0;
  let propertyLtcgTax = 0;

  for (const pg of input.propertyGains) {
    const holdingYears = pg.yearOfSale - pg.yearOfPurchase;
    const isLT = holdingYears >= 2;
    const result = computePropertyGain(
      pg.saleValue,
      pg.purchaseValue,
      pg.yearOfPurchase,
      pg.yearOfSale,
      pg.improvementCost,
      pg.stampDutyRegistration,
      isLT,
      pg.acquisitionBeforeJul2024
    );

    if (!result.isLongTerm) {
      propertyStcgAmount += result.gainAmount; // taxed at slab
    } else {
      propertyLtcgTax += result.taxAmount;
      if (result.gainAmount > 0) {
        details.push(
          `Property LTCG ₹${fmt(result.gainAmount)} @ ${result.method} = ₹${fmt(result.taxAmount)}`
        );
      }
    }
  }
  const propertyStcgTax = 0; // slab-rated; see getCapitalGainsAtSlabRate

  // ─── 5. Debt MF & Bonds (all at slab rate post Apr 2023 rule change) ─────────
  const debtMFSlabAmount = input.debtMFGains.shortTermGain + input.debtMFGains.longTermGain;
  const bondSlabAmount = input.bondGains.reduce((s, b) => s + b.interestIncome, 0);
  const bondCGSlabAmount = input.bondGains
    .filter((b) => !b.isLongTerm)
    .reduce((s, b) => s + b.capitalGainOnSale, 0);
  const bondLtcgAmount = input.bondGains
    .filter((b) => b.isLongTerm)
    .reduce((s, b) => s + b.capitalGainOnSale, 0);
  // Bond LTCG (>12 months for listed, >36 months for unlisted): 12.5% without indexation
  const bondTax = Math.max(0, bondLtcgAmount) * 0.125;
  if (bondLtcgAmount > 0) {
    details.push(`Bond LTCG ₹${fmt(bondLtcgAmount)} × 12.5% = ₹${fmt(bondTax)}`);
  }

  const totalCapitalGainsTax =
    stcgEquityTax +
    ltcgEquityTax +
    ltcgUsTax +
    propertyLtcgTax +
    bondTax;

  return {
    stcgEquityTax,
    ltcgEquityTax,
    stcgUsStocksTax,
    ltcgUsStocksTax: ltcgUsTax,
    propertyStcgTax,
    propertyLtcgTax,
    debtMFTax: 0, // at slab
    bondTax,
    totalCapitalGainsTax,
    details,
  };
}

/**
 * Returns total capital gains amounts that are taxed at slab rate.
 * These must be added to the ordinary taxable income before computing slab tax.
 */
export function getCapitalGainsAtSlabRate(input: CapitalGainsInput): number {
  let total = 0;

  for (const eg of input.equityGains) {
    if (eg.type === 'us_stocks' || eg.type === 'indian_unlisted') {
      total += Math.max(0, eg.shortTermGain);
    }
  }

  // Property STCG
  for (const pg of input.propertyGains) {
    const holdingYears = pg.yearOfSale - pg.yearOfPurchase;
    if (holdingYears < 2) {
      const gain = pg.saleValue - (pg.purchaseValue + pg.improvementCost + pg.stampDutyRegistration);
      total += Math.max(0, gain);
    }
  }

  // Debt MF (all at slab)
  total += Math.max(0, input.debtMFGains.shortTermGain + input.debtMFGains.longTermGain);

  // Bond interest income + short-term CG
  for (const b of input.bondGains) {
    total += Math.max(0, b.interestIncome);
    if (!b.isLongTerm) {
      total += Math.max(0, b.capitalGainOnSale);
    }
  }

  return total;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}
