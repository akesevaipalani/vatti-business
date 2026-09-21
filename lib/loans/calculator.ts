export interface LoanCalculationInput {
  principal: number;
  interestRate: number; // e.g., 2% monthly or 24% yearly
  interestType: "FLAT" | "REDUCING" | "SIMPLE" | "MANUAL";
  interestFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
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
  principal: number;
  totalInterest: number;
  totalPayable: number;
  installmentAmount: number;
  schedule: ScheduleItem[];
}

export function calculateLoan(input: LoanCalculationInput): LoanCalculationResult {
  const principal = Number(input.principal) || 0;
  const rate = Number(input.interestRate) || 0;
  const n = Math.max(1, Number(input.totalInstallments) || 1);
  const startDate = input.startDate ? new Date(input.startDate) : new Date();

  let totalInterest = 0;
  let installmentAmount = 0;
  const schedule: ScheduleItem[] = [];

  if (input.interestType === "FLAT") {
    // Flat Rate Interest: Total Interest is fixed on original principal
    // Example: ₹1,00,000 at 2% monthly for 10 months => ₹2,000 * 10 = ₹20,000
    // Total Payable = ₹1,20,000 => ₹12,000 / month
    let rateFactor = 1;
    if (input.interestFrequency === "MONTHLY") {
      rateFactor = n; // Assuming monthly installments
    } else if (input.interestFrequency === "DAILY") {
      rateFactor = n;
    } else if (input.interestFrequency === "YEARLY") {
      rateFactor = n / 12;
    }

    totalInterest = (principal * rate * rateFactor) / 100;
    const totalPayable = principal + totalInterest;
    installmentAmount = Math.round((totalPayable / n) * 100) / 100;

    const principalPerMonth = Math.round((principal / n) * 100) / 100;
    const interestPerMonth = Math.round((totalInterest / n) * 100) / 100;

    let remaining = principal;
    for (let i = 1; i <= n; i++) {
      const dueDate = new Date(startDate);
      if (input.paymentFrequency === "DAILY") {
        dueDate.setDate(dueDate.getDate() + i);
      } else if (input.paymentFrequency === "WEEKLY") {
        dueDate.setDate(dueDate.getDate() + i * 7);
      } else {
        dueDate.setMonth(dueDate.getMonth() + i);
      }

      remaining = Math.max(0, remaining - principalPerMonth);

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split("T")[0],
        installmentAmount,
        principalPortion: principalPerMonth,
        interestPortion: interestPerMonth,
        remainingPrincipal: Math.round(remaining * 100) / 100,
      });
    }

    return {
      principal,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      installmentAmount,
      schedule,
    };
  } else if (input.interestType === "REDUCING") {
    // Reducing Balance EMI: E = P * r * (1+r)^n / ((1+r)^n - 1)
    const r = rate / 100; // Periodic rate
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
      const dueDate = new Date(startDate);
      if (input.paymentFrequency === "DAILY") {
        dueDate.setDate(dueDate.getDate() + i);
      } else if (input.paymentFrequency === "WEEKLY") {
        dueDate.setDate(dueDate.getDate() + i * 7);
      } else {
        dueDate.setMonth(dueDate.getMonth() + i);
      }

      const interestPart = Math.round(remaining * r * 100) / 100;
      const principalPart = Math.round((installmentAmount - interestPart) * 100) / 100;
      remaining = Math.max(0, remaining - principalPart);
      totalInterest += interestPart;

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split("T")[0],
        installmentAmount,
        principalPortion: principalPart,
        interestPortion: interestPart,
        remainingPrincipal: Math.round(remaining * 100) / 100,
      });
    }

    return {
      principal,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayable: Math.round((principal + totalInterest) * 100) / 100,
      installmentAmount,
      schedule,
    };
  } else {
    // Simple Interest / Manual
    totalInterest = (principal * rate * n) / 100;
    const totalPayable = principal + totalInterest;
    installmentAmount = Math.round((totalPayable / n) * 100) / 100;

    let remaining = principal;
    const principalPortion = Math.round((principal / n) * 100) / 100;
    const interestPortion = Math.round((totalInterest / n) * 100) / 100;

    for (let i = 1; i <= n; i++) {
      const dueDate = new Date(startDate);
      if (input.paymentFrequency === "DAILY") {
        dueDate.setDate(dueDate.getDate() + i);
      } else if (input.paymentFrequency === "WEEKLY") {
        dueDate.setDate(dueDate.getDate() + i * 7);
      } else {
        dueDate.setMonth(dueDate.getMonth() + i);
      }
      remaining = Math.max(0, remaining - principalPortion);

      schedule.push({
        installmentNumber: i,
        dueDate: dueDate.toISOString().split("T")[0],
        installmentAmount,
        principalPortion,
        interestPortion,
        remainingPrincipal: Math.round(remaining * 100) / 100,
      });
    }

    return {
      principal,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
      installmentAmount,
      schedule,
    };
  }
}
