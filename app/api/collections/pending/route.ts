import { NextResponse } from "next/server";
import { getPendingCollectionList } from "@/lib/loans/installments";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const result = await getPendingCollectionList(date);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch pending collections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
