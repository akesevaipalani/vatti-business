import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "customer" | "loan" | "partner";
  url: string;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";

    if (!q.trim()) {
      return NextResponse.json({ results: [] });
    }

    const user = await getCurrentUser();
    const isAdmin = user?.role === "ADMIN";

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { mobile: { contains: q } },
          { customerCode: { contains: q } },
          { city: { contains: q } },
        ],
      },
      take: 5,
    });

    const loans = await prisma.loan.findMany({
      where: {
        OR: [
          { loanNo: { contains: q } },
          { customer: { name: { contains: q } } },
        ],
      },
      include: { customer: { select: { name: true } } },
      take: 5,
    });

    const partners = isAdmin
      ? await prisma.partner.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { mobile: { contains: q } },
              { partnerCode: { contains: q } },
            ],
          },
          take: 5,
        })
      : [];

    const results: SearchResult[] = [];

    customers.forEach((c) => {
      results.push({
        id: `c-${c.id}`,
        title: c.name,
        subtitle: `Customer • ${c.mobile} • ${c.city || "Madurai"}`,
        category: "customer",
        url: `/customers/${c.id}`,
      });
    });

    loans.forEach((l) => {
      results.push({
        id: `l-${l.id}`,
        title: `${l.loanNo} - ${l.customer.name}`,
        subtitle: `Loan • Principal: ₹${l.principalAmount.toLocaleString("en-IN")} • Status: ${l.status}`,
        category: "loan",
        url: `/loans/${l.id}`,
      });
    });

    if (isAdmin) {
      partners.forEach((p) => {
        results.push({
          id: `p-${p.id}`,
          title: p.name,
          subtitle: `Partner • Capital: ₹${p.currentCapital.toLocaleString("en-IN")} • Share: ${p.profitSharePercent}%`,
          category: "partner",
          url: `/partners/${p.id}`,
        });
      });
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to perform search";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
