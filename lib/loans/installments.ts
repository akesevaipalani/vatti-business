import { prisma } from "@/lib/prisma";
import { calculateLoan } from "@/lib/loans/calculator";
import { postLoanCollection } from "@/lib/accounting/engine";
import { syncEvents } from "@/lib/sync/events";
import { getNextReceiptNumber } from "@/lib/documents/numbering";

export interface InstallmentScheduleItem {
  id: string;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  installmentNumber: number;
  scheduledCollectionDate: string; // ISO / YYYY-MM-DD
  amountToCollect: number;
  principal: number;
  interest: number;
  paidAmount: number;
  remainingAmount: number;
  status: "PENDING" | "COLLECTED" | "PARTIALLY_PAID" | "OVERDUE";
  actualPaymentDate?: string | null;
}

export interface PendingInstallmentItem {
  id: string;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  installmentNumber: number;
  dueDate: string;
  expectedAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  principal: number;
  interest: number;
  status: "PENDING" | "PARTIALLY_PAID" | "OVERDUE";
}

export interface CustomerPendingSummary {
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  loans: Array<{ loanId: string; loanNo: string }>;
  loanNumbers: string;
  pendingInstallmentsCount: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
  totalPendingAmount: number;
  status: "PENDING" | "PARTIALLY_PAID" | "OVERDUE";
  installments: PendingInstallmentItem[];
}

// Helper to format Date to YYYY-MM-DD in local time
export function formatDateToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to parse YYYY-MM-DD into start and end of that day (UTC boundary friendly)
export function getDayRange(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Generate LoanInstallment records for a specific loan based on calculateLoan()
 */
export async function generateInstallmentsForLoan(loanId: string) {
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
  const calc = calculateLoan({
    principal: loan.principalAmount,
    loanCalculationType: (l.loanCalculationType as "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL") || "STANDARD",
    interestRate: loan.interestRate,
    interestType: loan.interestType as "FLAT" | "REDUCING" | "SIMPLE",
    advanceInterestAmount: l.advanceInterest,
    customInterestAmount: loan.totalPayable > loan.principalAmount ? (loan.totalPayable - loan.principalAmount) : undefined,
    customInstallmentAmount: loan.installmentAmount,
    processingFee: loan.processingFee,
    interestFrequency: loan.interestFrequency as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY",
    paymentFrequency: loan.paymentFrequency as "DAILY" | "WEEKLY" | "MONTHLY",
    totalInstallments: loan.totalInstallments,
    startDate: loan.date,
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const installmentData = calc.schedule.map((item) => {
    const [y, m, d] = item.dueDate.split("-").map(Number);
    const dueDate = new Date(y, m - 1, d, 12, 0, 0); // Midday to avoid timezone drift
    const isPastDue = dueDate < now;

    return {
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

  for (const inst of installmentData) {
    await prisma.loanInstallment.create({
      data: inst,
    });
  }
}

/**
 * Bootstrap installments for any active loan that does not have installments in the database
 */
export async function bootstrapExistingLoans() {
  const activeLoans = await prisma.loan.findMany({
    where: { status: { in: ["ACTIVE", "OVERDUE"] } },
    include: { payments: { orderBy: { date: "asc" } } },
  });

  for (const loan of activeLoans) {
    const count = await prisma.loanInstallment.count({
      where: { loanId: loan.id },
    });

    if (count === 0) {
      await generateInstallmentsForLoan(loan.id);

      // If loan already has payments recorded, reconcile them FIFO
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
}

/**
 * Get Today's Collection Visit List (strictly based on scheduled collection date)
 */
export async function getTodayCollectionList(dateStr?: string) {
  await bootstrapExistingLoans();

  const targetDateStr = dateStr || formatDateToYMD(new Date());
  const { start, end } = getDayRange(targetDateStr);

  const installments = await prisma.loanInstallment.findMany({
    where: {
      dueDate: {
        gte: start,
        lte: end,
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

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const items: InstallmentScheduleItem[] = installments.map((inst) => {
    let status: "PENDING" | "COLLECTED" | "PARTIALLY_PAID" | "OVERDUE" = "PENDING";
    if (inst.paidAmount >= inst.installmentAmount) {
      status = "COLLECTED";
    } else if (inst.paidAmount > 0) {
      status = "PARTIALLY_PAID";
    } else if (new Date(inst.dueDate) < now) {
      status = "OVERDUE";
    }

    const remainingAmount = Math.max(0, inst.installmentAmount - inst.paidAmount);

    return {
      id: inst.id,
      loanId: inst.loanId,
      loanNo: inst.loan.loanNo,
      customerId: inst.customerId,
      customerName: inst.customer.name,
      mobile: inst.customer.mobile,
      address: inst.customer.address || inst.customer.city || "-",
      installmentNumber: inst.installmentNumber,
      scheduledCollectionDate: formatDateToYMD(new Date(inst.dueDate)),
      amountToCollect: inst.installmentAmount,
      principal: inst.principalPortion,
      interest: inst.interestPortion,
      paidAmount: inst.paidAmount,
      remainingAmount,
      status,
      actualPaymentDate: inst.actualPaymentDate ? formatDateToYMD(new Date(inst.actualPaymentDate)) : null,
    };
  });

  const totalCustomers = items.length;
  const totalAmountToCollect = items.reduce((s, i) => s + i.amountToCollect, 0);
  const totalCollected = items.reduce((s, i) => s + i.paidAmount, 0);
  const totalRemaining = items.reduce((s, i) => s + i.remainingAmount, 0);

  return {
    date: targetDateStr,
    totalCustomers,
    totalAmountToCollect,
    totalCollected,
    totalRemaining,
    items,
  };
}

/**
 * Get Pending Collection List (Customer-Wise Pending View for Selected Date)
 */
export async function getPendingCollectionList(dateStr?: string) {
  await bootstrapExistingLoans();

  const targetDateStr = dateStr || formatDateToYMD(new Date());
  const { start, end } = getDayRange(targetDateStr);

  const installments = await prisma.loanInstallment.findMany({
    where: {
      loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
      dueDate: {
        gte: start,
        lte: end,
      },
      status: { not: "COLLECTED" },
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

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Group uncollected/partially-paid installments by customerId
  const customerMap = new Map<
    string,
    {
      customerId: string;
      customerName: string;
      mobile: string;
      address: string;
      loansMap: Map<string, string>;
      installments: PendingInstallmentItem[];
    }
  >();

  for (const inst of installments) {
    const pendingAmount = Math.max(0, inst.installmentAmount - inst.paidAmount);
    if (pendingAmount <= 0) continue; // Exclude if already fully collected

    let status: "PENDING" | "PARTIALLY_PAID" | "OVERDUE" = "PENDING";
    if (inst.paidAmount > 0) {
      status = "PARTIALLY_PAID";
    } else if (new Date(inst.dueDate) < now) {
      status = "OVERDUE";
    }

    const item: PendingInstallmentItem = {
      id: inst.id,
      loanId: inst.loanId,
      loanNo: inst.loan.loanNo,
      customerId: inst.customerId,
      customerName: inst.customer.name,
      mobile: inst.customer.mobile,
      address: inst.customer.address || inst.customer.city || "-",
      installmentNumber: inst.installmentNumber,
      dueDate: formatDateToYMD(new Date(inst.dueDate)),
      expectedAmount: inst.installmentAmount,
      collectedAmount: inst.paidAmount,
      pendingAmount,
      principal: inst.principalPortion,
      interest: inst.interestPortion,
      status,
    };

    if (!customerMap.has(inst.customerId)) {
      customerMap.set(inst.customerId, {
        customerId: inst.customerId,
        customerName: inst.customer.name,
        mobile: inst.customer.mobile,
        address: inst.customer.address || inst.customer.city || "-",
        loansMap: new Map<string, string>(),
        installments: [],
      });
    }

    const group = customerMap.get(inst.customerId)!;
    group.loansMap.set(inst.loanId, inst.loan.loanNo);
    group.installments.push(item);
  }

  const customers: CustomerPendingSummary[] = [];
  let allPendingInstallmentsCount = 0;
  let allPendingAmount = 0;

  for (const group of customerMap.values()) {
    group.installments.sort((a, b) => a.installmentNumber - b.installmentNumber);

    const totalExpectedAmount = group.installments.reduce((s, i) => s + i.expectedAmount, 0);
    const totalCollectedAmount = group.installments.reduce((s, i) => s + i.collectedAmount, 0);
    const totalPendingAmount = group.installments.reduce((s, i) => s + i.pendingAmount, 0);

    let status: "PENDING" | "PARTIALLY_PAID" | "OVERDUE" = "PENDING";
    if (group.installments.some((i) => i.status === "OVERDUE")) {
      status = "OVERDUE";
    } else if (group.installments.some((i) => i.status === "PARTIALLY_PAID")) {
      status = "PARTIALLY_PAID";
    }

    const loans = Array.from(group.loansMap.entries()).map(([loanId, loanNo]) => ({
      loanId,
      loanNo,
    }));
    const loanNumbers = loans.map((l) => l.loanNo).join(", ");

    customers.push({
      customerId: group.customerId,
      customerName: group.customerName,
      mobile: group.mobile,
      address: group.address,
      loans,
      loanNumbers,
      pendingInstallmentsCount: group.installments.length,
      totalExpectedAmount,
      totalCollectedAmount,
      totalPendingAmount,
      status,
      installments: group.installments,
    });

    allPendingInstallmentsCount += group.installments.length;
    allPendingAmount += totalPendingAmount;
  }

  customers.sort((a, b) => a.customerName.localeCompare(b.customerName));

  return {
    date: targetDateStr,
    totalPendingCustomers: customers.length,
    totalPendingInstallments: allPendingInstallmentsCount,
    totalPendingAmount: allPendingAmount,
    customers,
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
  collectionDate: string; // YYYY-MM-DD
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

  // Split allocation
  let pPortion = Number(principalPortion);
  let iPortion = Number(interestPortion);

  if (isNaN(pPortion) || isNaN(iPortion) || pPortion + iPortion === 0) {
    // Default split: proportional to installment schedule or interest first
    const remInterest = Math.max(0, installment.interestPortion - installment.interestPaid);
    iPortion = Math.min(remInterest, amount);
    pPortion = amount - iPortion;
  }

  // Parse actual collection date
  let paymentDate = new Date();
  if (collectionDate && /^\d{4}-\d{2}-\d{2}$/.test(collectionDate)) {
    const [y, m, d] = collectionDate.split("-").map(Number);
    const now = new Date();
    paymentDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
  }

  const newPaidAmount = installment.paidAmount + amount;
  const newStatus = newPaidAmount >= installment.installmentAmount ? "COLLECTED" : "PARTIALLY_PAID";

  // 1. Update Installment (PRESERVE scheduled dueDate!)
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
  const newPrincipalOutstanding = Math.max(0, loan.principalOutstanding - pPortion);
  const newInterestOutstanding = Math.max(0, loan.interestOutstanding - iPortion);
  const isFullyPaid = newPrincipalOutstanding <= 0 && newInterestOutstanding <= 0;

  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      principalPaid: { increment: pPortion },
      interestPaid: { increment: iPortion },
      principalOutstanding: newPrincipalOutstanding,
      interestOutstanding: newInterestOutstanding,
      status: isFullyPaid ? "CLOSED" : loan.status,
      closedAt: isFullyPaid ? new Date() : undefined,
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
      details: `Collected ₹${amount} from ${installment.customer.name} for Installment #${installment.installmentNumber} of loan ${loan.loanNo}. Scheduled: ${formatDateToYMD(installment.dueDate)}, Actual Collection: ${formatDateToYMD(paymentDate)}, Status: ${newStatus}`,
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
    status: newStatus,
  });

  return { installment: updatedInstallment, payment };
}
