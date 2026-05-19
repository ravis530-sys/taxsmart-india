// ─── Shared Tax Types ─────────────────────────────────────────────────────────

export type UserType =
  | 'salaried'
  | 'business'
  | 'freelancer'
  | 'retired'
  | 'homemaker'
  | 'self_employed'
  | 'huf'  // Hindu Undivided Family (Sec 115BAC applies from AY 2021-22)
  | 'aop'  // Association of Persons (Sec 115BAC applies from AY 2024-25)
  | 'boi'; // Body of Individuals (Sec 115BAC applies from AY 2024-25)

export type ResidentialStatus = 'resident' | 'nri' | 'rnor';

export type AssessmentYear = '2026-27' | '2025-26';

// ─── Income Inputs ─────────────────────────────────────────────────────────────

export interface SalaryIncome {
  basicSalary: number;
  hra: number;
  lta: number;
  specialAllowance: number;
  otherAllowances: number;
  // For HRA exemption (old regime)
  rentPaidMonthly: number;
  cityType: 'metro' | 'non_metro'; // metro = 50% HRA exempt, non_metro = 40%
  // From Form 16
  professionalTax: number;
  epfContribution: number; // employee share (auto: 12% of basic)
  vpfContribution?: number; // Voluntary PF (above mandatory EPF)
  vpfPercent?: number;      // VPF as % of basic for UI
  npsEmployerPercent?: number; // employer NPS rate: 10 or 14
  companyHealthInsuranceOptedIn?: boolean;
  companyHealthInsurance?: number;    // annual premium deducted from salary
  parentsInsuranceOptedIn?: boolean;
  parentsInsurancePremium?: number;   // annual parents insurance deducted from salary
}

export interface BusinessIncome {
  grossReceipts: number;
  scheme: 'presumptive_44ad' | 'presumptive_44ada' | 'regular';
  businessType: 'digital' | 'traditional'; // digital = 6% presumptive, traditional = 8%
  netProfitIfRegular?: number;
  depreciation?: number;           // normal depreciation (allowed in both regimes)
  additionalDepreciation?: number; // Section 32(1)(iia) – disallowed in new regime
  wdvAdjustment?: number;          // one-time WDV adjustment (unabsorbed dep as of 1-Apr-2023)
}

export interface OtherIncome {
  fdInterest: number;
  savingsInterest: number;
  rdInterest: number;
  dividendIncome: number;
  pensionIncome: number;
  familyPension: number;              // 1/3 or ₹15,000 whichever lower is exempt
  rentalIncome: number;
  rentalPropertyLoanInterest: number; // Section 24 deduction on let-out property (no cap)
  otherIncome: number;
  minorChildrenCount?: number;        // Section 10(32): ₹1,500/child exempt in old regime (max 2)
}

// ─── Capital Gains ─────────────────────────────────────────────────────────────

export interface EquityGain {
  type: 'indian_listed' | 'indian_unlisted' | 'us_stocks' | 'equity_mf';
  shortTermGain: number;   // held ≤ 12 months (Indian listed) or ≤ 24 months (US/unlisted)
  longTermGain: number;    // held > 12 months (Indian listed) or > 24 months (US/unlisted)
  tdsDeducted: number;
}

export interface PropertyGain {
  saleValue: number;
  purchaseValue: number;
  yearOfPurchase: number; // used for indexation
  yearOfSale: number;
  isResidentialProperty: boolean;
  acquisitionBeforeJul2024: boolean; // Budget 2024 rule: old property can choose 20% with indexation
  improvementCost: number;
  stampDutyRegistration: number; // part of cost of acquisition
}

export interface DebtMFGain {
  shortTermGain: number; // taxed at slab rate
  longTermGain: number;  // taxed at slab rate (post Apr 2023 rule change)
}

export interface BondGain {
  interestIncome: number;    // taxed at slab rate
  capitalGainOnSale: number; // STCG or LTCG depending on holding
  isLongTerm: boolean;
}

export interface CapitalGainsInput {
  equityGains: EquityGain[];
  propertyGains: PropertyGain[];
  debtMFGains: DebtMFGain;
  bondGains: BondGain[];
}

// ─── Deductions (Old Regime) ───────────────────────────────────────────────────

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
  nps80CCD1: number; // NPS contribution under 80CCD(1) – part of 80C limit
  other80C: number;
}

export interface OtherDeductions {
  // 80D Health Insurance
  healthInsuranceSelf: number;
  healthInsuranceParents: number;
  parentsSeniorCitizen: boolean;
  preventiveHealthCheckup: number; // max ₹5,000 within 80D limit

  // 80E Education loan interest
  educationLoanInterest: number;

  // 80G Donations (100% or 50% deductible)
  donations100Percent: number;
  donations50Percent: number;

  // 80TTA/TTB Savings interest
  savingsInterestDeduction: number; // 80TTA: max ₹10,000 (non-senior); 80TTB: max ₹50,000 (senior)

  // 80CCD(1B) NPS additional contribution (over and above 80C)
  nps80CCD1B: number; // max ₹50,000

  // 80CCD(2) Employer NPS contribution (available in new regime too)
  npsEmployerContribution: number; // max 10% of (basic + DA)

  // Section 24 - Home Loan Interest (self-occupied property)
  homeLoanInterest: number; // max ₹2,00,000 for self-occupied

  // 80CCH(2) Agniveer Corpus Fund – allowed in new regime too
  agniveer80CCH2: number;

  // 80JJAA New employment deduction – allowed in new regime too
  newEmployment80JJAA: number;

  // 80LA IFSC Unit deduction – allowed in new regime for IFSC units
  ifscUnit80LA: number;

  // HRA exemption (computed)
  hraExemption?: number;
}

// ─── TDS Credits ───────────────────────────────────────────────────────────────

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

// ─── Full Input Payload ─────────────────────────────────────────────────────────

export interface BroughtForwardLoss {
  // Losses from previous years that are allowed for set-off in old regime only.
  // New regime (Sec 115BAC(2)(ii)): carried-forward losses attributable to
  // disallowed deductions cannot be set off.
  housePropertyLoss: number;       // b/f loss under house property head
  businessLoss: number;            // b/f business loss (non-speculative)
  speculativeLoss: number;         // b/f speculative business loss
  capitalLossShortTerm: number;    // b/f STCL (can set off against STCG/LTCG)
  capitalLossLongTerm: number;     // b/f LTCL (can set off against LTCG only)
  otherSourcesLoss: number;        // b/f loss from other sources
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
  broughtForwardLoss?: BroughtForwardLoss; // carried-forward losses from prior years
  /**
   * For persons WITH business/professional income (Sec 115BAC(5)):
   *   - Once opted into New Regime, applies to ALL subsequent years.
   *   - Can withdraw only ONCE in their lifetime; after that, locked into Old Regime forever
   *     (unless they cease to have business income).
   * For persons WITHOUT business income: can switch year-to-year.
   */
  regimeChoice?: 'new' | 'old'; // explicit opt-in / opt-out choice (informational for calc)
  hasForm16?: boolean;           // user declares they have Form 16 from employer
}

// ─── Calculation Results ────────────────────────────────────────────────────────

export interface SlabBreakdown {
  slabLabel: string;
  income: number;
  rate: number;
  tax: number;
}

export interface CapitalGainsTax {
  stcgEquityTax: number;       // 20% on Indian listed STCG
  ltcgEquityTax: number;       // 12.5% on Indian listed LTCG above ₹1.25L exemption
  stcgUsStocksTax: number;     // slab rate
  ltcgUsStocksTax: number;     // 12.5% or 20% with indexation
  propertyStcgTax: number;     // slab rate
  propertyLtcgTax: number;     // 12.5% or 20% with indexation
  debtMFTax: number;           // slab rate
  bondTax: number;             // slab rate + capital gain
  totalCapitalGainsTax: number;
  details: string[];
}

export interface RegimeResult {
  regime: 'new' | 'old';
  grossIncome: number;
  standardDeduction: number;
  hraExemption: number;
  ltaExemption: number;
  totalDeductions: number;
  taxableIncome: number;         // before capital gains
  taxableIncomeWithCG: number;   // total taxable including capital gains at slab
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
  netPayable: number;            // positive = payable, negative = refund
  taxSavingTips: string[];
  itrFormRecommended: string;
  itrFormReason: string;
}

export interface TaxCalculationResult {
  newRegime: RegimeResult;
  oldRegime: RegimeResult;
  recommendation: {
    preferredRegime: 'new' | 'old';
    savings: number;
    reason: string;
    detailedExplanation: string[];
  };
}
