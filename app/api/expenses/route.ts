import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postExpensePosting } from "@/lib/accounting/engine";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const where: Prisma.ExpenseWhereInput = {};
    if (category && category !== "ALL") {
      where.category = category;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const totalAmount = expenses.reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({ expenses, totalAmount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch expenses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { category, description, amount, paymentMethod, paidBy, referenceNo, notes } = body;

    const numAmount = Number(amount);
    if (!description || !numAmount || numAmount <= 0) {
      return NextResponse.json({ error: "Description and valid amount are required" }, { status: 400 });
    }

    const count = await prisma.expense.count();
    const expenseNo = `EXP-2026-${String(count + 1).padStart(3, "0")}`;

    const expense = await prisma.expense.create({
      data: {
        expenseNo,
        category: category || "OTHER",
        description,
        amount: numAmount,
        paymentMethod: paymentMethod || "CASH",
        paidBy: paidBy || "Owner",
        referenceNo,
        notes,
      },
    });

    // Post double entry and decrement cash/bank
    await postExpensePosting({
      expenseId: expense.id,
      category: expense.category,
      amount: numAmount,
      paymentMethod: expense.paymentMethod,
      description: expense.description,
    });

    await prisma.auditLog.create({
      data: {
        action: "EXPENSE",
        entity: "EXPENSE",
        entityId: expense.id,
        performedBy: paidBy || "Admin",
        details: `Recorded ₹${numAmount} expense for ${category} (${description}) via ${paymentMethod}`,
      },
    });

    return NextResponse.json({ success: true, expense });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record expense";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
