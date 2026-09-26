import { NextResponse } from "next/server";
import { getCollectionSchedule } from "@/lib/loans/installments";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const q = searchParams.get("q") || undefined;
    const tab = searchParams.get("tab") || undefined;

    const schedule = await getCollectionSchedule(date, { q, tab });
    return NextResponse.json(schedule);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch collection schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
