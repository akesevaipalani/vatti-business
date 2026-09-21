import { NextResponse } from "next/server";
import { executeCloseDay } from "@/lib/financials/closings";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { date, actualCashCount, notes } = body;

    const record = await executeCloseDay({
      date: date || new Date().toISOString().split("T")[0],
      actualCashCount: Number(actualCashCount) || 0,
      notes,
    });

    return NextResponse.json({ success: true, record });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to close day";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
