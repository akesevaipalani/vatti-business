import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");

    const where: Prisma.CustomerWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { mobile: { contains: q } },
        { customerCode: { contains: q } },
        { city: { contains: q } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        loans: {
          select: {
            id: true,
            loanNo: true,
            principalAmount: true,
            principalOutstanding: true,
            interestOutstanding: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const customersWithTotals = customers.map((c) => {
      const totalLoansCount = c.loans.length;
      const activeLoansCount = c.loans.filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE").length;
      const totalOutstanding = c.loans
        .filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE")
        .reduce((sum, l) => sum + l.principalOutstanding + l.interestOutstanding, 0);

      return {
        ...c,
        totalLoansCount,
        activeLoansCount,
        totalOutstanding,
      };
    });

    return NextResponse.json({ customers: customersWithTotals });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch customers";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, mobile, whatsapp, email, address, city, occupation, referencePerson, notes } = body;

    if (!name || !mobile) {
      return NextResponse.json({ error: "Name and mobile number are required" }, { status: 400 });
    }

    const count = await prisma.customer.count();
    const customerCode = `CUST-${String(count + 1).padStart(3, "0")}`;

    const customer = await prisma.customer.create({
      data: {
        customerCode,
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

    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "CUSTOMER",
        entityId: customer.id,
        performedBy: "Admin",
        details: `Created customer ${name} (${customerCode})`,
      },
    });

    return NextResponse.json({ success: true, customer });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create customer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
