import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getISTDayRange } from "@/lib/date";
import { getDashboardFinancialStats } from "@/lib/financials/stats";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const todayRange = getISTDayRange();

    const [
      todayPayments,
      allPayments,
      activeLoans,
      todayInstallments,
      overdueInstallments,
      totalCustomers,
      partnerRecord,
      dashStats,
    ] = await Promise.all([
      // Today's collections
      prisma.loanPayment.findMany({
        where: { date: { gte: todayRange.start, lte: todayRange.end } },
        select: { amount: true },
      }),
      // Total collections to date
      prisma.loanPayment.findMany({
        select: { amount: true },
      }),
      // Active & Overdue loans count
      prisma.loan.findMany({
        where: { status: { in: ["ACTIVE", "OVERDUE"] } },
        select: { id: true, customerId: true },
      }),
      // Today's scheduled installments
      prisma.loanInstallment.findMany({
        where: {
          loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
          dueDate: { gte: todayRange.start, lte: todayRange.end },
        },
        select: { installmentAmount: true, paidAmount: true, customerId: true },
      }),
      // Overdue installments
      prisma.loanInstallment.findMany({
        where: {
          loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
          dueDate: { lt: todayRange.start },
          status: { not: "COLLECTED" },
        },
        select: { installmentAmount: true, paidAmount: true },
      }),
      // Total registered customers
      prisma.customer.count(),
      // Self partner info if associated
      user.partnerId
        ? prisma.partner.findUnique({
            where: { id: user.partnerId },
            select: { id: true, name: true, partnerCode: true },
          })
        : null,
      getDashboardFinancialStats(),
    ]);

    const todayCollectionsCount = todayPayments.length;
    const todayCollectionAmount = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalCollectionsAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);

    const todayDueAmount = todayInstallments.reduce((sum, i) => sum + i.installmentAmount, 0);
    const todayDueCount = todayInstallments.length;

    const todayPendingInstallments = todayInstallments.filter((i) => i.paidAmount < i.installmentAmount);
    const todayPendingAmount = todayPendingInstallments.reduce(
      (sum, i) => sum + Math.max(0, i.installmentAmount - i.paidAmount),
      0
    );
    const todayPendingCount = todayPendingInstallments.length;
    const todayPendingCustomers = new Set(todayPendingInstallments.map((i) => i.customerId)).size;

    const overdueAmount = overdueInstallments.reduce(
      (sum, i) => sum + Math.max(0, i.installmentAmount - i.paidAmount),
      0
    );
    const overdueCount = overdueInstallments.length;

    const activeLoanCount = activeLoans.length;
    const activeCustomerIds = new Set(activeLoans.map((l) => l.customerId));
    const activeCustomerCount = activeCustomerIds.size;
    const availableCash = dashStats.kpis.availableCash;

    return NextResponse.json({
      role: user.role,
      partner: partnerRecord
        ? {
            name: partnerRecord.name,
            code: partnerRecord.partnerCode,
          }
        : {
            name: user.name,
            code: user.username.toUpperCase(),
          },
      stats: {
        availableCash,
        todayDueAmount,
        todayDueCount,
        todayCollectionsCount,
        todayCollectionAmount,
        pendingCollectionsCount: todayPendingCount,
        pendingCollectionsAmount: todayPendingAmount,
        todayPendingAmount,
        todayPendingCount,
        todayPendingCustomers,
        overdueAmount,
        overdueCount,
        totalCollectionsAmount,
        activeCustomerCount,
        totalCustomers,
        activeLoanCount,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load partner dashboard statistics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
