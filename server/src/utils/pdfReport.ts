import PDFDocument from 'pdfkit';
import { TaxCalculationResult, TaxInput } from '../tax/types';
import { Writable } from 'stream';

function inr(n: number): string {
  return '₹' + new Intl.NumberFormat('en-IN').format(Math.round(n));
}

export function generateTaxReport(
  input: TaxInput,
  result: TaxCalculationResult,
  name: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const preferred = result.recommendation.preferredRegime === 'new'
      ? result.newRegime
      : result.oldRegime;

    // ── Header ──────────────────────────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').text('Income Tax Computation Report', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text(`Assessment Year: ${input.assessmentYear}`, { align: 'center' });
    doc.text(`Name: ${name}  |  User Type: ${input.userType}  |  Age: ${input.age}`, { align: 'center' });
    doc.moveDown();

    // ── Recommendation Banner ─────────────────────────────────────────────────
    const recLabel = result.recommendation.preferredRegime === 'new' ? 'NEW REGIME' : 'OLD REGIME';
    doc.fontSize(14).font('Helvetica-Bold')
      .fillColor('#1a56db')
      .text(`Recommendation: Choose ${recLabel}`, { align: 'center' });
    doc.fontSize(11).font('Helvetica').fillColor('#374151')
      .text(`Tax Savings: ${inr(result.recommendation.savings)}`, { align: 'center' });
    doc.moveDown();

    // ── Side-by-Side Summary ──────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text('Tax Summary Comparison');
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const col1 = 50, col2 = 250, col3 = 430;
    const rowH = 22;

    const rows = [
      ['', 'New Regime', 'Old Regime'],
      ['Gross Income', inr(result.newRegime.grossIncome), inr(result.oldRegime.grossIncome)],
      ['Total Deductions', inr(result.newRegime.totalDeductions), inr(result.oldRegime.totalDeductions)],
      ['Taxable Income', inr(result.newRegime.taxableIncomeWithCG), inr(result.oldRegime.taxableIncomeWithCG)],
      ['Slab Tax', inr(result.newRegime.slabTax), inr(result.oldRegime.slabTax)],
      ['Capital Gains Tax', inr(result.newRegime.capitalGainsTax.totalCapitalGainsTax), inr(result.oldRegime.capitalGainsTax.totalCapitalGainsTax)],
      ['Rebate u/s 87A', inr(result.newRegime.rebateU87A), inr(result.oldRegime.rebateU87A)],
      ['Surcharge', inr(result.newRegime.surcharge), inr(result.oldRegime.surcharge)],
      ['Health & Education Cess (4%)', inr(result.newRegime.cess), inr(result.oldRegime.cess)],
      ['Total Tax Liability', inr(result.newRegime.totalTaxLiability), inr(result.oldRegime.totalTaxLiability)],
      ['TDS Credit', inr(result.newRegime.totalTDSCredit), inr(result.oldRegime.totalTDSCredit)],
      ['Net Tax Payable / Refund', inr(result.newRegime.netPayable), inr(result.oldRegime.netPayable)],
    ];

    rows.forEach((row, i) => {
      const y = tableTop + i * rowH;
      const isHeader = i === 0;
      const isTotal = row[0] === 'Total Tax Liability' || row[0] === 'Net Tax Payable / Refund';
      doc.font(isHeader || isTotal ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
      if (isHeader) doc.fillColor('#1e40af');
      else if (isTotal) doc.fillColor('#065f46');
      else doc.fillColor('#111827');

      doc.text(row[0], col1, y, { width: 190 });
      doc.text(row[1], col2, y, { width: 170, align: 'right' });
      doc.text(row[2], col3, y, { width: 110, align: 'right' });

      // Separator line
      if (!isHeader) {
        doc.moveTo(col1, y + rowH - 3).lineTo(550, y + rowH - 3).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
      }
    });

    doc.moveDown(rows.length * 0.6 + 1);

    // ── ITR Form Guidance ─────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text('ITR Form Guidance');
    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(`Recommended Form: ${preferred.itrFormRecommended}`)
      .text(`Reason: ${preferred.itrFormReason}`);
    doc.moveDown();

    // ── Take-Home Salary (salaried only) ─────────────────────────────────────
    const isSalaried = input.userType === 'salaried';
    if (isSalaried && input.salaryIncome) {
      const s = input.salaryIncome;
      const grossSalary =
        (s.basicSalary ?? 0) + (s.hra ?? 0) + (s.lta ?? 0) +
        (s.specialAllowance ?? 0) + (s.otherAllowances ?? 0);
      if (grossSalary > 0) {
        const epf = s.epfContribution ?? 0;
        const pt = s.professionalTax ?? 0;
        const newTax = result.newRegime.totalTaxLiability;
        const oldTax = result.oldRegime.totalTaxLiability;
        const newTH = grossSalary - newTax - epf - pt;
        const oldTH = grossSalary - oldTax - epf - pt;
        const showBoth = !input.regimeChoice;

        doc.fontSize(13).font('Helvetica-Bold').fillColor('#065f46').text('Estimated Take-Home Salary');
        doc.fontSize(10).font('Helvetica').fillColor('#374151');
        doc.text(`Gross Annual Salary:          ${inr(grossSalary)}`);
        if (epf > 0) doc.text(`EPF Employee Contribution:   − ${inr(epf)}`);
        if (pt > 0)  doc.text(`Professional Tax:            − ${inr(pt)}`);
        doc.moveDown(0.3);

        if (showBoth) {
          doc.font('Helvetica-Bold').fillColor('#1d4ed8').text('New Regime:');
          doc.font('Helvetica').fillColor('#374151');
          doc.text(`  Income Tax:                 − ${inr(newTax)}`);
          doc.font('Helvetica-Bold').fillColor('#065f46');
          doc.text(`  Net Annual Take-Home:        ${inr(newTH)}`);
          doc.text(`  Monthly Take-Home:           ${inr(newTH / 12)}`);
          doc.moveDown(0.3);
          doc.font('Helvetica-Bold').fillColor('#b45309').text('Old Regime:');
          doc.font('Helvetica').fillColor('#374151');
          doc.text(`  Income Tax:                 − ${inr(oldTax)}`);
          doc.font('Helvetica-Bold').fillColor('#065f46');
          doc.text(`  Net Annual Take-Home:        ${inr(oldTH)}`);
          doc.text(`  Monthly Take-Home:           ${inr(oldTH / 12)}`);
          doc.moveDown(0.3);
          const betterTH = newTH >= oldTH ? 'New Regime' : 'Old Regime';
          const diff = Math.abs(newTH - oldTH);
          doc.font('Helvetica-Bold').fillColor('#065f46')
            .text(`${betterTH} gives ${inr(diff)} more in hand annually (${inr(diff / 12)} / month).`);
        } else {
          const regime = input.regimeChoice!;
          const taxLiability = regime === 'new' ? newTax : oldTax;
          const th = regime === 'new' ? newTH : oldTH;
          doc.font('Helvetica').fillColor('#374151');
          doc.text(`Income Tax (${regime === 'new' ? 'New' : 'Old'} Regime): − ${inr(taxLiability)}`);
          doc.font('Helvetica-Bold').fillColor('#065f46');
          doc.text(`Net Annual Take-Home:        ${inr(th)}`);
          doc.text(`Monthly Take-Home:           ${inr(th / 12)}`);
        }

        doc.fontSize(8).font('Helvetica').fillColor('#9ca3af')
          .text('Indicative only. Actual in-hand may differ based on employer perks, gratuity, bonus, and TDS timing.');
        doc.moveDown();
        doc.fillColor('#111827');
      }
    }

    // ── Tax-Saving Tips ───────────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text('Tax-Saving Tips');
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    preferred.taxSavingTips.forEach((tip, i) => {
      doc.text(`${i + 1}. ${tip}`);
    });
    doc.moveDown();

    // ── Detailed Explanation ──────────────────────────────────────────────────
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text('Why This Recommendation?');
    doc.fontSize(10).font('Helvetica').fillColor('#374151');
    result.recommendation.detailedExplanation.forEach((line) => {
      doc.text(`• ${line}`);
    });
    doc.moveDown();

    // ── Capital Gains Details ─────────────────────────────────────────────────
    if (preferred.capitalGainsTax.details.length > 0) {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#111827').text('Capital Gains Breakdown');
      doc.fontSize(10).font('Helvetica').fillColor('#374151');
      preferred.capitalGainsTax.details.forEach((d) => doc.text(`• ${d}`));
      doc.moveDown();
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    doc.fontSize(9).fillColor('#9ca3af')
      .text(
        'This report is generated for guidance only. Consult a Chartered Accountant for final tax filing. ' +
        'File your returns at incometax.gov.in',
        { align: 'center' }
      );

    doc.end();
  });
}
