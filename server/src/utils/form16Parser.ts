/**
 * Form 16 Parser
 * Supports PDF and DOCX (Word) files.
 * Extracts salary components, deductions, and TDS info from the raw text.
 *
 * Form 16 is an employer-issued TDS certificate (Sec 203 IT Act).
 * Part A: TDS summary (TRACES-generated)
 * Part B: Salary & deductions breakdown (employer-generated, varies by payroll software)
 */

export interface Form16Data {
  // Salary components
  basicSalary?: number;
  hra?: number;
  lta?: number;
  specialAllowance?: number;
  otherAllowances?: number;
  professionalTax?: number;
  epfContribution?: number;

  // Summary figures
  grossSalary?: number;    // Sec 17(1) figure
  taxableSalary?: number;  // after deductions
  totalTDS?: number;       // total tax deducted

  // Metadata
  employerName?: string;
  employeePAN?: string;
  financialYear?: string;

  // Which fields were successfully parsed
  parsedFields: string[];
  rawSnippet?: string; // first 500 chars of extracted text (for debugging)
}

// ──────────────────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────────────────

export async function parseForm16(buffer: Buffer, mimeType: string): Promise<Form16Data> {
  let text = '';

  if (mimeType === 'application/pdf') {
    // pdf-parse v2 uses a class-based API: new PDFParse({ data }) then .getText()
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require('pdf-parse') as { PDFParse: new (opts: object) => { getText: () => Promise<{ text: string }> } };
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    text = parsed.text;
  } else {
    // DOC / DOCX — mammoth handles both
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mammoth = require('mammoth') as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  }

  if (!text || text.trim().length < 50) {
    throw new Error('Could not extract readable text from the document');
  }

  return extractForm16Data(text);
}

// ──────────────────────────────────────────────────────────────────────────────
// Core extractor
// ──────────────────────────────────────────────────────────────────────────────

function extractForm16Data(rawText: string): Form16Data {
  // Normalise: collapse whitespace runs, remove non-breaking spaces
  const text = rawText.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ');

  const result: Form16Data = { parsedFields: [] };
  result.rawSnippet = text.slice(0, 500);

  // ── Metadata ──────────────────────────────────────────────────────────────

  const employerMatch = text.match(
    /(?:name\s+(?:and\s+address\s+)?of\s+(?:the\s+)?employer|employer\s*[:\-])\s*([A-Z][A-Za-z0-9 &.,()-]{3,60})/i,
  );
  if (employerMatch) result.employerName = employerMatch[1].trim();

  const panMatch = text.match(/PAN\s+of\s+(?:the\s+)?(?:employee|deductee)\s*[:\-]?\s*([A-Z]{5}\d{4}[A-Z])/i);
  if (panMatch) result.employeePAN = panMatch[1].trim();

  const fyMatch = text.match(/(?:financial\s+year|F\.?Y\.?)\s*[:\-]?\s*(20\d{2}[-–]\d{2,4})/i);
  if (fyMatch) result.financialYear = fyMatch[1].trim();

  // ── Gross Salary — Sec 17(1) ──────────────────────────────────────────────
  // Looks for the line containing "17(1)" or "Gross Salary" with a trailing number
  const sec171 = extractAfterLabel(text, [
    /salary\s+as\s+per\s+(?:provisions\s+(?:contained\s+)?in\s+)?sec(?:tion)?\.?\s*17\s*\(1\)/i,
    /(?:^|\n)\s*gross\s+salary\b/im,
  ]);
  if (sec171 !== undefined) {
    result.grossSalary = sec171;
    result.parsedFields.push('grossSalary');
  }

  // ── Basic Salary ──────────────────────────────────────────────────────────
  const basic = extractAfterLabel(text, [
    /(?:^|\n)\s*basic\s+(?:salary|pay)\b/im,
    /(?:^|\n)\s*basic\b(?!\s+exemption)/im,
  ]);
  if (basic !== undefined) {
    result.basicSalary = basic;
    result.parsedFields.push('basicSalary');
  }

  // ── HRA (amount received — not the exempt portion) ────────────────────────
  // First try to find "HRA Received" / "House Rent Allowance" as a salary component
  // (distinguished from the Sec 10(13A) exemption line)
  const hraReceived = extractAfterLabel(text, [
    /(?:^|\n)\s*(?:house\s+rent\s+allowance|h\.?r\.?a\.?)\s+(?:received|paid)?\b(?!.*exempt)/im,
  ]);
  const hraExempt = extractAfterLabel(text, [
    /(?:house\s+rent\s+allowance|h\.?r\.?a\.?).*?(?:10\s*\(13A?\)|exempt)/i,
    /sec(?:tion)?\.?\s*10\s*\(13A?\)\s*[-–]?\s*(?:house\s+rent\s+allowance|h\.?r\.?a\.?)/i,
  ]);

  // If we have both, the one not marked exempt is the received amount
  const hra = hraReceived ?? (hraExempt !== undefined && basic !== undefined ? undefined : hraExempt);
  if (hra !== undefined) {
    result.hra = hra;
    result.parsedFields.push('hra');
  }

  // ── LTA ───────────────────────────────────────────────────────────────────
  const lta = extractAfterLabel(text, [
    /(?:^|\n)\s*(?:leave\s+travel\s+(?:allowance|concession)|l\.?t\.?[ac]\.?)\b/im,
  ]);
  if (lta !== undefined) {
    result.lta = lta;
    result.parsedFields.push('lta');
  }

  // ── Special Allowance ─────────────────────────────────────────────────────
  const special = extractAfterLabel(text, [
    /(?:^|\n)\s*special\s+allowance\b/im,
  ]);
  if (special !== undefined) {
    result.specialAllowance = special;
    result.parsedFields.push('specialAllowance');
  }

  // ── Other Allowances (catch-all) ──────────────────────────────────────────
  const otherAllw = extractAfterLabel(text, [
    /(?:^|\n)\s*other\s+allowances?\b(?!\s*income)/im,
    /(?:^|\n)\s*miscellaneous\s+allowance\b/im,
  ]);
  if (otherAllw !== undefined) {
    result.otherAllowances = otherAllw;
    result.parsedFields.push('otherAllowances');
  }

  // ── Professional Tax ──────────────────────────────────────────────────────
  const pt = extractAfterLabel(text, [
    /(?:professional\s+tax|tax\s+on\s+employment)\b.*?(?:sec(?:tion)?\.?\s*16\s*\(iii\))?/i,
    /sec(?:tion)?\.?\s*16\s*\(iii\)/i,
  ]);
  if (pt !== undefined) {
    result.professionalTax = pt;
    result.parsedFields.push('professionalTax');
  }

  // ── EPF Employee Contribution ─────────────────────────────────────────────
  const epf = extractAfterLabel(text, [
    /employee['s]*\s+contribution\s+(?:to\s+)?(?:epf|p\.?f\.?|provident\s+fund)\b/i,
    /(?:^|\n)\s*p\.?f\.?\s+(?:employee|deduction)\b/im,
    /(?:^|\n)\s*provident\s+fund\b/im,
  ]);
  if (epf !== undefined) {
    result.epfContribution = epf;
    result.parsedFields.push('epfContribution');
  }

  // ── Total TDS Deducted ────────────────────────────────────────────────────
  const tds = extractAfterLabel(text, [
    /total\s+(?:amount\s+of\s+)?tax\s+deducted\b/i,
    /(?:^|\n)\s*total\s+tds\b/im,
    /tax\s+deducted\s+at\s+source.*?total/i,
  ]);
  if (tds !== undefined) {
    result.totalTDS = tds;
    result.parsedFields.push('totalTDS');
  }

  // ── Taxable Salary (income chargeable under "Salaries") ──────────────────
  const taxable = extractAfterLabel(text, [
    /income\s+chargeable\s+under\s+(?:the\s+head\s+)?"?salaries"?/i,
    /taxable\s+salary\b/i,
  ]);
  if (taxable !== undefined) {
    result.taxableSalary = taxable;
    result.parsedFields.push('taxableSalary');
  }

  // ── Fallback: if no basic but we have grossSalary ─────────────────────────
  // Estimate basic as 40% of gross (rough rule of thumb) — only if nothing extracted
  if (result.grossSalary && !result.basicSalary && result.parsedFields.length <= 2) {
    result.basicSalary = Math.round(result.grossSalary * 0.4);
    result.parsedFields.push('basicSalary (estimated)');
  }

  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Try each regex in order; return the first Indian-formatted number found
 * in the ~200 chars following the match.
 * Also handles "Rs." / "₹" prefixes and comma-separated Indian numbers.
 */
function extractAfterLabel(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const afterLabel = text.slice(match.index! + match[0].length, match.index! + match[0].length + 200);
    // Match optional Rs./₹ prefix then a number
    const numMatch = afterLabel.match(/(?:Rs\.?\s*|₹\s*)?(\d[\d,]*(?:\.\d{1,2})?)/);
    if (numMatch) {
      const n = parseIndianNumber(numMatch[1]);
      if (n > 0) return n;
    }
  }
  return undefined;
}

/** Handle both international (1,200,000) and Indian (12,00,000) comma formats */
function parseIndianNumber(s: string): number {
  const stripped = s.replace(/,/g, '');
  return parseFloat(stripped) || 0;
}
