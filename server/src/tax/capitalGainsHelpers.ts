/**
 * Cost Inflation Index (CII) for indexation of capital gains
 * Base year: 2001-02 = 100
 */
export const CII: Record<number, number> = {
  2001: 100,
  2002: 105,
  2003: 109,
  2004: 113,
  2005: 117,
  2006: 122,
  2007: 129,
  2008: 137,
  2009: 148,
  2010: 167,
  2011: 184,
  2012: 200,
  2013: 220,
  2014: 240,
  2015: 254,
  2016: 264,
  2017: 272,
  2018: 280,
  2019: 289,
  2020: 301,
  2021: 317,
  2022: 331,
  2023: 348,
  2024: 363,
  2025: 389,
};

/**
 * Compute indexed cost of acquisition
 */
export function indexedCost(
  originalCost: number,
  yearOfPurchase: number,
  yearOfSale: number
): number {
  const purchaseCII = CII[yearOfPurchase] ?? CII[2001];
  const saleCII = CII[yearOfSale] ?? CII[2025];
  return (originalCost * saleCII) / purchaseCII;
}

/**
 * Compute property capital gains.
 * Budget 2024 (effective July 23, 2024):
 *  - New purchases / sales: 12.5% without indexation
 *  - Property acquired BEFORE July 23, 2024: taxpayer may choose the more beneficial of:
 *    (a) 12.5% without indexation   OR
 *    (b) 20% with indexation (old rule)
 */
export function computePropertyGain(
  saleValue: number,
  purchaseValue: number,
  yearOfPurchase: number,
  yearOfSale: number,
  improvementCost: number,
  stampDuty: number,
  isLongTerm: boolean,
  acquisitionBeforeJul2024: boolean
): {
  isLongTerm: boolean;
  gainAmount: number;
  taxRate: number;
  taxAmount: number;
  method: string;
} {
  const totalCostBase = purchaseValue + improvementCost + stampDuty;

  if (!isLongTerm) {
    // Short-term: taxed at slab rate (caller handles this)
    const gain = saleValue - totalCostBase;
    return { isLongTerm: false, gainAmount: Math.max(0, gain), taxRate: 0, taxAmount: 0, method: 'Slab Rate' };
  }

  // Long-term
  if (acquisitionBeforeJul2024) {
    // Option A: 12.5% without indexation
    const gainNoIndex = saleValue - totalCostBase;
    const taxNoIndex = Math.max(0, gainNoIndex) * 0.125;

    // Option B: 20% with indexation
    const indexedCostBase = indexedCost(purchaseValue, yearOfPurchase, yearOfSale)
      + indexedCost(improvementCost, yearOfPurchase, yearOfSale)
      + stampDuty;
    const gainWithIndex = saleValue - indexedCostBase;
    const taxWithIndex = Math.max(0, gainWithIndex) * 0.20;

    // Choose the lower tax option (more beneficial to taxpayer)
    if (taxWithIndex < taxNoIndex) {
      return {
        isLongTerm: true,
        gainAmount: Math.max(0, gainWithIndex),
        taxRate: 0.20,
        taxAmount: taxWithIndex,
        method: '20% with Indexation (pre-Jul 2024 property)',
      };
    } else {
      return {
        isLongTerm: true,
        gainAmount: Math.max(0, gainNoIndex),
        taxRate: 0.125,
        taxAmount: taxNoIndex,
        method: '12.5% without Indexation',
      };
    }
  } else {
    // Post July 23, 2024 acquisition: 12.5% without indexation
    const gain = saleValue - totalCostBase;
    const tax = Math.max(0, gain) * 0.125;
    return {
      isLongTerm: true,
      gainAmount: Math.max(0, gain),
      taxRate: 0.125,
      taxAmount: tax,
      method: '12.5% without Indexation',
    };
  }
}
