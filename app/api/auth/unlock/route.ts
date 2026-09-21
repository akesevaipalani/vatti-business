import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const { pin } = await req.json();

    if (!pin) {
      return NextResponse.json({ error: "PIN is required" }, { status: 400 });
    }

    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
    });

    if (!admin) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }

    // Only allow unlock with configured PIN or configured password
    const isPinMatch = Boolean(admin.pinCode && admin.pinCode === pin);
    const isPassMatch = await comparePassword(pin, admin.passwordHash);

    if (isPinMatch || isPassMatch) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Incorrect PIN or Password" }, { status: 401 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to unlock";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
