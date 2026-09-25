import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { id } = await params;
    const partner = await prisma.partner.findUnique({
      where: { id },
      include: {
        investments: { orderBy: { date: "desc" } },
        withdrawals: { orderBy: { date: "desc" } },
        profitAllocations: { orderBy: { createdAt: "desc" } },
        settlements: { orderBy: { date: "desc" } },
      },
    });

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    return NextResponse.json({ partner });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch partner";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
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
    const { name, mobile, email, address, profitSharePercent, lossSharePercent, status, notes } = body;

    const updated = await prisma.partner.update({
      where: { id },
      data: {
        name,
        mobile,
        email,
        address,
        profitSharePercent: Number(profitSharePercent) || 0,
        lossSharePercent: Number(lossSharePercent) || 0,
        status,
        notes,
      },
    });

    return NextResponse.json({ success: true, partner: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update partner";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required" }, { status: 403 });
    }

    const { id } = await params;
    const partner = await prisma.partner.findUnique({ where: { id } });

    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 });
    }

    if (partner.currentCapital > 0) {
      return NextResponse.json(
        { error: "Cannot delete partner with active capital balance. Please settle account first." },
        { status: 400 }
      );
    }

    await prisma.partner.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete partner";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

