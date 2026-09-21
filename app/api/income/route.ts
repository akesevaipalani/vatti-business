import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postIncomePosting } from "@/lib/accounting/engine";

export async function GET() {
  try {
    const incomes = await prisma.income.findMany({
      orderBy: { date: "desc" },
    });
    const totalAmount = incomes.reduce((s, i) => s + i.amount, 0);

    return NextResponse.json({ incomes, totalAmount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch income";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, description, amount, paymentMethod, referenceNo, notes } = body;

    const numAmount = Number(amount);
    if (!description || !numAmount || numAmount <= 0) {
      return NextResponse.json({ error: "Description and valid amount are required" }, { status: 400 });
    }

    const count = await prisma.income.count();
    const incomeNo = `INC-2026-${String(count + 1).padStart(3, "0")}`;

    const income = await prisma.income.create({
      data: {
        incomeNo,
        type: type || "OTHER",
        description,
        amount: numAmount,
        paymentMethod: paymentMethod || "CASH",
        referenceNo,
        notes,
      },
    });

    // Post double entry and increment cash/bank
    await postIncomePosting({
      incomeId: income.id,
      type: income.type,
      amount: numAmount,
      paymentMethod: income.paymentMethod,
      description: income.description,
    });

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "INCOME",
        entityId: income.id,
        performedBy: "Admin",
        details: `Recorded ₹${numAmount} other income (${type} - ${description}) via ${paymentMethod}`,
      },
    });

    return NextResponse.json({ success: true, income });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record income";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
