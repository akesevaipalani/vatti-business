import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { type, amount, referenceNo, description } = body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: "Valid amount is required" }, { status: 400 });
    }

    const bank = await prisma.bankAccount.findUnique({ where: { id } });
    if (!bank) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
    }

    const isDeposit = type === "DEPOSIT" || type === "TRANSFER_IN";
    const delta = isDeposit ? numAmount : -numAmount;

    if (!isDeposit && numAmount > bank.currentBalance) {
      return NextResponse.json(
        { error: `Insufficient bank balance (Current: ₹${bank.currentBalance})` },
        { status: 400 }
      );
    }

    // 1. Create Transaction
    const txn = await prisma.bankTransaction.create({
      data: {
        bankAccountId: id,
        type: type || "DEPOSIT",
        amount: numAmount,
        referenceNo,
        description,
      },
    });

    // 2. Update Bank currentBalance
    const updatedBank = await prisma.bankAccount.update({
      where: { id },
      data: {
        currentBalance: { increment: delta },
      },
    });

    // 3. If it's a cash deposit or cash withdrawal, update CashAccount too!
    if (type === "DEPOSIT") {
      await prisma.cashAccount.update({
        where: { id: "main-cash" },
        data: { currentBalance: { decrement: numAmount } },
      });
    } else if (type === "WITHDRAWAL") {
      await prisma.cashAccount.update({
        where: { id: "main-cash" },
        data: { currentBalance: { increment: numAmount } },
      });
    }

    return NextResponse.json({ success: true, txn, currentBalance: updatedBank.currentBalance });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
