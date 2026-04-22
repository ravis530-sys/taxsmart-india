import { TaxPaid } from './types';

/**
 * Sum all TDS deducted from all sources + advance tax paid
 */
export function computeTotalTaxPaid(taxPaid: TaxPaid): {
  totalTDS: number;
  totalAdvanceTax: number;
  totalTaxPaid: number;
} {
  const totalTDS = taxPaid.tdsEntries.reduce((s, e) => s + e.tdsDeducted, 0);
  const totalAdvanceTax =
    taxPaid.advanceTaxQ1 +
    taxPaid.advanceTaxQ2 +
    taxPaid.advanceTaxQ3 +
    taxPaid.advanceTaxQ4;
  const totalTaxPaid = totalTDS + totalAdvanceTax + taxPaid.selfAssessmentTax;
  return { totalTDS, totalAdvanceTax, totalTaxPaid };
}
