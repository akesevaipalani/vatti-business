import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const bankAccounts = await prisma.bankAccount.findMany({
      include: {
        transactions: {
          orderBy: { date: "desc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ bankAccounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch bank accounts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bankName, accountName, accountNumber, ifsc, openingBalance } = body;

    if (!bankName || !accountNumber) {
      return NextResponse.json({ error: "Bank name and account number are required" }, { status: 400 });
    }

    const opBal = Number(openingBalance) || 0;
    const account = await prisma.bankAccount.create({
      data: {
        bankName,
        accountName: accountName || `${bankName} Account`,
        accountNumber,
        ifsc,
        openingBalance: opBal,
        currentBalance: opBal,
      },
    });

    return NextResponse.json({ success: true, account });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create bank account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
