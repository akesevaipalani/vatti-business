export type LoanCalculationType = "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL";

export interface LoanCalculationInput {
  principal: number; // Face Loan Amount
  loanCalculationType?: LoanCalculationType;
  interestType?: "FLAT" | "REDUCING" | "SIMPLE" | "MANUAL";
  interestRate?: number; // e.g., 2% monthly or 24% yearly
  advanceInterestAmount?: number; // Directly entered advance interest amount
  customInterestAmount?: number; // User entered interest amount (total or per installment)
  principalPerInstallment?: number; // For Interest + Principal
  interestPerInstallment?: number; // For Interest + Principal
  customInstallmentAmount?: number; // For Advance Interest collection amount (e.g. ₹1500)
  processingFee?: number;
  interestFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  paymentFrequency: "DAILY" | "WEEKLY" | "MONTHLY";
  totalInstallments: number;
  startDate?: Date;
}

export interface ScheduleItem {
  installmentNumber: number;
  dueDate: string;
  installmentAmount: number;
  principalPortion: number;
  interestPortion: number;
  remainingPrincipal: number;
}

export interface LoanCalculationResult {
  loanCalculationType: LoanCalculationType;
  principal: number; // Face Loan Amount
  totalInterest: number;
  advanceInterest: number; // Upfront retained interest (if Advance Interest)
  customerReceives: number; // Net Disbursement (Face Amount - Advance Interest - Charges)
  processingFee: number; // Charges
  totalPayable: number; // Total Collection from Customer
  installmentAmount: number;
  totalInstallments: number;
  schedule: ScheduleItem[];
}

import { toISTDateString } from "@/lib/date";

function getDueDateForInstallment(startDate: Date, frequency: "DAILY" | "WEEKLY" | "MONTHLY", index: number): string {
  const istStr = toISTDateString(startDate);
  const [y, m, d] = istStr.split("-").map(Number);
  const targetDate = new Date(y, m - 1, d, 12, 0, 0);

  if (frequency === "DAILY") {
    targetDate.setDate(targetDate.getDate() + index);
  } else if (frequency === "WEEKLY") {
    targetDate.setDate(targetDate.getDate() + index * 7);
  } else {
    targetDate.setMonth(targetDate.getMonth() + index);
  }
  return toISTDateString(targetDate);
}

export function calculateLoan(input: LoanCalculationInput): LoanCalculationResult {
  const principal = Number(input.principal) || 0;
  const processingFee = Number(input.processingFee) || 0;
  const calculationType = input.loanCalculationType || "STANDARD";
  const frequency = input.paymentFrequency || "MONTHLY";
  const startDate = input.startDate ? new Date(input.startDate) : new Date();

  // =========================================================================
  // TYPE 1: ADVANCE INTEREST (முன் வட்டி)
  // Face Loan Amount = ₹1,50,000
  // Advance Interest = ₹15,000 (Directly entered or derived from rate)
  // Customer Receives = ₹1,35,000 (Face Amount - Advance Interest - Charges)
  // Total Collection = ₹1,50,000
  // Collection Amount = ₹1,500 × 100 Collections (Daily / Weekly / Monthly)
  // =========================================================================
  if (calculationType === "ADVANCE_INTEREST") {
    let advanceInterest = 0;
    if (input.advanceInterestAmount !== undefined && input.advanceInterestAmount !== null && !isNaN(Number(input.advanceInterestAmount))) {
      advanceInterest = Number(input.advanceInterestAmount);
    } else if (input.interestRate && Number(input.interestRate) > 0) {
      advanceInterest = Math.round(((principal * Number(input.interestRate)) / 100) * 100) / 100;
    }

    const customerReceives = Math.max(0, principal - advanceInterest - processingFee);
    const totalPayable = principal; // Total to be collected back

    let n = Math.max(1, Number(input.totalInstallments) || 1);
    let installmentAmount = 0;

    if (input.customInstallmentAmount && Number(input.customInstallmentAmount) > 0) {
      installmentAmount = Number(input.customInstallmentAmount);
      n = Math.max(1, Math.ceil(principal / installmentAmount));
    } else {
      installmentAmount = Math.round((principal / n) * 100) / 100;
    }

    const schedule: ScheduleItem[] = [];
    let remaining = principal;

    for (let i = 1; i <= n; i++) {
      const dueDateStr = getDueDateForInstallment(startDate, frequency, i);
      const isLast = i === n;
      const currentInstAmount = isLast ? remaining : Math.min(remaining, installmentAmount);
      remaining = Math.max(0, remaining - currentInstAmount);

      schedule.push({
        installmentNumber: i,
        dueDate: dueDateStr,
        installmentAmount: currentInstAmount,
        principalPortion: currentInstAmount, // Full installment recovers principal because interest was collected upfront
        interestPortion: 0,
        remainingPrincipal: Math.round(remaining * 100) / 100,
      });
    }

    return {
      loanCalculationType: "ADVANCE_INTEREST",
      principal,
      totalInterest: advanceInterest,
      advanceInterest,
      customerReceives,
      processingFee,
      totalPayable,
      installmentAmount,
      totalInstallments: n,
      schedule,
    };
  }

  // =========================================================================
  // TYPE 2: INTEREST + PRINCIPAL (அசல் + வட்டி தனித்தனி முறை)
  // Loan Amount = ₹1,00,000
  // Duration = 10 Installments (Months / Days / Weeks)
  // Principal per Installment = ₹10,000
  // Interest per Installment = ₹2,000 (Directly entered or derived from rate)
  // Monthly / Period Due = ₹12,000
  // Total Collection = ₹1,20,000 (Principal ₹1,00,000 + Interest ₹20,000)
  // =========================================================================
  if (calculationType === "INTEREST_PRINCIPAL") {
    const n = Math.max(1, Number(input.totalInstallments) || 1);
    const principalPerInst = input.principalPerInstallment !== undefined && input.principalPerInstallment > 0
      ? Number(input.principalPerInstallment)
      : Math.round((principal / n) * 100) / 100;

    let interestPerInst = 0;
    if (input.interestPerInstallment !== undefined && input.interestPerInstallment !== null && !isNaN(Number(input.interestPerInstallment))) {
      interestPerInst = Number(input.interestPerInstallment);
    } else if (input.customInterestAmount !== undefined && input.customInterestAmount !== null && !isNaN(Number(input.customInterestAmount))) {
      interestPerInst = Math.round((Number(input.customInterestAmount) / n) * 100) / 100;
    } else if (input.customInstallmentAmount !== undefined && Number(input.customInstallmentAmount) > principalPerInst) {
      interestPerInst = Math.round((Number(input.customInstallmentAmount) - principalPerInst) * 100) / 100;
    } else if (input.interestRate && Number(input.interestRate) > 0) {
      interestPerInst = Math.round(((principal * (Number(input.interestRate) / 100))) * 100) / 100;
    }

    const totalInterest = Math.round(interestPerInst * n * 100) / 100;
    const totalPayable = principal + totalInterest;
    const installmentAmount = Math.round((principalPerInst + interestPerInst) * 100) / 100;
    const customerReceives = Math.max(0, principal - processingFee);

    const schedule: ScheduleItem[] = [];
    let remaining = principal;

    for (let i = 1; i <= n; i++) {
      const dueDateStr = getDueDateForInstallment(startDate, frequency, i);
      const isLast = i === n;
      const prinPortion = isLast ? remaining : principalPerInst;
      remaining = Math.max(0, remaining - prinPortion);

      schedule.push({
        installmentNumber: i,
        dueDate: dueDateStr,
        installmentAmount: Math.round((prinPortion + interestPerInst) * 100) / 100,
        principalPortion: prinPortion,
        interestPortion: interestPerInst,
        remainingPrincipal: Math.round(remaining * 100) / 100,
      });
    }

    return {
      loanCalculationType: "INTEREST_PRINCIPAL",
      principal,
      totalInterest,
      advanceInterest: 0,
      customerReceives,
      processingFee,
      totalPayable,
      installmentAmount,
      totalInstallments: n,
      schedule,
    };
  }

  // =========================================================================
  // TYPE 3: STANDARD (Existing Types: FLAT, REDUCING, SIMPLE, MANUAL)
  // 100% Backwards-Compatible with existing formula
  // =========================================================================
  const rate = Number(input.interestRate) || 0;
  const n = Math.max(1, Number(input.totalInstallments) || 1);
  const customerReceives = Math.max(0, principal - processingFee);

  let totalInterest = 0;
  let installmentAmount = 0;
  const schedule: ScheduleItem[] = [];

  if (input.interestType === "FLAT") {
    let rateFactor = 1;
    if (input.interestFrequency === "MONTHLY") {
      rateFactor = n;
    } else if (input.interestFrequency === "DAILY") {
      rateFactor = n;
    } else if (input.interestFrequency === "YEARLY") {
      rateFactor = n / 12;
    }

    if (input.customInterestAmount !== undefined && input.customInterestAmount !== null && Number(input.customInterestAmount) > 0) {
      totalInterest = Number(input.customInterestAmount);
    } else {
      totalInterest = (principal * rate * rateFactor) / 100;
    }
    const totalPayable = principal + totalInterest;
    installmentAmount = Math.round((totalPayable / n) * 100) / 100;

    const principalPerMonth = Math.round((principal / n) * 100) / 100;
    const interestPerMonth = Math.round((totalInterest / n) * 100) / 100;

    let remaining = principal;
    for (let i = 1; i <= n; i++) {
      const dueDateStr = getDueDateForInstallment(startDate, frequency, i);
      const isLast = i === n;
      const prinPortion = isLast ? Math.round(remaining * 100) / 100 : principalPerMonth;
      remaining = Math.max(0, remaining - prinPortion);

      schedule.push({
        installmentNumber: i,
        dueDate: dueDateStr,
        installmentAmount,
        principalPortion: prinPortion,
        interestPortion: interestPerMonth,
        remainingPrincipal: Math.round(remaining * 100) / 100,
      });
    }

    return {
      loanCalculationType: "STANDARD",
      principal,
      totalInterest: Math.round(totalInterest * 100) / 100,
      advanceInterest: 0,
      customerReceives,
      processingFee,
      totalPayable: Math.round(totalPayable * 100) / 100,
      installmentAmount,
      totalInstallments: n,
      schedule,
    };
  } else if (input.interestType === "REDUCING") {
    const r = rate / 100;
    if (r === 0) {
      installmentAmount = principal / n;
      totalInterest = 0;
    } else {
      const pow = Math.pow(1 + r, n);
      installmentAmount = Math.round(((principal * r * pow) / (pow - 1)) * 100) / 100;
    }

    let remaining = principal;
    totalInterest = 0;

    for (let i = 1; i <= n; i++) {
      const dueDateStr = getDueDateForInstallment(startDate, frequency, i);
      const interestPart = Math.round(remaining * r * 100) / 100;
      const principalPart = Math.round((installmentAmount - interestPart) * 100) / 100;
      remaining = Math.max(0, remaining - principalPart);
      totalInterest += interestPart;

      schedule.push({
        installmentNumber: i,
        dueDate: dueDateStr,
        installmentAmount,
        principalPortion: principalPart,
        interestPortion: interestPart,
        remainingPrincipal: Math.round(remaining * 100) / 100,
      });
    }

    return {
      loanCalculationType: "STANDARD",
      principal,
      totalInterest: Math.round(totalInterest * 100) / 100,
      advanceInterest: 0,
      customerReceives,
      processingFee,
      totalPayable: Math.round((principal + totalInterest) * 100) / 100,
      installmentAmount,
      totalInstallments: n,
      schedule,
    };
  } else {
    // Simple Interest / Manual
    if (input.customInterestAmount !== undefined && input.customInterestAmount !== null && Number(input.customInterestAmount) > 0) {
      totalInterest = Number(input.customInterestAmount);
    } else {
      totalInterest = (principal * rate * n) / 100;
    }
    const totalPayable = principal + totalInterest;
    installmentAmount = Math.round((totalPayable / n) * 100) / 100;

    let remaining = principal;
    const principalPortion = Math.round((principal / n) * 100) / 100;
    const interestPortion = Math.round((totalInterest / n) * 100) / 100;

    for (let i = 1; i <= n; i++) {
      const dueDateStr = getDueDateForInstallment(startDate, frequency, i);
      const isLast = i === n;
      const prinPortion = isLast ? Math.round(remaining * 100) / 100 : principalPortion;
      remaining = Math.max(0, remaining - prinPortion);

      schedule.push({
        installmentNumber: i,
        dueDate: dueDateStr,
        installmentAmount,
        principalPortion: prinPortion,
        interestPortion,
        remainingPrincipal: Math.round(remaining * 100) / 100,
      });
    }

    return {
      loanCalculationType: "STANDARD",
      principal,
      totalInterest: Math.round(totalInterest * 100) / 100,
      advanceInterest: 0,
      customerReceives,
      processingFee,
      totalPayable: Math.round(totalPayable * 100) / 100,
      installmentAmount,
      totalInstallments: n,
      schedule,
    };
  }
}
