/**
 * Capital Gains File Parser
 * Parses Excel (.xlsx / .xls) and Word (.docx) broker statements
 * and extracts capital gains data for Indian tax calculations.
 *
 * Supports common formats from: Zerodha, Groww, Kuvera, CAMS,
 * Angel One, Upstox, INDmoney, 5paisa, Motilal Oswal, Paytm Money.
 */

import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

export interface ParsedCapitalGainsResult {
  equityGains: Array<{
    type: 'indian_listed' | 'equity_mf' | 'us_stocks' | 'indian_unlisted';
    shortTermGain: number;
    longTermGain: number;
    tdsDeducted: number;
  }>;
  debtMFGains: { shortTermGain: number; longTermGain: number };
  bondGains: Array<{ interestIncome: number; capitalGainOnSale: number; isLongTerm: boolean }>;
  summary: string;
  warnings: string[];
}

type AssetClass =
  | 'indian_listed'
  | 'equity_mf'
  | 'debt_mf'
  | 'bond'
  | 'us_stocks'
  | 'indian_unlisted'
  | 'unknown';

interface GainEntry {
  assetClass: AssetClass;
  stcg: number;
  ltcg: number;
  tds: number;
  source: string; // for debugging / summary
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
    // Handle "(50,000)" → -50000 and "₹1,50,000" → 150000
    let s = val.replace(/[₹,\s]/g, '');
    if (s.startsWith('(') && s.endsWith(')')) {
      s = '-' + s.slice(1, -1);
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

const STCG_KEYWORDS = [
  'stcg', 'short term', 'short-term', 'shortterm',
  'st gain', 'st.gain', 'st capital', 'short term gain',
  'short term capital gain', 'short-term capital gain',
];
const LTCG_KEYWORDS = [
  'ltcg', 'long term', 'long-term', 'longterm',
  'lt gain', 'lt.gain', 'lt capital', 'long term gain',
  'long term capital gain', 'long-term capital gain',
];
const EQUITY_KEYWORDS = [
  'equity', 'listed stock', 'indian stock', 'indian equity',
  'nse', 'bse', 'listed share', 'indian listed',
];
const EQUITY_MF_KEYWORDS = [
  'equity mf', 'equity mutual fund', 'elss', 'equity fund',
  'equity scheme', 'growth fund',
];
const DEBT_MF_KEYWORDS = [
  'debt mf', 'debt mutual fund', 'debt fund', 'liquid fund',
  'money market', 'overnight fund', 'hybrid', 'arbitrage fund',
  'debt scheme', 'income fund', 'gilt', 'ultra short',
];
const BOND_KEYWORDS = [
  'bond', 'ncd', 'debenture', 'sgb', 'g-sec', 'gsec',
  'government securities', 'sovereign gold', 't-bill', 'treasury',
];
const US_STOCK_KEYWORDS = [
  'us stock', 'us equity', 'foreign stock', 'international equity',
  'vested', 'indmoney', 'us shares', 'foreign listed', 'adr', 'gdr',
];
const MF_GENERAL_KEYWORDS = ['mutual fund', 'mf ', ' mf', 'fund'];

function detectAssetClass(text: string): AssetClass {
  const t = text.toLowerCase();
  if (containsAny(t, US_STOCK_KEYWORDS)) return 'us_stocks';
  if (containsAny(t, BOND_KEYWORDS)) return 'bond';
  if (containsAny(t, DEBT_MF_KEYWORDS)) return 'debt_mf';
  if (containsAny(t, EQUITY_MF_KEYWORDS)) return 'equity_mf';
  if (containsAny(t, EQUITY_KEYWORDS)) return 'indian_listed';
  if (containsAny(t, MF_GENERAL_KEYWORDS)) return 'equity_mf'; // default MF → equity MF
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Parsing
// ─────────────────────────────────────────────────────────────────────────────

type Row = unknown[];

/**
 * Strategy 1: Find adjacent (label, value) pairs on the same row.
 * Handles patterns like: | STCG | ₹50,000 | or | Short Term Gain | 50000 |
 */
function extractKeyValueGains(rows: Row[], sheetName: string): GainEntry[] {
  const entries: GainEntry[] = [];
  let currentAsset: AssetClass = 'unknown';

  for (const row of rows) {
    const cells = row.map((c) => (c == null ? '' : String(c)));
    const rowText = cells.join(' ');

    // Update asset class context when we encounter a section header
    const assetFromRow = detectAssetClass(rowText);
    if (assetFromRow !== 'unknown') {
      currentAsset = assetFromRow;
    }
    // Also detect from sheet name (lower priority)
    if (currentAsset === 'unknown') {
      currentAsset = detectAssetClass(sheetName);
    }

    // Scan each cell for STCG / LTCG label, then look at adjacent cells for numbers
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci];
      if (!cell.trim()) continue;

      const isStcg = containsAny(cell, STCG_KEYWORDS);
      const isLtcg = containsAny(cell, LTCG_KEYWORDS);
      if (!isStcg && !isLtcg) continue;

      // Look at the next few cells for a number
      let value = 0;
      for (let ni = ci + 1; ni < Math.min(ci + 4, cells.length); ni++) {
        const candidate = extractNumber(row[ni]);
        if (candidate !== 0) {
          value = candidate;
          break;
        }
      }
      if (value === 0) continue;

      // Asset context: prefer same cell or row context
      const cellAsset = detectAssetClass(cell + ' ' + rowText);
      const asset = cellAsset !== 'unknown' ? cellAsset : currentAsset !== 'unknown' ? currentAsset : 'indian_listed';

      // Find or create entry for this asset
      let entry = entries.find((e) => e.assetClass === asset);
      if (!entry) {
        entry = { assetClass: asset, stcg: 0, ltcg: 0, tds: 0, source: sheetName };
        entries.push(entry);
      }

      if (isStcg) entry.stcg += value;
      if (isLtcg) entry.ltcg += value;
    }
  }

  return entries;
}

/**
 * Strategy 2: Table with header row.
 * Finds rows where columns match "asset type", "stcg", "ltcg" and reads data rows below.
 */
function extractTableGains(rows: Row[], sheetName: string): GainEntry[] {
  const entries: GainEntry[] = [];

  for (let ri = 0; ri < rows.length - 1; ri++) {
    const headerCells = rows[ri].map((c) => (c == null ? '' : String(c)));

    // Find header row: must have at least one STCG/LTCG column
    const stcgCol = headerCells.findIndex((c) => containsAny(c, STCG_KEYWORDS));
    const ltcgCol = headerCells.findIndex((c) => containsAny(c, LTCG_KEYWORDS));
    const tdsCol = headerCells.findIndex((c) => norm(c).includes('tds'));

    if (stcgCol === -1 && ltcgCol === -1) continue;

    // Find the asset type column (first non-numeric column before the gain columns)
    const gainColMin = Math.min(
      stcgCol !== -1 ? stcgCol : 999,
      ltcgCol !== -1 ? ltcgCol : 999,
    );
    const assetCol = headerCells.slice(0, gainColMin).findIndex(
      (c) => containsAny(c, ['asset', 'type', 'category', 'instrument', 'security', 'fund', 'name', 'description'])
    );

    // Read data rows following the header
    for (let di = ri + 1; di < rows.length; di++) {
      const dataRow = rows[di];
      if (!dataRow || dataRow.every((c) => c == null || String(c).trim() === '')) break;

      const stcgVal = stcgCol !== -1 ? extractNumber(dataRow[stcgCol]) : 0;
      const ltcgVal = ltcgCol !== -1 ? extractNumber(dataRow[ltcgCol]) : 0;
      const tdsVal = tdsCol !== -1 ? extractNumber(dataRow[tdsCol]) : 0;

      if (stcgVal === 0 && ltcgVal === 0) continue;

      const assetText = assetCol !== -1
        ? String(dataRow[assetCol] ?? '')
        : rows[di].map(String).join(' ');

      const rowAsset = detectAssetClass(assetText);
      const asset = rowAsset !== 'unknown'
        ? rowAsset
        : (detectAssetClass(sheetName) !== 'unknown' ? detectAssetClass(sheetName) : 'indian_listed');

      let entry = entries.find((e) => e.assetClass === asset);
      if (!entry) {
        entry = { assetClass: asset, stcg: 0, ltcg: 0, tds: 0, source: `${sheetName} table` };
        entries.push(entry);
      }
      entry.stcg += stcgVal;
      entry.ltcg += ltcgVal;
      entry.tds += tdsVal;
    }
  }

  return entries;
}

/**
 * Strategy 3: Transaction-level data (individual buy/sell rows).
 * Detects rows with date, symbol, gain columns and aggregates.
 */
function extractTransactionGains(rows: Row[], sheetName: string): GainEntry[] {
  const entries: GainEntry[] = [];

  // Find header row with gain/profit column
  for (let ri = 0; ri < rows.length - 1; ri++) {
    const headerCells = rows[ri].map((c) => (c == null ? '' : String(c)));

    // Need a gain/profit/p&l column
    const gainCol = headerCells.findIndex((c) =>
      containsAny(c, ['gain', 'profit', 'p&l', 'pnl', 'realised', 'realized'])
    );
    if (gainCol === -1) continue;

    // Need a date column (buy date or sell date)
    const sellDateCol = headerCells.findIndex((c) => containsAny(c, ['sell date', 'exit date', 'trade date']));
    const buyDateCol = headerCells.findIndex((c) => containsAny(c, ['buy date', 'entry date', 'purchase date']));
    if (sellDateCol === -1 && buyDateCol === -1) continue;

    // Gain type column (STCG/LTCG or term)
    const termCol = headerCells.findIndex((c) =>
      containsAny(c, ['term', 'type', 'gain type', 'short/long'])
    );

    // Asset type column
    const assetCol = headerCells.findIndex((c) =>
      containsAny(c, ['asset', 'instrument type', 'security type', 'category'])
    );

    const tdsCol = headerCells.findIndex((c) => norm(c).includes('tds'));

    // Parse transactions
    for (let di = ri + 1; di < rows.length; di++) {
      const dataRow = rows[di];
      if (!dataRow || dataRow.every((c) => c == null || String(c).trim() === '')) break;

      const gainVal = extractNumber(dataRow[gainCol]);
      if (gainVal === 0) continue;

      const termText = termCol !== -1 ? String(dataRow[termCol] ?? '') : '';
      const assetText = assetCol !== -1 ? String(dataRow[assetCol] ?? '') : sheetName;

      const isLT = containsAny(termText, LTCG_KEYWORDS) ||
        norm(termText).includes('lt') ||
        norm(termText).includes('long');

      const asset = detectAssetClass(assetText) !== 'unknown'
        ? detectAssetClass(assetText)
        : (detectAssetClass(sheetName) !== 'unknown' ? detectAssetClass(sheetName) : 'indian_listed');

      const tdsVal = tdsCol !== -1 ? extractNumber(dataRow[tdsCol]) : 0;

      let entry = entries.find((e) => e.assetClass === asset);
      if (!entry) {
        entry = { assetClass: asset, stcg: 0, ltcg: 0, tds: 0, source: `${sheetName} transactions` };
        entries.push(entry);
      }

      if (isLT) entry.ltcg += gainVal;
      else entry.stcg += gainVal;
      entry.tds += tdsVal;
    }
  }

  return entries;
}

function parseExcelBuffer(buffer: Buffer): GainEntry[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const allEntries: GainEntry[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
      header: 1,
      defval: '',
      raw: false, // string values for dates, etc.
    });

    // Apply all three strategies; prefer whichever gives more data
    const kvEntries = extractKeyValueGains(rows, sheetName);
    const tableEntries = extractTableGains(rows, sheetName);
    const txEntries = extractTransactionGains(rows, sheetName);

    // Pick the strategy with the most non-zero entries for this sheet
    const best = [kvEntries, tableEntries, txEntries].reduce(
      (a, b) => (b.filter((e) => e.stcg !== 0 || e.ltcg !== 0).length > a.filter((e) => e.stcg !== 0 || e.ltcg !== 0).length ? b : a),
      [] as GainEntry[],
    );

    allEntries.push(...best);
  }

  return allEntries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Word / Text Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseText(text: string): GainEntry[] {
  const entries: GainEntry[] = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let currentAsset: AssetClass = 'unknown';

  for (const line of lines) {
    // Update asset context
    const lineAsset = detectAssetClass(line);
    if (lineAsset !== 'unknown') currentAsset = lineAsset;

    // Match patterns like: "STCG: 50,000" or "Short Term Gain - ₹1,50,000.00"
    const stcgMatch = line.match(
      /(?:stcg|short.?term(?:.?(?:capital.?)?gain)?)[:\s\-–]+([₹\d,.()\s]+)/i
    );
    const ltcgMatch = line.match(
      /(?:ltcg|long.?term(?:.?(?:capital.?)?gain)?)[:\s\-–]+([₹\d,.()\s]+)/i
    );

    if (!stcgMatch && !ltcgMatch) continue;

    const asset = currentAsset !== 'unknown' ? currentAsset : 'indian_listed';
    let entry = entries.find((e) => e.assetClass === asset);
    if (!entry) {
      entry = { assetClass: asset, stcg: 0, ltcg: 0, tds: 0, source: 'document text' };
      entries.push(entry);
    }

    if (stcgMatch) entry.stcg += extractNumber(stcgMatch[1]);
    if (ltcgMatch) entry.ltcg += extractNumber(ltcgMatch[1]);
  }

  return entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge & Structure
// ─────────────────────────────────────────────────────────────────────────────

function mergeEntries(entries: GainEntry[]): Map<AssetClass, GainEntry> {
  const map = new Map<AssetClass, GainEntry>();
  for (const e of entries) {
    const existing = map.get(e.assetClass);
    if (existing) {
      existing.stcg += e.stcg;
      existing.ltcg += e.ltcg;
      existing.tds += e.tds;
    } else {
      map.set(e.assetClass, { ...e });
    }
  }
  return map;
}

function buildResult(merged: Map<AssetClass, GainEntry>, warnings: string[]): ParsedCapitalGainsResult {
  const equityGains: ParsedCapitalGainsResult['equityGains'] = [];
  let debtMFGains = { shortTermGain: 0, longTermGain: 0 };
  const bondGains: ParsedCapitalGainsResult['bondGains'] = [];
  const summaryParts: string[] = [];

  for (const [cls, e] of merged) {
    const hasData = e.stcg !== 0 || e.ltcg !== 0;
    if (!hasData) continue;

    const fmt = (n: number) => `₹${Math.abs(n).toLocaleString('en-IN')}${n < 0 ? ' (loss)' : ''}`;

    switch (cls) {
      case 'indian_listed':
        equityGains.push({ type: 'indian_listed', shortTermGain: e.stcg, longTermGain: e.ltcg, tdsDeducted: e.tds });
        summaryParts.push(`Indian Equity: STCG ${fmt(e.stcg)}, LTCG ${fmt(e.ltcg)}`);
        break;
      case 'equity_mf':
        equityGains.push({ type: 'equity_mf', shortTermGain: e.stcg, longTermGain: e.ltcg, tdsDeducted: e.tds });
        summaryParts.push(`Equity MF: STCG ${fmt(e.stcg)}, LTCG ${fmt(e.ltcg)}`);
        break;
      case 'us_stocks':
        equityGains.push({ type: 'us_stocks', shortTermGain: e.stcg, longTermGain: e.ltcg, tdsDeducted: e.tds });
        summaryParts.push(`US Stocks: STCG ${fmt(e.stcg)}, LTCG ${fmt(e.ltcg)}`);
        break;
      case 'indian_unlisted':
        equityGains.push({ type: 'indian_unlisted', shortTermGain: e.stcg, longTermGain: e.ltcg, tdsDeducted: e.tds });
        summaryParts.push(`Unlisted Equity: STCG ${fmt(e.stcg)}, LTCG ${fmt(e.ltcg)}`);
        break;
      case 'debt_mf':
        debtMFGains = { shortTermGain: debtMFGains.shortTermGain + e.stcg, longTermGain: debtMFGains.longTermGain + e.ltcg };
        summaryParts.push(`Debt MF: STCG ${fmt(e.stcg)}, LTCG ${fmt(e.ltcg)}`);
        break;
      case 'bond':
        bondGains.push({ interestIncome: 0, capitalGainOnSale: e.stcg + e.ltcg, isLongTerm: e.ltcg > e.stcg });
        summaryParts.push(`Bonds: Gain ${fmt(e.stcg + e.ltcg)}`);
        break;
      case 'unknown':
        // Assign unknown entries to Indian equity as the safest default
        if (e.stcg !== 0 || e.ltcg !== 0) {
          equityGains.push({ type: 'indian_listed', shortTermGain: e.stcg, longTermGain: e.ltcg, tdsDeducted: e.tds });
          summaryParts.push(`Other Gains (defaulted to Equity): STCG ${fmt(e.stcg)}, LTCG ${fmt(e.ltcg)}`);
          warnings.push('Some entries could not be classified by asset type and were assigned to Indian Equity. Please review.');
        }
        break;
    }
  }

  const summary = summaryParts.length > 0
    ? `Parsed: ${summaryParts.join(' | ')}`
    : 'No capital gains data found in the file.';

  return { equityGains, debtMFGains, bondGains, summary, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export async function parseCapitalGainsFile(
  buffer: Buffer,
  filename: string,
): Promise<ParsedCapitalGainsResult> {
  const warnings: string[] = [];
  const ext = filename.toLowerCase().split('.').pop();

  let entries: GainEntry[] = [];

  if (ext === 'docx') {
    const { value: text, messages } = await mammoth.extractRawText({ buffer });
    if (messages.length > 0) {
      warnings.push('Some content in the Word document could not be read.');
    }
    entries = parseText(text);
  } else if (ext === 'xlsx' || ext === 'xls') {
    entries = parseExcelBuffer(buffer);
  } else {
    throw new Error('Unsupported file type. Please upload an Excel (.xlsx, .xls) or Word (.docx) file.');
  }

  if (entries.length === 0) {
    warnings.push('No recognizable capital gains data was found. The file format may not be supported. You can still enter values manually.');
  }

  const merged = mergeEntries(entries);
  return buildResult(merged, warnings);
}
