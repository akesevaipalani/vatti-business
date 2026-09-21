import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { notes, paymentMethod, referenceNo } = body;

    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        investments: true,
        withdrawals: true,
        profitAllocations: true,
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const capitalAdded = partner.investments.reduce((s, i) => s + i.amount, 0);
    const capitalWithdrawn = partner.withdrawals.reduce((s, w) => s + w.amount, 0);
    const profitAdded = partner.profitAllocations.reduce((s, p) => s + p.allocatedProfit, 0);
    const closingBalance = partner.currentCapital;

    const settlementCode = `SETL-PRT-${Date.now().toString().slice(-6)}`;

    const settlement = await prisma.partnerSettlement.create({
      data: {
        settlementCode,
        partnerId: id,
        openingBalance: partner.initialCapital,
        capitalAdded,
        capitalWithdrawn,
        profitAdded,
        closingBalance,
        paymentMethod: paymentMethod || "BANK",
        referenceNo,
        notes: notes || "Periodic Account Settlement Statement",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "SETTLEMENT",
        entity: "PARTNER",
        entityId: id,
        performedBy: "Admin",
        details: `Generated settlement ${settlementCode} for partner ${partner.name}. Closing Balance: ₹${closingBalance}`,
      },
    });

    return NextResponse.json({ success: true, settlement });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record settlement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
