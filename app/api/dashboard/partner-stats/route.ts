import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      todayPayments,
      allPayments,
      activeLoans,
      pendingInstallments,
      totalCustomers,
      partnerRecord,
    ] = await Promise.all([
      // Today's collections
      prisma.loanPayment.findMany({
        where: { date: { gte: todayStart } },
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
      // Pending scheduled installments
      prisma.loanInstallment.findMany({
        where: {
          loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
          status: { in: ["PENDING", "PARTIALLY_PAID", "OVERDUE"] },
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
    ]);

    const todayCollectionsCount = todayPayments.length;
    const todayCollectionAmount = todayPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalCollectionsAmount = allPayments.reduce((sum, p) => sum + p.amount, 0);

    const pendingCollectionsCount = pendingInstallments.length;
    const pendingCollectionsAmount = pendingInstallments.reduce(
      (sum, i) => sum + Math.max(0, i.installmentAmount - i.paidAmount),
      0
    );

    const activeLoanCount = activeLoans.length;
    // Set of distinct customer IDs that have active loans
    const activeCustomerIds = new Set(activeLoans.map((l) => l.customerId));
    const activeCustomerCount = activeCustomerIds.size;

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
        todayCollectionsCount,
        todayCollectionAmount,
        pendingCollectionsCount,
        pendingCollectionsAmount,
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
