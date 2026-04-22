import { Router, Request, Response } from 'express';
import { calculateTax } from '../tax/calculator';
import { TaxInput } from '../tax/types';
import { generateTaxReport } from '../utils/pdfReport';
import { validate, calculateValidation } from '../middleware/validate';

const router = Router();

/**
 * POST /api/calculate
 * Body: TaxInput JSON
 * Returns: TaxCalculationResult JSON
 */
router.post(
  '/',
  validate(calculateValidation),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const input: TaxInput = req.body as TaxInput;

      // Sanitise: ensure numeric fields are numbers (not strings from JSON)
      sanitiseInput(input);

      const result = calculateTax(input);
      res.json({ success: true, data: result });
    } catch (err) {
      console.error('Calculation error:', err);
      res.status(500).json({ success: false, error: 'Tax calculation failed' });
    }
  }
);

/**
 * POST /api/calculate/report
 * Body: { taxInput: TaxInput, name: string }
 * Returns: PDF binary
 */
router.post('/report', async (req: Request, res: Response): Promise<void> => {
  try {
    const { taxInput, name }: { taxInput: TaxInput; name: string } = req.body;
    if (!taxInput || !name) {
      res.status(400).json({ error: 'taxInput and name are required' });
      return;
    }

    sanitiseInput(taxInput);
    const result = calculateTax(taxInput);
    const pdfBuffer = await generateTaxReport(taxInput, result, name);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="tax-report-${taxInput.assessmentYear}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ success: false, error: 'PDF generation failed' });
  }
});

/**
 * Recursively convert string numbers to actual numbers to handle JSON edge cases.
 */
function sanitiseInput(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return;
  sanitiseObject(obj as Record<string, unknown>);
}

function sanitiseObject(obj: Record<string, unknown>): void {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string' && /^\d+(\.\d+)?$/.test(val)) {
      obj[key] = parseFloat(val);
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitiseObject(val as Record<string, unknown>);
    } else if (Array.isArray(val)) {
      val.forEach((item) => {
        if (item && typeof item === 'object') sanitiseInput(item as Record<string, unknown>);
      });
    }
  }
}

export default router;
