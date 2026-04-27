// Mirror of server/src/tax/types.ts — keep in sync

export type UserType =
  | 'salaried'
  | 'business'
  | 'freelancer'
  | 'retired'
  | 'homemaker'
  | 'self_employed'
  | 'huf'
  | 'aop'  // Association of Persons (Sec 115BAC from AY 2024-25)
  | 'boi'; // Body of Individuals (Sec 115BAC from AY 2024-25)

export type ResidentialStatus = 'resident' | 'nri' | 'rnor';
export type AssessmentYear = '2026-27' | '2025-26';
export type TaxRegime = 'new' | 'old';

export interface SalaryIncome {
  basicSalary: number;
  hra: number;
  lta: number;
  specialAllowance: number;
  otherAllowances: number;
  rentPaidMonthly: number;
  cityType: 'metro' | 'non_metro';
  professionalTax: number;
  epfContribution: number;
}

export interface BusinessIncome {
  grossReceipts: number;
  scheme: 'presumptive_44ad' | 'presumptive_44ada' | 'regular';
  businessType: 'digital' | 'traditional';
  netProfitIfRegular?: number;
  depreciation?: number;
  additionalDepreciation?: number; // Section 32(1)(iia) – disallowed in new regime
  wdvAdjustment?: number;          // one-time WDV adjustment (unabsorbed dep as of 1-Apr-2023)
}

export interface OtherIncome {
  fdInterest: number;
  savingsInterest: number;
  rdInterest: number;
  dividendIncome: number;
  pensionIncome: number;
  familyPension: number;
  rentalIncome: number;
  rentalPropertyLoanInterest: number;
  otherIncome: number;
  minorChildrenCount?: number; // Section 10(32): ₹1,500/child exempt in old regime (max 2)
}

export interface EquityGain {
  type: 'indian_listed' | 'indian_unlisted' | 'us_stocks' | 'equity_mf';
  shortTermGain: number;
  longTermGain: number;
  tdsDeducted: number;
}

export interface PropertyGain {
  saleValue: number;
  purchaseValue: number;
  yearOfPurchase: number;
  yearOfSale: number;
  isResidentialProperty: boolean;
  acquisitionBeforeJul2024: boolean;
  improvementCost: number;
  stampDutyRegistration: number;
}

export interface DebtMFGain {
  shortTermGain: number;
  longTermGain: number;
}

export interface BondGain {
  interestIncome: number;
  capitalGainOnSale: number;
  isLongTerm: boolean;
}

export interface CapitalGainsInput {
  equityGains: EquityGain[];
  propertyGains: PropertyGain[];
  debtMFGains: DebtMFGain;
  bondGains: BondGain[];
}

export interface Deductions80C {
  ppf: number;
  elss: number;
  lic: number;
  nsc: number;
  homeLoanPrincipal: number;
  tuitionFees: number;
  epfEmployee: number;
  sukanyaSamriddhi: number;
  taxSavingFD: number;
  nps80CCD1: number;
  other80C: number;
}

export interface OtherDeductions {
  healthInsuranceSelf: number;
  healthInsuranceParents: number;
  parentsSeniorCitizen: boolean;
  preventiveHealthCheckup: number;
  educationLoanInterest: number;
  donations100Percent: number;
  donations50Percent: number;
  savingsInterestDeduction: number;
  nps80CCD1B: number;
  npsEmployerContribution: number;
  homeLoanInterest: number;
  hraExemption?: number;
  // 80CCH(2) Agniveer Corpus Fund – allowed in new regime too
  agniveer80CCH2: number;
  // 80JJAA New employment deduction – allowed in new regime too
  newEmployment80JJAA: number;
  // 80LA IFSC Unit deduction – allowed in new regime for IFSC units
  ifscUnit80LA: number;
}

export interface TDSEntry {
  source: string;
  amount: number;
  tdsDeducted: number;
}

export interface TaxPaid {
  tdsEntries: TDSEntry[];
  advanceTaxQ1: number;
  advanceTaxQ2: number;
  advanceTaxQ3: number;
  advanceTaxQ4: number;
  selfAssessmentTax: number;
}

export interface BroughtForwardLoss {
  housePropertyLoss: number;
  businessLoss: number;
  speculativeLoss: number;
  capitalLossShortTerm: number;
  capitalLossLongTerm: number;
  otherSourcesLoss: number;
}

export interface TaxInput {
  assessmentYear: AssessmentYear;
  userType: UserType;
  age: number;
  residentialStatus: ResidentialStatus;
  salaryIncome?: SalaryIncome;
  businessIncome?: BusinessIncome;
  otherIncome: OtherIncome;
  capitalGains: CapitalGainsInput;
  deductions80C: Deductions80C;
  otherDeductions: OtherDeductions;
  taxPaid: TaxPaid;
  broughtForwardLoss?: BroughtForwardLoss;
  regimeChoice?: 'new' | 'old';
  hasForm16?: boolean; // user declares they have Form 16 from employer
}

// ── Result types ──────────────────────────────────────────────────────────────

export interface SlabBreakdown {
  slabLabel: string;
  income: number;
  rate: number;
  tax: number;
}

export interface CapitalGainsTax {
  stcgEquityTax: number;
  ltcgEquityTax: number;
  stcgUsStocksTax: number;
  ltcgUsStocksTax: number;
  propertyStcgTax: number;
  propertyLtcgTax: number;
  debtMFTax: number;
  bondTax: number;
  totalCapitalGainsTax: number;
  details: string[];
}

export interface RegimeResult {
  regime: TaxRegime;
  grossIncome: number;
  standardDeduction: number;
  hraExemption: number;
  ltaExemption: number;
  totalDeductions: number;
  taxableIncome: number;
  taxableIncomeWithCG: number;
  slabTax: number;
  slabBreakdown: SlabBreakdown[];
  capitalGainsTax: CapitalGainsTax;
  grossTax: number;
  rebateU87A: number;
  taxAfterRebate: number;
  surcharge: number;
  cess: number;
  totalTaxLiability: number;
  totalTDSCredit: number;
  advanceTaxPaid: number;
  netPayable: number;
  taxSavingTips: string[];
  itrFormRecommended: string;
  itrFormReason: string;
}

export interface TaxCalculationResult {
  newRegime: RegimeResult;
  oldRegime: RegimeResult;
  recommendation: {
    preferredRegime: TaxRegime;
    savings: number;
    reason: string;
    detailedExplanation: string[];
  };
}

// ── Default value helpers (used in wizard store) ──────────────────────────────

export const defaultOtherIncome = (): OtherIncome => ({
  fdInterest: 0, savingsInterest: 0, rdInterest: 0, dividendIncome: 0,
  pensionIncome: 0, familyPension: 0, rentalIncome: 0,
  rentalPropertyLoanInterest: 0, otherIncome: 0,
});

export const defaultCapitalGains = (): CapitalGainsInput => ({
  equityGains: [], propertyGains: [],
  debtMFGains: { shortTermGain: 0, longTermGain: 0 },
  bondGains: [],
});

export const defaultDeductions80C = (): Deductions80C => ({
  ppf: 0, elss: 0, lic: 0, nsc: 0, homeLoanPrincipal: 0, tuitionFees: 0,
  epfEmployee: 0, sukanyaSamriddhi: 0, taxSavingFD: 0, nps80CCD1: 0, other80C: 0,
});

export const defaultOtherDeductions = (): OtherDeductions => ({
  healthInsuranceSelf: 0, healthInsuranceParents: 0, parentsSeniorCitizen: false,
  preventiveHealthCheckup: 0, educationLoanInterest: 0, donations100Percent: 0,
  donations50Percent: 0, savingsInterestDeduction: 0, nps80CCD1B: 0,
  npsEmployerContribution: 0, homeLoanInterest: 0,
  agniveer80CCH2: 0, newEmployment80JJAA: 0, ifscUnit80LA: 0,
});

export const defaultTaxPaid = (): TaxPaid => ({
  tdsEntries: [], advanceTaxQ1: 0, advanceTaxQ2: 0, advanceTaxQ3: 0,
  advanceTaxQ4: 0, selfAssessmentTax: 0,
});

export const defaultBroughtForwardLoss = (): BroughtForwardLoss => ({
  housePropertyLoss: 0, businessLoss: 0, speculativeLoss: 0,
  capitalLossShortTerm: 0, capitalLossLongTerm: 0, otherSourcesLoss: 0,
});
