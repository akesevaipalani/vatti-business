import { NextResponse } from "next/server";
import { seedDemoData } from "@/lib/seed";

export async function POST(req: Request) {
  try {
    const { action } = await req.json();

    if (action === "RESET_DEMO") {
      // Re-run seed demo data
      await seedDemoData();
      return NextResponse.json({ success: true, message: "Demo data re-seeded successfully!" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reset demo data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
