import { TaxInput, TaxCalculationResult, RegimeResult, SlabBreakdown } from './types';
import { computeNewRegimeTax, NEW_REGIME_STANDARD_DEDUCTION } from './newRegime';
import { computeOldRegimeTax, computeOldRegimeDeductions, OLD_REGIME_STANDARD_DEDUCTION } from './oldRegime';
import { computeCapitalGainsTax, getCapitalGainsAtSlabRate } from './capitalGains';
import { computeTotalTaxPaid } from './tds';

/** Surcharge rates (same for both regimes except cap difference) */
function computeSurcharge(taxAfterRebate: number, totalIncome: number, regime: 'new' | 'old'): number {
  if (totalIncome > 50000000) {       // > ₹5 Cr
    const rate = regime === 'new' ? 0.25 : 0.37;
    return taxAfterRebate * rate;
  }
  if (totalIncome > 20000000) {       // > ₹2 Cr
    const rate = regime === 'new' ? 0.25 : 0.25;
    return taxAfterRebate * rate;
  }
  if (totalIncome > 10000000) {       // > ₹1 Cr
    return taxAfterRebate * 0.15;
  }
  if (totalIncome > 5000000) {        // > ₹50 L
    return taxAfterRebate * 0.10;
  }
  return 0;
}

/** Compute gross income from salary inputs */
function computeGrossIncome(input: TaxInput, regime: 'new' | 'old'): number {
  let gross = 0;

  // Salary
  if (input.salaryIncome) {
    const s = input.salaryIncome;
    gross +=
      (s.basicSalary ?? 0) + (s.hra ?? 0) + (s.lta ?? 0) +
      (s.specialAllowance ?? 0) + (s.otherAllowances ?? 0);
  }

  // Business / Freelancer
  if (input.businessIncome) {
    const b = input.businessIncome;
    if (b.scheme === 'presumptive_44ad') {
      const rate = b.businessType === 'digital' ? 0.06 : 0.08;
      gross += (b.grossReceipts ?? 0) * rate;
    } else if (b.scheme === 'presumptive_44ada') {
      gross += (b.grossReceipts ?? 0) * 0.50;
    } else {
      gross += b.netProfitIfRegular ?? 0;
      // New regime: disallow additional depreciation (Section 32(1)(iia))
      if (regime === 'new' && b.additionalDepreciation) {
        gross += b.additionalDepreciation;
      }
    }
  }

  // Other income
  const o = input.otherIncome;

  // House property income – 30% standard deduction + actual loan interest on let-out
  // New regime: loss from house property cannot be set off against other heads (ring-fenced at ₹0)
  // Old regime: allow up to ₹2L loss set-off per Section 71(3A)
  const rentalNet = (o.rentalIncome ?? 0) * 0.7 - (o.rentalPropertyLoanInterest ?? 0);
  const rentalContribution = regime === 'new'
    ? Math.max(0, rentalNet)
    : Math.max(rentalNet, -200000);

  gross +=
    (o.fdInterest ?? 0) +
    (o.savingsInterest ?? 0) +
    (o.rdInterest ?? 0) +
    (o.dividendIncome ?? 0) +
    (o.pensionIncome ?? 0) +
    (o.familyPension ?? 0) +
    rentalContribution +
    (o.otherIncome ?? 0);

  return Math.max(0, gross);
}

/** Determine recommended ITR form */
function recommendITRForm(input: TaxInput, totalIncome: number): { form: string; reason: string } {
  const hasCapGains =
    input.capitalGains.equityGains.some((e) => e.longTermGain > 0 || e.shortTermGain > 0) ||
    input.capitalGains.propertyGains.length > 0 ||
    input.capitalGains.debtMFGains.shortTermGain > 0 ||
    input.capitalGains.debtMFGains.longTermGain > 0;

  const hasForeignAssets = input.capitalGains.equityGains.some((e) => e.type === 'us_stocks');
  const isPresumptive =
    input.businessIncome?.scheme === 'presumptive_44ad' ||
    input.businessIncome?.scheme === 'presumptive_44ada';
  const hasBusinessIncome = input.businessIncome != null;

  // AoP / BoI → ITR-5 (regardless of income type)
  if (input.userType === 'aop' || input.userType === 'boi') {
    return { form: 'ITR-5', reason: 'Association of Persons / Body of Individuals must file ITR-5.' };
  }

  // Presumptive taxation (individuals, HUF, partnership firms)
  if (isPresumptive) {
    return { form: 'ITR-4 (Sugam)', reason: 'You have income under presumptive taxation (44AD/44ADA).' };
  }

  // Business/professional income with books of accounts (individuals and HUF)
  if (hasBusinessIncome && !isPresumptive) {
    return {
      form: 'ITR-3',
      reason: input.userType === 'huf'
        ? 'HUF with business/professional income files ITR-3.'
        : 'You have business/professional income with books of accounts.',
    };
  }

  if (hasCapGains || hasForeignAssets || totalIncome > 5000000) {
    return {
      form: 'ITR-2',
      reason: hasForeignAssets
        ? 'You have foreign assets (US stocks) — Schedule FA must be reported in ITR-2.'
        : 'You have capital gains income.',
    };
  }
  // HUF without business income → ITR-2
  if (input.userType === 'huf') {
    return { form: 'ITR-2', reason: 'HUF without business income files ITR-2.' };
  }
  if ((input.userType === 'salaried' || input.userType === 'retired') && totalIncome <= 5000000) {
    return {
      form: 'ITR-1 (Sahaj)',
      reason: 'You are salaried with income ≤ ₹50L and no capital gains or business income.',
    };
  }
  return { form: 'ITR-2', reason: 'Based on your income profile.' };
}

/** Generate tax-saving tips */
function taxSavingTips(input: TaxInput, regime: 'new' | 'old'): string[] {
  const tips: string[] = [];
  const d = input.deductions80C;
  const od = input.otherDeductions;

  if (regime === 'old') {
    const used80C =
      d.ppf + d.elss + d.lic + d.nsc + d.homeLoanPrincipal + d.tuitionFees +
      d.epfEmployee + d.sukanyaSamriddhi + d.taxSavingFD + d.nps80CCD1 + d.other80C;
    const remaining80C = Math.max(0, 150000 - used80C);
    if (remaining80C > 0) {
      tips.push(`Invest ₹${fmt(remaining80C)} more in PPF/ELSS to fully utilise ₹1.5L Section 80C limit.`);
    }
    if (od.nps80CCD1B < 50000) {
      const rem = 50000 - od.nps80CCD1B;
      tips.push(`Contribute ₹${fmt(rem)} more to NPS (80CCD(1B)) for extra ₹50,000 deduction.`);
    }
    if (od.healthInsuranceSelf < 25000) {
      tips.push('Buy health insurance to claim up to ₹25,000 deduction under 80D.');
    }
    if (od.homeLoanInterest === 0) {
      tips.push('Home loan interest up to ₹2L is deductible under Section 24(b) in old regime.');
    }
  }

  if (regime === 'new') {
    tips.push('In the new regime, employer NPS contribution (80CCD(2)) up to 10% of basic is still deductible.');
    tips.push('Tax-free gratuity, leave encashment limits are higher — check with your employer.');
    if (input.otherDeductions.npsEmployerContribution === 0 && input.salaryIncome?.basicSalary) {
      const maxNPS = input.salaryIncome.basicSalary * 0.10;
      tips.push(`Ask your employer to route ₹${fmt(maxNPS)} as NPS employer contribution (tax-free in new regime).`);
    }
  }

  // Universal
  if (input.capitalGains.equityGains.some((e) => e.type === 'us_stocks')) {
    tips.push('US stock LTCG (held >24 months) is taxed at 12.5%; consider long-term holding to benefit from this rate.');
    tips.push('Declare foreign assets in Schedule FA of ITR-2 to avoid penalties under FEMA/Black Money Act.');
  }
  if (input.otherIncome.fdInterest > 0) {
    tips.push('FD TDS is deducted at 10%; if your income is below taxable limit, submit Form 15G/15H to avoid TDS.');
  }
  if (input.capitalGains.propertyGains.length > 0) {
    tips.push('Invest property LTCG in specific bonds (Section 54EC) or new house (Section 54) to save tax.');
  }

  return tips;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

// ─── Main Calculator ────────────────────────────────────────────────────────────

export function calculateTax(input: TaxInput): TaxCalculationResult {
  // 1. Capital gains at slab rate (add to ordinary income)
  const cgAtSlabRate = getCapitalGainsAtSlabRate(input.capitalGains);

  // 2. Compute TDS/advance tax paid
  const { totalTDS, totalAdvanceTax, totalTaxPaid } = computeTotalTaxPaid(input.taxPaid);

  // 3. Brought-forward losses — hoisted so both regimes can use them
  const bfl = input.broughtForwardLoss;
  // Capital losses (STCL/LTCL) are set-offable in both regimes (Sec 74; no carve-out in Sec 115BAC(2)(ii))
  const bflCapitalSetOff = bfl ? bfl.capitalLossShortTerm + bfl.capitalLossLongTerm : 0;

  // ─── NEW REGIME ────────────────────────────────────────────────────────────────
  const isSalaryOrPension = input.userType === 'salaried' || input.userType === 'retired';
  const newSD = isSalaryOrPension ? NEW_REGIME_STANDARD_DEDUCTION : 0;

  const grossIncome = computeGrossIncome(input, 'new');

  // In new regime: standard deduction, employer NPS (80CCD(2)), Agniveer (80CCH(2)),
  // new employment (80JJAA), and IFSC 80LA are allowed
  const newNPSEmployer = Math.min(
    input.otherDeductions.npsEmployerContribution,
    (input.salaryIncome?.basicSalary ?? 0) * 0.10
  );
  const newAgniveer = input.otherDeductions.agniveer80CCH2 ?? 0;
  const newJJAA = input.otherDeductions.newEmployment80JJAA ?? 0;
  const newIFSC = input.otherDeductions.ifscUnit80LA ?? 0;
  const newTotalDeductions = newSD + newNPSEmployer + newAgniveer + newJJAA + newIFSC;
  const newTaxableIncome = Math.max(0, grossIncome - newTotalDeductions);
  // New regime: b/f losses from disallowed deductions cannot be set off (Sec 115BAC(2)(ii)).
  // Capital losses (STCL/LTCL) are still set-offable in new regime (bflCapitalSetOff computed above).
  const newTaxableWithCG = Math.max(0, newTaxableIncome + cgAtSlabRate - bflCapitalSetOff);

  const newResult = computeNewRegimeTax(newTaxableWithCG, input.assessmentYear);
  const newCGTax = computeCapitalGainsTax(input.capitalGains, (extra) => {
    // marginal rate helper (not used directly, CG at special rates)
    return 0;
  });

  const newGrossTax = newResult.taxAfterRebate + newCGTax.totalCapitalGainsTax;
  const newSurcharge = computeSurcharge(newGrossTax, newTaxableWithCG, 'new');
  const newCess = (newGrossTax + newSurcharge) * 0.04;
  const newTotalTax = newGrossTax + newSurcharge + newCess;
  const newNetPayable = newTotalTax - totalTaxPaid;

  const newITR = recommendITRForm(input, newTaxableWithCG);

  const newRegimeResult: RegimeResult = {
    regime: 'new',
    grossIncome,
    standardDeduction: newSD,
    hraExemption: 0,
    ltaExemption: 0,
    totalDeductions: newTotalDeductions,
    taxableIncome: newTaxableIncome,
    taxableIncomeWithCG: newTaxableWithCG,
    slabTax: newResult.slabTax,
    slabBreakdown: newResult.breakdown,
    capitalGainsTax: newCGTax,
    grossTax: newGrossTax,
    rebateU87A: newResult.rebate,
    taxAfterRebate: newResult.taxAfterRebate,
    surcharge: newSurcharge,
    cess: newCess,
    totalTaxLiability: newTotalTax,
    totalTDSCredit: totalTDS,
    advanceTaxPaid: totalAdvanceTax,
    netPayable: newNetPayable,
    taxSavingTips: taxSavingTips(input, 'new'),
    itrFormRecommended: newITR.form,
    itrFormReason: newITR.reason,
  };

  // ─── OLD REGIME ────────────────────────────────────────────────────────────────
  const grossIncomeOld = computeGrossIncome(input, 'old');
  const oldDeductions = computeOldRegimeDeductions(input);

  // Old regime: allow set-off of b/f losses (Sec 70-74). House property loss capped at ₹2L
  // per Sec 71(3A); STCL can offset STCG+LTCG; LTCL can only offset LTCG.
  // bfl and bflCapitalSetOff are already declared above (shared with new regime).
  const bflSetOff = bfl
    ? Math.min(bfl.housePropertyLoss, 200000) +
      bfl.businessLoss +
      bfl.speculativeLoss +
      bfl.otherSourcesLoss
    : 0;

  const oldTaxableIncome = Math.max(0, grossIncomeOld - oldDeductions.total - bflSetOff);
  const oldTaxableWithCG = Math.max(0, oldTaxableIncome + cgAtSlabRate - bflCapitalSetOff);

  // HUF, AoP, BoI: no senior citizen benefit in old regime slabs
  const isNonPerson = input.userType === 'huf' || input.userType === 'aop' || input.userType === 'boi';
  const effectiveAgeForOldRegime = isNonPerson ? 0 : input.age;
  const oldResult = computeOldRegimeTax(oldTaxableWithCG, effectiveAgeForOldRegime);
  const oldCGTax = computeCapitalGainsTax(input.capitalGains, (_) => 0);

  const oldGrossTax = oldResult.taxAfterRebate + oldCGTax.totalCapitalGainsTax;
  const oldSurcharge = computeSurcharge(oldGrossTax, oldTaxableWithCG, 'old');
  const oldCess = (oldGrossTax + oldSurcharge) * 0.04;
  const oldTotalTax = oldGrossTax + oldSurcharge + oldCess;
  const oldNetPayable = oldTotalTax - totalTaxPaid;

  const oldITR = recommendITRForm(input, oldTaxableWithCG);

  const oldRegimeResult: RegimeResult = {
    regime: 'old',
    grossIncome: grossIncomeOld,
    standardDeduction: oldDeductions.standardDeduction,
    hraExemption: oldDeductions.hraExemption,
    ltaExemption: oldDeductions.ltaExemption,
    totalDeductions: oldDeductions.total,
    taxableIncome: oldTaxableIncome,
    taxableIncomeWithCG: oldTaxableWithCG,
    slabTax: oldResult.slabTax,
    slabBreakdown: oldResult.breakdown,
    capitalGainsTax: oldCGTax,
    grossTax: oldGrossTax,
    rebateU87A: oldResult.rebate,
    taxAfterRebate: oldResult.taxAfterRebate,
    surcharge: oldSurcharge,
    cess: oldCess,
    totalTaxLiability: oldTotalTax,
    totalTDSCredit: totalTDS,
    advanceTaxPaid: totalAdvanceTax,
    netPayable: oldNetPayable,
    taxSavingTips: taxSavingTips(input, 'old'),
    itrFormRecommended: oldITR.form,
    itrFormReason: oldITR.reason,
  };

  // ─── RECOMMENDATION ─────────────────────────────────────────────────────────────
  const newBetter = newTotalTax <= oldTotalTax;
  const savings = Math.abs(oldTotalTax - newTotalTax);

  // Honour explicit regime choice (e.g. Sec 115BAC(5) lock-in for business users)
  const regimeChoice = input.regimeChoice;
  const preferredRegime: 'new' | 'old' =
    regimeChoice === 'new' ? 'new' :
    regimeChoice === 'old' ? 'old' :
    (newBetter ? 'new' : 'old');

  const detailedExplanation: string[] = [];
  if (regimeChoice === 'new') {
    detailedExplanation.push('You have opted into the New Tax Regime for this year.');
  } else if (regimeChoice === 'old') {
    detailedExplanation.push('You have opted for the Old Tax Regime for this year.');
  }
  if (preferredRegime === 'new') {
    detailedExplanation.push(
      `Your total deductions under the Old Regime are ₹${fmt(oldDeductions.total)}.`
    );
    detailedExplanation.push(
      `The New Regime offers lower slab rates${newSD > 0 ? ` and a flat ₹${fmt(newSD)} standard deduction` : ''} — this benefits you more.`
    );
    if (savings > 0) {
      detailedExplanation.push(`By choosing the New Regime, you save ₹${fmt(savings)} in taxes.`);
    }
  } else {
    detailedExplanation.push(
      `Your total deductions under the Old Regime are ₹${fmt(oldDeductions.total)}, which significantly reduce your taxable income.`
    );
    detailedExplanation.push(
      `By maximising deductions (80C ₹1.5L, 80D, NPS ₹50K, HRA, home loan interest), the Old Regime saves you ₹${fmt(savings)}.`
    );
  }
  detailedExplanation.push(
    `New Regime Tax: ₹${fmt(newTotalTax)} | Old Regime Tax: ₹${fmt(oldTotalTax)}`
  );

  return {
    newRegime: newRegimeResult,
    oldRegime: oldRegimeResult,
    recommendation: {
      preferredRegime,
      savings,
      reason: preferredRegime === 'new'
        ? (regimeChoice === 'new' ? `New Tax Regime (opted-in)` : `New Regime is better — saves ₹${fmt(savings)}`)
        : (regimeChoice === 'old' ? `Old Tax Regime (opted-in)` : `Old Regime is better — saves ₹${fmt(savings)} with your deductions`),
      detailedExplanation,
    },
  };
}
