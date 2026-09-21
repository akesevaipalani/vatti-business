import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true, user: session });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to get session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
