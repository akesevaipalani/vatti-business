import { NextResponse } from "next/server";
import { getTodayCollectionList, recordCollectionForInstallment } from "@/lib/loans/installments";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || undefined;
    const result = await getTodayCollectionList(date);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch collection schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { installmentId, amount, principalPortion, interestPortion, collectionDate, paymentMethod, notes } = body;

    if (!installmentId) {
      return NextResponse.json({ error: "Installment ID is required" }, { status: 400 });
    }

    const result = await recordCollectionForInstallment({
      installmentId,
      amount: Number(amount),
      principalPortion: principalPortion !== undefined ? Number(principalPortion) : undefined,
      interestPortion: interestPortion !== undefined ? Number(interestPortion) : undefined,
      collectionDate,
      paymentMethod,
      notes,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record collection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
