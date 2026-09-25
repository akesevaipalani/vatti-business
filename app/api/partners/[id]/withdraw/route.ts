import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postPartnerWithdrawal } from "@/lib/accounting/engine";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { amount, reason, paymentMethod, referenceNo, notes, allowOverdraft } = body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: "Valid withdrawal amount is required" }, { status: 400 });
    }

    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    // Safety check: do not allow withdrawal beyond available capital unless overdraft enabled
    if (!allowOverdraft && numAmount > partner.currentCapital) {
      return NextResponse.json(
        {
          error: `Withdrawal amount (₹${numAmount}) exceeds available partner capital (₹${partner.currentCapital}). Enable overdraft to force.`,
        },
        { status: 400 }
      );
    }

    const withdrawalCode = `WDL-PRT-${Date.now().toString().slice(-6)}`;

    // 1. Create withdrawal record
    const withdrawal = await prisma.partnerWithdrawal.create({
      data: {
        withdrawalCode,
        partnerId: id,
        amount: numAmount,
        reason,
        paymentMethod: paymentMethod || "CASH",
        referenceNo,
        notes,
      },
    });

    // 2. Reduce partner capital
    const updatedPartner = await prisma.partner.update({
      where: { id },
      data: {
        currentCapital: { decrement: numAmount },
      },
    });

    // 3. Post double entry and reduce cash/bank
    await postPartnerWithdrawal({
      partnerId: id,
      partnerName: partner.name,
      amount: numAmount,
      paymentMethod: paymentMethod || "CASH",
      referenceNo,
    });

    // 4. Audit Log
    await prisma.auditLog.create({
      data: {
        action: "WITHDRAWAL",
        entity: "PARTNER",
        entityId: id,
        performedBy: "Admin",
        details: `Recorded ₹${numAmount} withdrawal by partner ${partner.name}. Remaining Capital: ₹${updatedPartner.currentCapital}`,
      },
    });

    return NextResponse.json({ success: true, withdrawal, currentCapital: updatedPartner.currentCapital });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process withdrawal";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
