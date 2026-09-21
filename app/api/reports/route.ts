import { NextResponse } from "next/server";
import {
  generateProfitAndLossReport,
  generateBalanceSheetReport,
  generateCashFlowReport,
} from "@/lib/financials/reports";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "PL";
    const startDateStr = searchParams.get("startDate");
    const endDateStr = searchParams.get("endDate");

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    if (type === "BALANCE_SHEET") {
      const data = await generateBalanceSheetReport();
      return NextResponse.json({ report: data });
    } else if (type === "CASH_FLOW") {
      const data = await generateCashFlowReport(startDate, endDate);
      return NextResponse.json({ report: data });
    } else {
      const data = await generateProfitAndLossReport(startDate, endDate);
      return NextResponse.json({ report: data });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate report";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
