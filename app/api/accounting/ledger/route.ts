import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultAccounts } from "@/lib/accounting/engine";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    await ensureDefaultAccounts();

    const { searchParams } = new URL(req.url);
    const accountCode = searchParams.get("accountCode");

    const accounts = await prisma.ledgerAccount.findMany({
      orderBy: { code: "asc" },
    });

    const where: Prisma.LedgerEntryWhereInput = {};
    if (accountCode && accountCode !== "ALL") {
      where.account = { code: accountCode };
    }

    const entries = await prisma.ledgerEntry.findMany({
      where,
      include: {
        account: true,
        ledgerTransaction: true,
      },
      orderBy: { ledgerTransaction: { date: "desc" } },
      take: 100,
    });

    // Verification: sum of all debits vs credits in system
    const allEntries = await prisma.ledgerEntry.findMany({
      select: { entryType: true, amount: true },
    });
    const totalDebits = allEntries.filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0);
    const totalCredits = allEntries.filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0);

    return NextResponse.json({
      accounts,
      entries,
      totalDebits,
      totalCredits,
      isBalanced: Math.abs(totalDebits - totalCredits) < 0.05,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch ledger";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
