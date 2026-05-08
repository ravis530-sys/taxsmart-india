/**
 * TDS / Tax-Paid File Parser
 * Supports Excel (.xlsx / .xls), Word (.docx), and PDF files.
 *
 * Handles documents from:
 *  - Form 26AS (TRACES portal download)
 *  - AIS – Annual Information Statement (ITD portal)
 *  - Form 16 / 16A (employer / deductor TDS certificates)
 *  - Bank TDS certificates (FD interest)
 *  - Broker TDS statements (dividends, capital gains TDS)
 *  - Challan receipts for Advance Tax / Self-Assessment Tax (Challan 280)
 */

import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface ParsedTDSEntry {
  source: string;
  amount: number;
  tdsDeducted: number;
}

export interface ParsedTaxPaid {
  tdsEntries: ParsedTDSEntry[];
  advanceTaxQ1: number;
  advanceTaxQ2: number;
  advanceTaxQ3: number;
  advanceTaxQ4: number;
  selfAssessmentTax: number;
  summary: string;
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function containsAny(text: string, keys: string[]): boolean {
  const n = norm(text);
  return keys.some((k) => n.includes(norm(k)));
}

function extractNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    let s = val.replace(/[₹,\s]/g, '');
    if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Scan right of a cell for the first non-zero number within `lookahead` cells */
function scanRight(row: unknown[], fromIdx: number, lookahead = 4): number {
  for (let i = fromIdx + 1; i < Math.min(fromIdx + 1 + lookahead, row.length); i++) {
    const n = extractNumber(row[i]);
    if (n !== 0) return n;
  }
  return 0;
}

const TDS_SRC_LABELS: Record<string, string> = {
  employer: 'Employer (Salary)',
  salary: 'Employer (Salary)',
  bank: 'Bank (FD/Savings)',
  fd: 'Bank FD Interest',
  savings: 'Bank Savings Interest',
  dividend: 'Dividend',
  broker: 'Broker (Equity/MF)',
  mutual: 'Mutual Fund',
  interest: 'Interest Income',
  rent: 'Rent (194I)',
  professional: 'Professional Fees (194J)',
  contractor: 'Contractor (194C)',
  commission: 'Commission (194H)',
  property: 'Property Sale (194IA)',
  insurance: 'Insurance (194DA)',
  pension: 'Pension',
  epf: 'EPF Withdrawal (192A)',
  lottery: 'Lottery/Prize (194B)',
  gaming: 'Online Gaming (194BA)',
};

function guessSource(text: string): string {
  const t = text.toLowerCase();
  for (const [key, label] of Object.entries(TDS_SRC_LABELS)) {
    if (t.includes(key)) return label;
  }
  return text.trim().slice(0, 40) || 'TDS Credit';
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Parsing
// ─────────────────────────────────────────────────────────────────────────────

type Row = unknown[];

interface RawEntry {
  source: string;
  amount: number;
  tdsDeducted: number;
}

interface AdvanceTax {
  q1: number; q2: number; q3: number; q4: number;
  selfAssessment: number;
}

/**
 * Try to parse a Form 26AS–style table.
 * Part A: TDS on salary / other payments
 * Looks for: Deductor Name | Section | Amount Paid | TDS Deposited
 */
function parse26ASTable(rows: Row[], sheetName: string): RawEntry[] {
  const entries: RawEntry[] = [];

  for (let ri = 0; ri < rows.length - 1; ri++) {
    const header = rows[ri].map((c) => (c == null ? '' : String(c)));
    const hText = header.join(' ').toLowerCase();

    // Needs "deductor" or "deductee" plus "tds" or "tax deducted"
    if (!hText.includes('deduct')) continue;
    if (!containsAny(hText, ['tds', 'tax deducted', 'amount of tds'])) continue;

    // Find column indices
    const nameCol = header.findIndex((c) =>
      containsAny(c, ['deductor name', 'name of deductor', 'employer', 'name of employer', 'deductor'])
    );
    const amtCol = header.findIndex((c) =>
      containsAny(c, ['amount paid', 'income paid', 'gross amount', 'total amount', 'amount credited'])
    );
    const tdsCol = header.findIndex((c) =>
      containsAny(c, ['tds deposited', 'tax deducted', 'tds deducted', 'amount of tds', 'tds amount', 'tax deposited'])
    );

    if (tdsCol === -1) continue;

    for (let di = ri + 1; di < rows.length; di++) {
      const row = rows[di];
      if (!row || row.every((c) => c == null || String(c).trim() === '')) break;

      const tdsVal = extractNumber(row[tdsCol]);
      if (tdsVal === 0) continue;

      const amtVal = amtCol !== -1 ? extractNumber(row[amtCol]) : 0;
      const nameVal = nameCol !== -1 ? String(row[nameCol] ?? '') : sheetName;

      entries.push({
        source: guessSource(nameVal || sheetName),
        amount: amtVal,
        tdsDeducted: tdsVal,
      });
    }
    // Don't break — there may be multiple tables (Part A, Part B etc.)
  }

  return entries;
}

/**
 * Generic table parser: any table with a TDS column.
 * Covers bank statements, broker TDS sheets, etc.
 */
function parseGenericTDSTable(rows: Row[], sheetName: string): RawEntry[] {
  const entries: RawEntry[] = [];

  for (let ri = 0; ri < rows.length - 1; ri++) {
    const header = rows[ri].map((c) => (c == null ? '' : String(c)));

    const tdsCol = header.findIndex((c) =>
      containsAny(c, ['tds', 'tax deducted', 'tax withheld', 'tds amount', 'tds deducted'])
    );
    if (tdsCol === -1) continue;

    const amtCol = header.findIndex((c) =>
      containsAny(c, ['amount', 'income', 'interest', 'dividend', 'payment', 'gross'])
    );
    const srcCol = header.findIndex((c) =>
      containsAny(c, ['source', 'name', 'description', 'bank', 'deductor', 'payer', 'particulars'])
    );

    for (let di = ri + 1; di < rows.length; di++) {
      const row = rows[di];
      if (!row || row.every((c) => c == null || String(c).trim() === '')) break;

      const tdsVal = extractNumber(row[tdsCol]);
      if (tdsVal === 0) continue;

      const amtVal = amtCol !== -1 ? extractNumber(row[amtCol]) : 0;
      const srcText = srcCol !== -1 ? String(row[srcCol] ?? '') : sheetName;

      entries.push({
        source: guessSource(srcText),
        amount: amtVal,
        tdsDeducted: tdsVal,
      });
    }
  }

  return entries;
}

/**
 * Key-value scan: finds "TDS: 50,000" or "Tax Deducted: ₹50,000" patterns in any row.
 * Also finds advance tax / challan info.
 */
function parseKeyValueTDS(rows: Row[], sheetName: string): { entries: RawEntry[]; advance: AdvanceTax } {
  const entries: RawEntry[] = [];
  const advance: AdvanceTax = { q1: 0, q2: 0, q3: 0, q4: 0, selfAssessment: 0 };

  for (const row of rows) {
    const cells = row.map((c) => (c == null ? '' : String(c)));

    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci].toLowerCase();

      // Advance tax quarters
      if (/advance\s*tax.*q1|q1.*advance|15\s*jun|june\s*15/.test(cell)) {
        const v = scanRight(row, ci);
        if (v) advance.q1 += v;
        continue;
      }
      if (/advance\s*tax.*q2|q2.*advance|15\s*sep|sept?ember\s*15/.test(cell)) {
        const v = scanRight(row, ci);
        if (v) advance.q2 += v;
        continue;
      }
      if (/advance\s*tax.*q3|q3.*advance|15\s*dec|december\s*15/.test(cell)) {
        const v = scanRight(row, ci);
        if (v) advance.q3 += v;
        continue;
      }
      if (/advance\s*tax.*q4|q4.*advance|15\s*mar|march\s*15|advance\s*tax\s*paid/.test(cell)) {
        const v = scanRight(row, ci);
        if (v) advance.q4 += v;
        continue;
      }

      // Self-assessment tax / Challan 280
      if (/self.?assessment|challan\s*280|balance\s*tax/.test(cell)) {
        const v = scanRight(row, ci);
        if (v) advance.selfAssessment += v;
        continue;
      }

      // TDS keyword
      const isTDS = containsAny(cell, [
        'tds deducted', 'tax deducted', 'tds amount', 'tds credit',
        'tax withheld', 'total tds', 'tds deposited',
      ]);
      if (!isTDS) continue;

      const v = scanRight(row, ci);
      if (!v) continue;

      // Try to get amount from the row context
      const rowText = cells.join(' ');
      const amtFromRow = (() => {
        for (let ni = ci + 1; ni < Math.min(ci + 6, cells.length); ni++) {
          const n = extractNumber(row[ni]);
          if (n !== 0 && n !== v) return n;
        }
        return 0;
      })();

      entries.push({
        source: guessSource(cells.slice(0, ci).join(' ') || rowText || sheetName),
        amount: amtFromRow,
        tdsDeducted: v,
      });
    }
  }

  return { entries, advance };
}

function parseExcelBuffer(buffer: Buffer): { entries: RawEntry[]; advance: AdvanceTax } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const allEntries: RawEntry[] = [];
  const advance: AdvanceTax = { q1: 0, q2: 0, q3: 0, q4: 0, selfAssessment: 0 };

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    const form26 = parse26ASTable(rows, sheetName);
    const generic = parseGenericTDSTable(rows, sheetName);
    const kv = parseKeyValueTDS(rows, sheetName);

    // Merge advance tax from kv
    advance.q1 += kv.advance.q1;
    advance.q2 += kv.advance.q2;
    advance.q3 += kv.advance.q3;
    advance.q4 += kv.advance.q4;
    advance.selfAssessment += kv.advance.selfAssessment;

    // Pick best table strategy
    const tableEntries = form26.length >= generic.length ? form26 : generic;
    const combined = tableEntries.length > 0 ? tableEntries : kv.entries;
    allEntries.push(...combined);
  }

  return { entries: allEntries, advance };
}

// ─────────────────────────────────────────────────────────────────────────────
// Text (Word + PDF) Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseText(text: string): { entries: RawEntry[]; advance: AdvanceTax } {
  const entries: RawEntry[] = [];
  const advance: AdvanceTax = { q1: 0, q2: 0, q3: 0, q4: 0, selfAssessment: 0 };

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Patterns used in Form 26AS text exports:
  // "EMPLOYER NAME  Section 192   ₹8,00,000   ₹80,000"
  // "TDS on salary: 80000"
  // "Advance Tax (Q1) – 15 Jun: ₹25,000"

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lower = line.toLowerCase();

    // ── Advance Tax ──────────────────────────────────────────────────────────
    if (/advance\s*tax/i.test(line)) {
      // Try to find quarter
      const amtMatch = line.match(/[₹]?\s*([\d,]+(?:\.\d+)?)/);
      if (amtMatch) {
        const v = extractNumber(amtMatch[1]);
        if (/q1|jun/i.test(line)) advance.q1 += v;
        else if (/q2|sep/i.test(line)) advance.q2 += v;
        else if (/q3|dec/i.test(line)) advance.q3 += v;
        else if (/q4|mar/i.test(line)) advance.q4 += v;
        else advance.q4 += v; // default to Q4
      }
      continue;
    }

    // ── Self-assessment / Challan 280 ────────────────────────────────────────
    if (/self.?assessment|challan\s*280|balance\s*tax/i.test(line)) {
      const amtMatch = line.match(/[₹]?\s*([\d,]+(?:\.\d+)?)/);
      if (amtMatch) advance.selfAssessment += extractNumber(amtMatch[1]);
      continue;
    }

    // ── Explicit TDS lines ───────────────────────────────────────────────────
    // Pattern: "Tax Deducted / TDS: ₹1,20,000"
    const tdsLabelMatch = line.match(
      /(?:tds|tax\s+deducted(?:\s+at\s+source)?|tds\s+(?:deducted|deposited|amount|credit))\s*[:\-–]\s*[₹]?\s*([\d,]+(?:\.\d+)?)/i
    );
    if (tdsLabelMatch) {
      const tdsAmt = extractNumber(tdsLabelMatch[1]);
      if (tdsAmt > 0) {
        // Look back for source context
        const context = lines.slice(Math.max(0, li - 3), li).join(' ');
        entries.push({
          source: guessSource(context || line),
          amount: 0,
          tdsDeducted: tdsAmt,
        });
      }
      continue;
    }

    // ── Form 26AS Part A row pattern ─────────────────────────────────────────
    // "EMPLOYER CO LTD  192  8500000  850000  850000  Booked"
    // Detect lines with ≥3 numbers on a line that likely has a section code
    if (/\b19[0-9][A-Z]?\b/.test(line)) {
      const nums = [...line.matchAll(/[\d,]+(?:\.\d+)?/g)]
        .map((m) => extractNumber(m[0]))
        .filter((n) => n > 0);

      if (nums.length >= 2) {
        // Heuristic: largest number = amount paid, second largest near end = TDS
        const sorted = [...nums].sort((a, b) => b - a);
        const amount = sorted[0];
        const tds = sorted[1];

        if (tds > 0 && tds <= amount) {
          // Extract deductor name (text before the section code)
          const nameMatch = line.match(/^([A-Z][A-Za-z0-9 &.,\-]+?)\s+(?:19[0-9][A-Z]?\b)/);
          const source = nameMatch ? guessSource(nameMatch[1]) : guessSource(line);
          entries.push({ source, amount, tdsDeducted: tds });
        }
      }
    }
  }

  // If still empty, do a broad scan for any "TDS ₹X" amounts in the text
  if (entries.length === 0) {
    const globalMatches = [
      ...text.matchAll(
        /(?:tds|tax\s+deducted)\s*[:\-–]?\s*₹?\s*([\d,]+)/gi
      ),
    ];
    for (const m of globalMatches) {
      const v = extractNumber(m[1]);
      if (v > 0) {
        const ctx = text.slice(Math.max(0, m.index! - 80), m.index!);
        entries.push({ source: guessSource(ctx || 'TDS Credit'), amount: 0, tdsDeducted: v });
      }
    }
  }

  return { entries, advance };
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge duplicate sources
// ─────────────────────────────────────────────────────────────────────────────

function mergeEntries(entries: RawEntry[]): ParsedTDSEntry[] {
  const map = new Map<string, ParsedTDSEntry>();

  for (const e of entries) {
    const key = norm(e.source);
    const existing = map.get(key);
    if (existing) {
      existing.amount += e.amount;
      existing.tdsDeducted += e.tdsDeducted;
    } else {
      map.set(key, { source: e.source, amount: e.amount, tdsDeducted: e.tdsDeducted });
    }
  }

  return [...map.values()].filter((e) => e.tdsDeducted > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build result
// ─────────────────────────────────────────────────────────────────────────────

function buildResult(
  entries: RawEntry[],
  advance: AdvanceTax,
  warnings: string[]
): ParsedTaxPaid {
  const tdsEntries = mergeEntries(entries);
  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

  const parts: string[] = [];
  if (tdsEntries.length > 0) {
    const total = tdsEntries.reduce((s, e) => s + e.tdsDeducted, 0);
    parts.push(`TDS: ${fmt(total)} across ${tdsEntries.length} source(s)`);
  }
  if (advance.q1 || advance.q2 || advance.q3 || advance.q4) {
    const at = advance.q1 + advance.q2 + advance.q3 + advance.q4;
    parts.push(`Advance Tax: ${fmt(at)}`);
  }
  if (advance.selfAssessment) {
    parts.push(`Self-Assessment Tax: ${fmt(advance.selfAssessment)}`);
  }

  const summary = parts.length > 0 ? `Parsed: ${parts.join(' | ')}` : 'No TDS / tax payment data found.';

  if (tdsEntries.length === 0 && !advance.q1 && !advance.q2 && !advance.q3 && !advance.q4 && !advance.selfAssessment) {
    warnings.push('No recognizable TDS or advance tax data found. The format may not be supported — please enter values manually.');
  }

  return {
    tdsEntries,
    advanceTaxQ1: advance.q1,
    advanceTaxQ2: advance.q2,
    advanceTaxQ3: advance.q3,
    advanceTaxQ4: advance.q4,
    selfAssessmentTax: advance.selfAssessment,
    summary,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export async function parseTDSFile(
  buffer: Buffer,
  filename: string,
  mimetype: string,
): Promise<ParsedTaxPaid> {
  const warnings: string[] = [];
  const ext = filename.toLowerCase().split('.').pop();

  let entries: RawEntry[] = [];
  let advance: AdvanceTax = { q1: 0, q2: 0, q3: 0, q4: 0, selfAssessment: 0 };

  if (ext === 'xlsx' || ext === 'xls') {
    ({ entries, advance } = parseExcelBuffer(buffer));
  } else if (ext === 'docx' || mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const { value: text, messages } = await mammoth.extractRawText({ buffer });
    if (messages.length > 0) warnings.push('Some content in the Word document could not be read.');
    ({ entries, advance } = parseText(text));
  } else if (ext === 'pdf' || mimetype === 'application/pdf') {
    // pdf-parse v2 class-based API
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PDFParse } = require('pdf-parse') as {
      PDFParse: new (opts: object) => { getText: () => Promise<{ text: string }> };
    };
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    ({ entries, advance } = parseText(parsed.text));
  } else {
    throw new Error('Unsupported file type. Please upload Excel (.xlsx), Word (.docx), or PDF (.pdf).');
  }

  return buildResult(entries, advance, warnings);
}
