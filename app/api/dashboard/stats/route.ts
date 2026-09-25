import { NextResponse } from "next/server";
import { getDashboardFinancialStats } from "@/lib/financials/stats";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (user && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required for complete financial statements" },
        { status: 403 }
      );
    }

    const stats = await getDashboardFinancialStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard statistics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
