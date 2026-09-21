import { NextResponse } from "next/server";
import { getDayClosingInfo } from "@/lib/financials/closings";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const info = await getDayClosingInfo(date);
    return NextResponse.json(info);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch day closing status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
