import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postPartnerInvestment } from "@/lib/accounting/engine";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const partners = await prisma.partner.findMany({
      include: {
        investments: { orderBy: { date: "desc" } },
        withdrawals: { orderBy: { date: "desc" } },
        profitAllocations: { orderBy: { createdAt: "desc" } },
        settlements: { orderBy: { date: "desc" } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ partners });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch partners";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }
    const body = await req.json();
    const {
      name,
      mobile,
      email,
      address,
      initialCapital,
      profitSharePercent,
      lossSharePercent,
      notes,
      paymentMethod,
    } = body;

    if (!name || !mobile) {
      return NextResponse.json({ error: "Partner name and mobile are required" }, { status: 400 });
    }

    const count = await prisma.partner.count();
    const partnerCode = `PRT-${String(count + 1).padStart(3, "0")}`;
    const capital = Number(initialCapital) || 0;

    const partner = await prisma.partner.create({
      data: {
        partnerCode,
        name,
        mobile,
        email,
        address,
        initialCapital: capital,
        currentCapital: capital,
        profitSharePercent: Number(profitSharePercent) || 0,
        lossSharePercent: Number(lossSharePercent) || 0,
        notes,
      },
    });

    // Record initial investment if capital > 0
    if (capital > 0) {
      const invCount = await prisma.partnerInvestment.count();
      const invCode = `INV-${String(invCount + 1).padStart(3, "0")}`;

      await prisma.partnerInvestment.create({
        data: {
          investmentCode: invCode,
          partnerId: partner.id,
          amount: capital,
          paymentMethod: paymentMethod || "CASH",
          notes: "Initial Capital Investment",
        },
      });

      // Post double-entry accounting
      await postPartnerInvestment({
        partnerId: partner.id,
        partnerName: partner.name,
        amount: capital,
        paymentMethod: paymentMethod || "CASH",
      });
    }

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "PARTNER",
        entityId: partner.id,
        performedBy: "Admin",
        details: `Created partner ${name} with initial capital ₹${capital}`,
      },
    });

    return NextResponse.json({ success: true, partner });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create partner";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
