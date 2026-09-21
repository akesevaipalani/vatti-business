import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const loans = await prisma.borrowedLoan.findMany({
      orderBy: { createdAt: "desc" },
    });
    const totalBorrowed = loans.reduce((s, l) => s + l.amount, 0);
    const totalBalance = loans.reduce((s, l) => s + l.balanceAmount, 0);

    return NextResponse.json({ loans, totalBorrowed, totalBalance });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch borrowed loans";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lenderName, contact, amount, interestRate, installmentAmount, dueDate, paymentMethod, notes } = body;

    const numAmount = Number(amount);
    if (!lenderName || !numAmount || numAmount <= 0) {
      return NextResponse.json({ error: "Lender name and valid amount are required" }, { status: 400 });
    }

    const count = await prisma.borrowedLoan.count();
    const loanCode = `BL-2026-${String(count + 1).padStart(3, "0")}`;

    const loan = await prisma.borrowedLoan.create({
      data: {
        loanCode,
        lenderName,
        contact,
        amount: numAmount,
        interestRate: Number(interestRate) || 0,
        installmentAmount: Number(installmentAmount) || 0,
        dueDate: dueDate ? new Date(dueDate) : null,
        paidAmount: 0,
        balanceAmount: numAmount,
        paymentMethod: paymentMethod || "BANK",
        status: "ACTIVE",
        notes,
      },
    });

    // If received in Cash, increment cash account
    if (paymentMethod === "CASH") {
      await prisma.cashAccount.update({
        where: { id: "main-cash" },
        data: { currentBalance: { increment: numAmount } },
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "BORROWED_LOAN",
        entityId: loan.id,
        performedBy: "Admin",
        details: `Recorded borrowed loan of ₹${numAmount} from ${lenderName}`,
      },
    });

    return NextResponse.json({ success: true, loan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record borrowed loan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
