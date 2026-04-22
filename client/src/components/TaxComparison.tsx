import React from 'react';
import { RegimeResult, TaxRegime } from '../types/tax';

interface TaxComparisonProps {
  newRegime: RegimeResult;
  oldRegime: RegimeResult;
  preferred: TaxRegime;
}

const inr = (n: number) => '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const isRefund = (n: number) => n < 0;

const TaxComparison: React.FC<TaxComparisonProps> = ({ newRegime, oldRegime, preferred }) => {
  const rows: { label: string; new: number; old: number; negate?: boolean }[] = [
    { label: 'Gross Income', new: newRegime.grossIncome, old: oldRegime.grossIncome },
    { label: 'Standard Deduction', new: newRegime.standardDeduction, old: oldRegime.standardDeduction, negate: true },
    { label: 'HRA Exemption', new: newRegime.hraExemption, old: oldRegime.hraExemption, negate: true },
    { label: 'Other Deductions', new: newRegime.totalDeductions, old: oldRegime.totalDeductions, negate: true },
    { label: 'Taxable Income', new: newRegime.taxableIncome, old: oldRegime.taxableIncome },
    { label: 'Slab Tax', new: newRegime.slabTax, old: oldRegime.slabTax },
    { label: 'Capital Gains Tax', new: newRegime.capitalGainsTax.totalCapitalGainsTax, old: oldRegime.capitalGainsTax.totalCapitalGainsTax },
    { label: 'Rebate u/s 87A', new: newRegime.rebateU87A, old: oldRegime.rebateU87A, negate: true },
    { label: 'Surcharge', new: newRegime.surcharge, old: oldRegime.surcharge },
    { label: 'Cess (4%)', new: newRegime.cess, old: oldRegime.cess },
    { label: 'Total Tax Liability', new: newRegime.totalTaxLiability, old: oldRegime.totalTaxLiability },
    { label: 'TDS / Tax Paid', new: newRegime.totalTDSCredit + newRegime.advanceTaxPaid, old: oldRegime.totalTDSCredit + oldRegime.advanceTaxPaid, negate: true },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left pb-3 text-gray-500 font-medium w-1/2">Description</th>
            <th className="text-right pb-3">
              <span className={`${preferred === 'new' ? 'badge-green' : 'badge-new'} py-1 px-3`}>
                New Regime{preferred === 'new' ? ' ★' : ''}
              </span>
            </th>
            <th className="text-right pb-3">
              <span className={`${preferred === 'old' ? 'badge-green' : 'badge-old'} py-1 px-3`}>
                Old Regime{preferred === 'old' ? ' ★' : ''}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isBold = row.label === 'Total Tax Liability';
            const displayNew = row.negate ? -row.new : row.new;
            const displayOld = row.negate ? -row.old : row.old;
            return (
              <tr key={i} className={`border-b border-gray-50 ${isBold ? 'font-bold text-base' : ''}`}>
                <td className="py-2.5 text-gray-700">{row.label}</td>
                <td className="py-2.5 text-right">
                  {displayNew < 0 ? <span className="text-green-600">−{inr(displayNew)}</span> : inr(displayNew)}
                </td>
                <td className="py-2.5 text-right">
                  {displayOld < 0 ? <span className="text-green-600">−{inr(displayOld)}</span> : inr(displayOld)}
                </td>
              </tr>
            );
          })}

          {/* Net payable row */}
          <tr className="bg-gray-50">
            <td className="py-3 font-bold text-gray-900 pl-2 rounded-l-lg">Net Tax Payable / Refund</td>
            <td className={`py-3 text-right font-bold text-lg ${isRefund(newRegime.netPayable) ? 'text-green-600' : 'text-red-600'}`}>
              {isRefund(newRegime.netPayable) ? `↩ ${inr(newRegime.netPayable)} refund` : inr(newRegime.netPayable)}
            </td>
            <td className={`py-3 text-right font-bold text-lg pr-2 rounded-r-lg ${isRefund(oldRegime.netPayable) ? 'text-green-600' : 'text-red-600'}`}>
              {isRefund(oldRegime.netPayable) ? `↩ ${inr(oldRegime.netPayable)} refund` : inr(oldRegime.netPayable)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default TaxComparison;
