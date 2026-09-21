import { NextResponse } from "next/server";
import { getDashboardFinancialStats } from "@/lib/financials/stats";

export async function GET() {
  try {
    const stats = await getDashboardFinancialStats();
    return NextResponse.json(stats);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard statistics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
