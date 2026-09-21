import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        loans: {
          include: {
            payments: { orderBy: { date: "desc" } },
          },
          orderBy: { date: "desc" },
        },
        guarantors: true,
        collaterals: true,
        payments: { orderBy: { date: "desc" } },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json({ customer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, mobile, whatsapp, email, address, city, occupation, referencePerson, notes } = body;

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name,
        mobile,
        whatsapp,
        email,
        address,
        city,
        occupation,
        referencePerson,
        notes,
      },
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        loans: true,
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Clean up ledger transactions specifically linked to this customer's loans
    const loanIds = customer.loans.map((l) => l.id);
    if (loanIds.length > 0) {
      await prisma.ledgerTransaction.deleteMany({
        where: {
          referenceId: { in: loanIds },
        },
      });
    }

    // Safely delete customer (cascades to loans, installments, payments, guarantors, collaterals)
    await prisma.customer.delete({ where: { id } });

    // Safe audit logging
    await prisma.auditLog.create({
      data: {
        action: "DELETE",
        entity: "CUSTOMER",
        entityId: id,
        details: `Deleted customer: ${customer.name} (${customer.customerCode}) with ${customer.loans.length} associated loan(s)`,
        performedBy: "Admin",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
