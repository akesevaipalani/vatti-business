import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { calculateLoan } from "@/lib/loans/calculator";
import { postLoanCollection } from "@/lib/accounting/engine";
import { syncEvents } from "@/lib/sync/events";
import { getNextReceiptNumber } from "@/lib/documents/numbering";
import {
  getTodayIST,
  toISTDateString,
  getISTDayRange,
  formatISTDisplay,
  formatISTDateTime,
} from "@/lib/date";

export interface InstallmentScheduleItem {
  id: string;
  installmentId: string;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  mobile: string;
  customerMobile: string;
  address: string;
  installmentNumber: number;
  installmentNo: number;
  scheduledCollectionDate: string; // YYYY-MM-DD
  dueDate: string; // DD/MM/YYYY for UI
  dueDateYMD: string; // YYYY-MM-DD
  amountToCollect: number;
  amount: number;
  dueAmount: number;
  installmentAmount: number;
  principal: number;
  principalPortion: number;
  interest: number;
  interestPortion: number;
  paidAmount: number;
  principalPaid: number;
  interestPaid: number;
  remainingAmount: number;
  pendingAmount: number;
  balance: number;
  balanceAmount: number;
  status: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE";
  statusRaw: "PENDING" | "COLLECTED" | "PARTIALLY_PAID" | "OVERDUE";
  actualPaymentDate?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  loanCalculationType?: string;
  advanceInterest?: number;
}

export interface CollectedTodayPaymentItem {
  id: string;
  paymentNo: string;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  mobile: string;
  address?: string;
  installmentNumber?: number | null;
  installmentNo?: number | null;
  collectionDate: string; // DD/MM/YYYY, hh:mm A
  date: string; // YYYY-MM-DD
  amount: number;
  amountCollected: number;
  principalPortion: number;
  interestPortion: number;
  principal?: number;
  principalPaid?: number;
  interest?: number;
  interestPaid?: number;
  paymentMethod: string;
  status: "PAID";
  notes?: string | null;
  previousOutstanding?: number;
  currentOutstanding?: number;
  remainingOutstanding?: number;
  loanCalculationType?: string;
  loan?: any;
  customer?: any;
}

export interface PendingInstallmentItem extends InstallmentScheduleItem {
  expectedAmount: number;
  collectedAmount: number;
}

export interface CustomerPendingSummary {
  customerId: string;
  customerName: string;
  customerCode: string;
  mobile: string;
  address: string;
  loans: Array<{ loanId: string; loanNo: string }>;
  loanNumbers: string;
  pendingInstallmentsCount: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
  totalPendingAmount: number;
  status: "PENDING" | "PARTIAL" | "OVERDUE";
  installments: PendingInstallmentItem[];
}

export interface CollectionScheduleResponse {
  success: boolean;
  date: string; // YYYY-MM-DD
  dateDisplay: string; // DD/MM/YYYY
  summary: {
    todayDueAmount: number;
    todayDueCount: number;
    todayCollectedAmount: number;
    todayCollectedCount: number;
    todayPendingAmount: number;
    todayPendingCount: number;
    todayCollectedOnDue: number;
    overdueAmount: number;
    overdueCount: number;
    futureCount: number;
    reconciled: boolean;
  };
  todayDue: InstallmentScheduleItem[]; // TAB 1: Today's Collection
  todayPending: InstallmentScheduleItem[]; // TAB 2: Today's Pending
  collectedToday: CollectedTodayPaymentItem[]; // TAB 3: Collected Today
  overdue: InstallmentScheduleItem[];
  customers: CustomerPendingSummary[];
}

/**
 * Backward-compatible helper to format Date to YYYY-MM-DD in IST
 */
export function formatDateToYMD(d: Date | string | number): string {
  return toISTDateString(d);
}

/**
 * Backward-compatible day range helper
 */
export function getDayRange(dateStr: string): { start: Date; end: Date } {
  const range = getISTDayRange(dateStr);
  return { start: range.start, end: range.end };
}

/**
 * Generate LoanInstallment records for a specific loan based on calculateLoan() or precalculated schedule
 */
export async function generateInstallmentsForLoan(
  loanId: string,
  precalculatedSchedule?: Array<{
    installmentNumber: number;
    dueDate: string;
    installmentAmount: number;
    principalPortion: number;
    interestPortion: number;
  }>,
  loanMetadata?: {
    customerId: string;
  }
) {
  const todayIST = getTodayIST();

  // FAST PATH: Precalculated schedule passed directly from loan creation
  if (precalculatedSchedule && precalculatedSchedule.length > 0 && loanMetadata?.customerId) {
    const installmentData = precalculatedSchedule.map((item) => {
      const [y, m, d] = item.dueDate.split("-").map(Number);
      const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
      const dueDateUtcMs = Date.UTC(y, m - 1, d, 12, 0, 0) - IST_OFFSET_MS;
      const dueDate = new Date(dueDateUtcMs);
      const isPastDue = item.dueDate < todayIST;

      return {
        id: crypto.randomUUID(),
        loanId,
        customerId: loanMetadata.customerId,
        installmentNumber: item.installmentNumber,
        dueDate,
        installmentAmount: item.installmentAmount,
        principalPortion: item.principalPortion,
        interestPortion: item.interestPortion,
        paidAmount: 0,
        principalPaid: 0,
        interestPaid: 0,
        status: isPastDue ? "OVERDUE" : "PENDING",
      };
    });

    if (installmentData.length > 0) {
      for (let i = 0; i < installmentData.length; i += 100) {
        const chunk = installmentData.slice(i, i + 100);
        await prisma.loanInstallment.createMany({
          data: chunk,
        });
      }
    }
    return;
  }

  // FALLBACK: Query from database if called standalone (e.g. bootstrap)
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { customer: true },
  });

  if (!loan) return;

  const existingCount = await prisma.loanInstallment.count({
    where: { loanId },
  });

  if (existingCount > 0) return; // Already generated

  const l = loan as any;
  const isAdvanceLoan = l.loanCalculationType === "ADVANCE_INTEREST" || Boolean(l.advanceInterest && l.advanceInterest > 0);
  const calc = calculateLoan({
    principal: loan.principalAmount,
    loanCalculationType: isAdvanceLoan ? "ADVANCE_INTEREST" : ((l.loanCalculationType as "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL") || "STANDARD"),
    interestRate: loan.interestRate,
    interestType: loan.interestType as "FLAT" | "REDUCING" | "SIMPLE",
    advanceInterestAmount: l.advanceInterest,
    customInterestAmount: isAdvanceLoan ? undefined : (loan.totalPayable > loan.principalAmount ? loan.totalPayable - loan.principalAmount : undefined),
    customInstallmentAmount: loan.installmentAmount,
    processingFee: loan.processingFee,
    interestFrequency: loan.interestFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
    paymentFrequency: loan.paymentFrequency as "DAILY" | "WEEKLY" | "MONTHLY",
    totalInstallments: loan.totalInstallments,
    startDate: loan.date,
  });

  const installmentData = calc.schedule.map((item) => {
    const [y, m, d] = item.dueDate.split("-").map(Number);
    // Midday (12:00:00) IST ensures date stays firmly inside the calendar day
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const dueDateUtcMs = Date.UTC(y, m - 1, d, 12, 0, 0) - IST_OFFSET_MS;
    const dueDate = new Date(dueDateUtcMs);
    const isPastDue = item.dueDate < todayIST;

    return {
      id: crypto.randomUUID(),
      loanId: loan.id,
      customerId: loan.customerId,
      installmentNumber: item.installmentNumber,
      dueDate,
      installmentAmount: item.installmentAmount,
      principalPortion: item.principalPortion,
      interestPortion: item.interestPortion,
      paidAmount: 0,
      principalPaid: 0,
      interestPaid: 0,
      status: isPastDue ? "OVERDUE" : "PENDING",
    };
  });

  if (installmentData.length > 0) {
    for (let i = 0; i < installmentData.length; i += 100) {
      const chunk = installmentData.slice(i, i + 100);
      await prisma.loanInstallment.createMany({
        data: chunk,
      });
    }
  }
}

/**
 * Bootstrap installments for any active loan that does not have installments in the database
 */
export async function bootstrapExistingLoans() {
  const activeLoansWithoutInstallments = await prisma.loan.findMany({
    where: {
      status: { in: ["ACTIVE", "OVERDUE"] },
      installments: { none: {} },
    },
    include: { payments: { orderBy: { date: "asc" } } },
  });

  for (const loan of activeLoansWithoutInstallments) {
    await generateInstallmentsForLoan(loan.id);

      // Reconcile existing payments FIFO
      if (loan.payments.length > 0) {
        let totalPaid = loan.payments.reduce((s, p) => s + p.amount, 0);
        const installments = await prisma.loanInstallment.findMany({
          where: { loanId: loan.id },
          orderBy: { installmentNumber: "asc" },
        });

        for (const inst of installments) {
          if (totalPaid <= 0) break;
          const due = inst.installmentAmount;
          if (totalPaid >= due) {
            await prisma.loanInstallment.update({
              where: { id: inst.id },
              data: {
                paidAmount: due,
                principalPaid: inst.principalPortion,
                interestPaid: inst.interestPortion,
                status: "COLLECTED",
                actualPaymentDate: loan.payments[loan.payments.length - 1].date,
              },
            });
            totalPaid -= due;
          } else {
            await prisma.loanInstallment.update({
              where: { id: inst.id },
              data: {
                paidAmount: totalPaid,
                principalPaid: Math.max(0, totalPaid - inst.interestPortion),
                interestPaid: Math.min(totalPaid, inst.interestPortion),
                status: "PARTIALLY_PAID",
                actualPaymentDate: loan.payments[loan.payments.length - 1].date,
              },
            });
            totalPaid = 0;
        }
      }
    }
  }
}

/**
 * Format a Prisma LoanInstallment into a unified InstallmentScheduleItem
 */
function mapInstallmentToItem(
  inst: any,
  referenceDateStr: string
): InstallmentScheduleItem {
  const dueYMD = toISTDateString(inst.dueDate);
  const isPast = dueYMD < referenceDateStr;
  const isFullyPaid = inst.paidAmount >= inst.installmentAmount;
  const isPartial = inst.paidAmount > 0 && !isFullyPaid;
  const pendingAmount = Math.max(0, inst.installmentAmount - inst.paidAmount);

  let status: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE" = "PENDING";
  let statusRaw: "PENDING" | "COLLECTED" | "PARTIALLY_PAID" | "OVERDUE" = "PENDING";

  if (isFullyPaid) {
    status = "PAID";
    statusRaw = "COLLECTED";
  } else if (isPartial) {
    status = "PARTIAL";
    statusRaw = "PARTIALLY_PAID";
  } else if (isPast) {
    status = "OVERDUE";
    statusRaw = "OVERDUE";
  } else {
    status = "PENDING";
    statusRaw = "PENDING";
  }

  return {
    id: inst.id,
    installmentId: inst.id,
    loanId: inst.loanId,
    loanNo: inst.loan?.loanNo || "",
    customerId: inst.customerId,
    customerName: inst.customer?.name || "",
    customerCode: inst.customer?.customerCode || "",
    mobile: inst.customer?.mobile || "",
    customerMobile: inst.customer?.mobile || "",
    address: inst.customer?.address || inst.customer?.city || "-",
    installmentNumber: inst.installmentNumber,
    installmentNo: inst.installmentNumber,
    scheduledCollectionDate: dueYMD,
    dueDate: formatISTDisplay(inst.dueDate),
    dueDateYMD: dueYMD,
    amountToCollect: inst.installmentAmount,
    amount: inst.installmentAmount,
    dueAmount: inst.installmentAmount,
    installmentAmount: inst.installmentAmount,
    principal: inst.principalPortion,
    principalPortion: inst.principalPortion,
    interest: inst.interestPortion,
    interestPortion: inst.interestPortion,
    paidAmount: inst.paidAmount,
    principalPaid: inst.principalPaid || 0,
    interestPaid: inst.interestPaid || 0,
    remainingAmount: pendingAmount,
    pendingAmount,
    balance: pendingAmount,
    balanceAmount: pendingAmount,
    status,
    statusRaw,
    actualPaymentDate: inst.actualPaymentDate ? toISTDateString(inst.actualPaymentDate) : null,
    paymentMethod: inst.paymentMethod || null,
    notes: inst.notes || null,
    loanCalculationType: inst.loan?.loanCalculationType || "STANDARD",
    advanceInterest: (inst.loan as any)?.advanceInterest || 0,
  };
}

/**
 * Authoritative Central Collection Schedule & Status Engine
 * Serves Desktop EXE, Web Admin, Admin Android APK, and Partner Android APK
 */
export async function getCollectionSchedule(
  dateStr?: string,
  options?: { q?: string; tab?: string }
): Promise<CollectionScheduleResponse> {
  await bootstrapExistingLoans();

  const targetDateStr = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getTodayIST();
  const range = getISTDayRange(targetDateStr);

  // 1. Fetch Today's Due Installments
  const dueInstallments = await prisma.loanInstallment.findMany({
    where: {
      loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
      dueDate: {
        gte: range.start,
        lte: range.end,
      },
    },
    include: {
      customer: true,
      loan: true,
    },
    orderBy: [
      { customer: { name: "asc" } },
      { installmentNumber: "asc" },
    ],
  });

  // 2. Fetch Payments Collected Today
  const todayPayments = await prisma.loanPayment.findMany({
    where: {
      date: {
        gte: range.start,
        lte: range.end,
      },
    },
    include: {
      customer: true,
      loan: true,
    },
    orderBy: { date: "desc" },
  });

  // 3. Fetch Overdue Installments (due strictly before today and not fully paid)
  const overdueInstallments = await prisma.loanInstallment.findMany({
    where: {
      loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
      dueDate: {
        lt: range.start,
      },
      paidAmount: {
        lt: prisma.loanInstallment.fields.installmentAmount,
      },
      status: { not: "COLLECTED" },
    },
    include: {
      customer: true,
      loan: true,
    },
    orderBy: [
      { dueDate: "asc" },
      { customer: { name: "asc" } },
    ],
  });

  // 4. Count future installments
  const futureCount = await prisma.loanInstallment.count({
    where: {
      loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
      dueDate: {
        gt: range.end,
      },
    },
  });

  // Transform items
  const todayDue: InstallmentScheduleItem[] = dueInstallments.map((inst) =>
    mapInstallmentToItem(inst, targetDateStr)
  );

  // TAB 2: Today's Pending = Installments due today where paidAmount < installmentAmount
  const todayPending: InstallmentScheduleItem[] = todayDue.filter((item) => item.pendingAmount > 0);

  // Pre-fetch all payments for loans in todayPayments to calculate exact loan-level previous & remaining outstanding
  const distinctLoanIds = Array.from(new Set(todayPayments.map((p) => p.loanId)));
  const allLoanPayments = distinctLoanIds.length > 0
    ? await prisma.loanPayment.findMany({
        where: { loanId: { in: distinctLoanIds } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      })
    : [];

  const paymentsByLoan = new Map<string, typeof allLoanPayments>();
  for (const lp of allLoanPayments) {
    if (!paymentsByLoan.has(lp.loanId)) paymentsByLoan.set(lp.loanId, []);
    paymentsByLoan.get(lp.loanId)!.push(lp);
  }

  // TAB 3: Collected Today = Payments recorded on target date
  const collectedToday: CollectedTodayPaymentItem[] = todayPayments.map((p) => {
    // Parse installment number if noted in description or notes
    let instNo: number | null = null;
    const match = (p.notes || "").match(/#(\d+)/);
    if (match) instNo = Number(match[1]);

    const loanPayments = paymentsByLoan.get(p.loanId) || [];
    let paidBefore = 0;
    for (const prior of loanPayments) {
      if (prior.id === p.id) break;
      paidBefore += prior.amount;
    }

    const isAdvInt = p.loan?.loanCalculationType === "ADVANCE_INTEREST" || Boolean((p.loan as any)?.advanceInterest && (p.loan as any)?.advanceInterest > 0);
    const totPayable = p.loan?.totalPayable && p.loan.totalPayable > 0
      ? p.loan.totalPayable
      : (p.loan?.principalAmount ? (p.loan.principalAmount + (isAdvInt ? 0 : ((p.loan.interestOutstanding || 0) + (p.loan.interestPaid || 0)))) : 0);

    const prevOutstanding = totPayable > 0 ? Math.max(0, Math.round((totPayable - paidBefore) * 100) / 100) : 0;
    const currOutstanding = Math.max(0, Math.round((prevOutstanding - p.amount) * 100) / 100);

    const custAddr = (() => {
      const a = (p.customer?.address || "").trim();
      const c = (p.customer?.city || "").trim();
      if (a && c) {
        if (a.toLowerCase().includes(c.toLowerCase())) return a;
        return `${a}, ${c}`;
      }
      return a || c || "";
    })();

    return {
      id: p.id,
      paymentNo: p.paymentNo,
      loanId: p.loanId,
      loanNo: p.loan?.loanNo || "",
      customerId: p.customerId,
      customerName: p.customer?.name || "",
      customerCode: (p.customer as any)?.customerCode || "",
      mobile: p.customer?.mobile || "",
      address: custAddr,
      installmentNumber: instNo,
      installmentNo: instNo,
      collectionDate: formatISTDateTime(p.date),
      date: toISTDateString(p.date),
      amount: p.amount,
      amountCollected: p.amount,
      principalPortion: p.principalPortion,
      interestPortion: p.interestPortion,
      principal: p.principalPortion,
      principalPaid: p.principalPortion,
      interest: p.interestPortion,
      interestPaid: p.interestPortion,
      paymentMethod: p.paymentMethod,
      status: "PAID",
      notes: p.notes,
      previousOutstanding: prevOutstanding,
      currentOutstanding: currOutstanding,
      remainingOutstanding: currOutstanding,
      loanCalculationType: p.loan?.loanCalculationType || "STANDARD",
      loan: p.loan,
      customer: p.customer ? {
        ...p.customer,
        address: custAddr || p.customer.address,
      } : undefined,
    };
  });

  const overdue: InstallmentScheduleItem[] = overdueInstallments.map((inst) =>
    mapInstallmentToItem(inst, targetDateStr)
  );

  // Reconciled Financial Totals
  const todayDueAmount = todayDue.reduce((s, i) => s + i.dueAmount, 0);
  const todayDueCount = todayDue.length;

  const todayCollectedOnDue = todayDue.reduce((s, i) => s + i.paidAmount, 0);
  const todayPendingAmount = todayPending.reduce((s, i) => s + i.pendingAmount, 0);
  const todayPendingCount = todayPending.length;

  const todayCollectedAmount = collectedToday.reduce((s, p) => s + p.amount, 0);
  const todayCollectedCount = collectedToday.length;

  const overdueAmount = overdue.reduce((s, i) => s + i.pendingAmount, 0);
  const overdueCount = overdue.length;

  // Due = Collected On Due + Pending On Due
  const reconciled = Math.abs(todayDueAmount - (todayCollectedOnDue + todayPendingAmount)) < 0.01;

  // Build Customer-Wise Grouping for pending collections (used by expandable UI)
  const customerMap = new Map<string, CustomerPendingSummary>();

  for (const item of todayPending) {
    if (!customerMap.has(item.customerId)) {
      customerMap.set(item.customerId, {
        customerId: item.customerId,
        customerName: item.customerName,
        customerCode: item.customerCode,
        mobile: item.mobile,
        address: item.address,
        loans: [],
        loanNumbers: item.loanNo,
        pendingInstallmentsCount: 0,
        totalExpectedAmount: 0,
        totalCollectedAmount: 0,
        totalPendingAmount: 0,
        status: item.status === "PARTIAL" ? "PARTIAL" : "PENDING",
        installments: [],
      });
    }

    const group = customerMap.get(item.customerId)!;
    if (!group.loans.some((l) => l.loanId === item.loanId)) {
      group.loans.push({ loanId: item.loanId, loanNo: item.loanNo });
      group.loanNumbers = group.loans.map((l) => l.loanNo).join(", ");
    }

    const pendingItem: PendingInstallmentItem = {
      ...item,
      expectedAmount: item.dueAmount,
      collectedAmount: item.paidAmount,
    };

    group.installments.push(pendingItem);
    group.pendingInstallmentsCount += 1;
    group.totalExpectedAmount += item.dueAmount;
    group.totalCollectedAmount += item.paidAmount;
    group.totalPendingAmount += item.pendingAmount;

    if (item.status === "OVERDUE") group.status = "OVERDUE";
    else if (item.status === "PARTIAL" && group.status !== "OVERDUE") group.status = "PARTIAL";
  }

  const customers = Array.from(customerMap.values()).sort((a, b) =>
    a.customerName.localeCompare(b.customerName)
  );

  // Optional search filtering
  const q = (options?.q || "").trim().toLowerCase();
  const applyFilter = <T extends { customerName: string; loanNo: string; mobile: string }>(
    list: T[]
  ): T[] => {
    if (!q) return list;
    return list.filter(
      (item) =>
        item.customerName.toLowerCase().includes(q) ||
        item.loanNo.toLowerCase().includes(q) ||
        item.mobile.includes(q)
    );
  };

  return {
    success: true,
    date: targetDateStr,
    dateDisplay: formatISTDisplay(range.start),
    summary: {
      todayDueAmount,
      todayDueCount,
      todayCollectedAmount,
      todayCollectedCount,
      todayPendingAmount,
      todayPendingCount,
      todayCollectedOnDue,
      overdueAmount,
      overdueCount,
      futureCount,
      reconciled,
    },
    todayDue: applyFilter(todayDue),
    todayPending: applyFilter(todayPending),
    collectedToday: applyFilter(collectedToday),
    overdue: applyFilter(overdue),
    customers,
  };
}

/**
 * Get Today's Collection Visit List (Tab 1 view & backward compatibility)
 */
export async function getTodayCollectionList(dateStr?: string) {
  const schedule = await getCollectionSchedule(dateStr);
  return {
    date: schedule.date,
    totalCustomers: schedule.summary.todayDueCount,
    totalAmountToCollect: schedule.summary.todayDueAmount,
    totalCollected: schedule.summary.todayCollectedOnDue,
    totalRemaining: schedule.summary.todayPendingAmount,
    items: schedule.todayDue,
  };
}

/**
 * Get Pending Collection List (Tab 2 view & backward compatibility)
 */
export async function getPendingCollectionList(dateStr?: string) {
  const schedule = await getCollectionSchedule(dateStr);
  return {
    date: schedule.date,
    totalPendingCustomers: schedule.customers.length,
    totalPendingInstallments: schedule.summary.todayPendingCount,
    totalPendingAmount: schedule.summary.todayPendingAmount,
    items: schedule.todayPending,
    customers: schedule.customers,
  };
}

/**
 * Record collection for an installment with actual Collection Date
 */
export async function recordCollectionForInstallment(data: {
  installmentId: string;
  amount: number;
  principalPortion?: number;
  interestPortion?: number;
  collectionDate?: string; // YYYY-MM-DD
  paymentMethod?: string;
  notes?: string;
}) {
  const { installmentId, amount, principalPortion, interestPortion, collectionDate, paymentMethod, notes } = data;

  if (!amount || amount <= 0) {
    throw new Error("Valid collection amount is required");
  }

  const installment = await prisma.loanInstallment.findUnique({
    where: { id: installmentId },
    include: { loan: true, customer: true },
  });

  if (!installment) {
    throw new Error("Installment record not found");
  }

  if (installment.status === "COLLECTED" || installment.paidAmount >= installment.installmentAmount) {
    throw new Error("Installment has already been collected");
  }

  const loan = installment.loan;

  const isAdvanceInterest = loan.loanCalculationType === "ADVANCE_INTEREST" || Boolean((loan as any).advanceInterest && (loan as any).advanceInterest > 0);
  const remInterestOutstanding = Math.max(0, loan.interestOutstanding || 0);

  // Split allocation
  let pPortion = Number(principalPortion);
  let iPortion = Number(interestPortion);

  if (isAdvanceInterest || remInterestOutstanding <= 0 || installment.interestPortion === 0) {
    // Pure principal recovery for Advance Interest or zero interest loans
    iPortion = 0;
    pPortion = amount;
  } else if (isNaN(pPortion) || isNaN(iPortion) || Math.round((pPortion + iPortion) * 100) !== Math.round(amount * 100)) {
    // Scheduled installment interest split
    const remInterest = Math.max(0, installment.interestPortion - installment.interestPaid);
    iPortion = Math.min(remInterest, Math.min(remInterestOutstanding, amount));
    pPortion = amount - iPortion;
  } else {
    // Validate client split: cap interest at remaining installment interest and loan interest outstanding
    const remInterest = Math.max(0, installment.interestPortion - installment.interestPaid);
    const maxAllowedInterest = Math.min(remInterest, remInterestOutstanding);
    iPortion = Math.min(Math.max(0, iPortion), maxAllowedInterest);
    pPortion = amount - iPortion;
  }

  // Authoritative collection timestamp in IST
  let paymentDate = new Date();
  if (collectionDate && /^\d{4}-\d{2}-\d{2}$/.test(collectionDate)) {
    const [y, m, d] = collectionDate.split("-").map(Number);
    const now = new Date();
    const utcMs = Date.UTC(y, m - 1, d, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds());
    paymentDate = new Date(utcMs);
  }

  // Authoritative loan-level outstanding balance before this payment
  const priorPayments = await prisma.loanPayment.findMany({
    where: { loanId: loan.id },
  });
  const paidBefore = priorPayments.reduce((s, p) => s + p.amount, 0);
  const totalPayable = loan.totalPayable && loan.totalPayable > 0
    ? loan.totalPayable
    : (loan.principalAmount + (isAdvanceInterest ? 0 : ((loan.interestOutstanding || 0) + (loan.interestPaid || 0))));
  const previousOutstanding = Math.max(0, Math.round((totalPayable - paidBefore) * 100) / 100);
  const remainingOutstanding = Math.max(0, Math.round((previousOutstanding - amount) * 100) / 100);

  const newPaidAmount = installment.paidAmount + amount;
  const isFullyPaid = newPaidAmount >= installment.installmentAmount;
  const newStatus = isFullyPaid ? "COLLECTED" : "PARTIALLY_PAID";

  // 1. Update Installment
  const updatedInstallment = await prisma.loanInstallment.update({
    where: { id: installmentId },
    data: {
      paidAmount: newPaidAmount,
      principalPaid: { increment: pPortion },
      interestPaid: { increment: iPortion },
      status: newStatus,
      actualPaymentDate: paymentDate,
      paymentMethod: paymentMethod || "CASH",
      notes: notes || undefined,
    },
  });

  // 2. Update Loan outstanding balances
  const newPrincipalOutstanding = Math.max(0, Math.round((loan.principalOutstanding - pPortion) * 100) / 100);
  const newInterestOutstanding = Math.max(0, Math.round((loan.interestOutstanding - iPortion) * 100) / 100);
  const isLoanClosed = newPrincipalOutstanding <= 0 && (isAdvanceInterest || newInterestOutstanding <= 0);

  const updatedLoan = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      principalPaid: { increment: pPortion },
      interestPaid: { increment: iPortion },
      principalOutstanding: newPrincipalOutstanding,
      interestOutstanding: newInterestOutstanding,
      status: isLoanClosed ? "CLOSED" : loan.status,
      closedAt: isLoanClosed ? new Date() : undefined,
    },
  });

  // 3. Create LoanPayment record with authoritative ABC/RCPT/YYYY/000001 sequence
  const paymentNo = await getNextReceiptNumber();
  const payment = await prisma.loanPayment.create({
    data: {
      paymentNo,
      loanId: loan.id,
      customerId: loan.customerId,
      amount,
      principalPortion: pPortion,
      interestPortion: iPortion,
      paymentMethod: paymentMethod || "CASH",
      date: paymentDate,
      notes: notes || `Installment #${installment.installmentNumber} Collection`,
    },
    include: {
      loan: true,
      customer: true,
    },
  });

  // 4. Double-entry accounting posting
  await postLoanCollection({
    loanId: loan.id,
    customerName: installment.customer.name,
    totalAmount: amount,
    principalPortion: pPortion,
    interestPortion: iPortion,
    paymentMethod: paymentMethod || "CASH",
    date: paymentDate,
  });

  // 5. Audit Log
  await prisma.auditLog.create({
    data: {
      action: "PAYMENT",
      entity: "LOAN",
      entityId: loan.id,
      performedBy: "Admin",
      details: `Collected ₹${amount} from ${installment.customer.name} for Installment #${installment.installmentNumber} of loan ${loan.loanNo}. Scheduled: ${toISTDateString(installment.dueDate)}, Actual Collection: ${toISTDateString(paymentDate)}, Status: ${isFullyPaid ? "PAID" : "PARTIAL"}`,
    },
  });

  // 6. Broadcast real-time sync event
  syncEvents.broadcast("COLLECTION_RECORDED", {
    installmentId: updatedInstallment.id,
    loanId: loan.id,
    customerId: loan.customerId,
    customerName: installment.customer.name,
    amount,
    date: paymentDate,
    status: isFullyPaid ? "PAID" : "PARTIAL",
  });

  return {
    installment: updatedInstallment,
    payment: {
      ...payment,
      previousOutstanding,
      currentOutstanding: remainingOutstanding,
      remainingOutstanding,
    },
    loan: updatedLoan,
    previousOutstanding,
    currentOutstanding: remainingOutstanding,
    remainingOutstanding,
  };
}
