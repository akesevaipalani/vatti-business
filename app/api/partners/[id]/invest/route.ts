import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postPartnerInvestment } from "@/lib/accounting/engine";
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
    const { amount, type, paymentMethod, referenceNo, purpose, notes } = body;

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: "Valid investment amount is required" }, { status: 400 });
    }

    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    const investmentCode = `INV-PRT-${Date.now().toString().slice(-6)}`;

    // 1. Create investment record
    const investment = await prisma.partnerInvestment.create({
      data: {
        investmentCode,
        partnerId: id,
        amount: numAmount,
        type: type || "ADDITIONAL",
        paymentMethod: paymentMethod || "CASH",
        referenceNo,
        purpose,
        notes,
      },
    });

    // 2. Increment partner capital
    const updatedPartner = await prisma.partner.update({
      where: { id },
      data: {
        currentCapital: { increment: numAmount },
      },
    });

    // 3. Post double entry transaction and update cash/bank
    await postPartnerInvestment({
      partnerId: id,
      partnerName: partner.name,
      amount: numAmount,
      paymentMethod: paymentMethod || "CASH",
      referenceNo,
    });

    // 4. Audit Log
    await prisma.auditLog.create({
      data: {
        action: "INVESTMENT",
        entity: "PARTNER",
        entityId: id,
        performedBy: "Admin",
        details: `Recorded ₹${numAmount} investment for partner ${partner.name}. New Capital: ₹${updatedPartner.currentCapital}`,
      },
    });

    return NextResponse.json({ success: true, investment, currentCapital: updatedPartner.currentCapital });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record investment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
