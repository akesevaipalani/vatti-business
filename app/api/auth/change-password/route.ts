import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, comparePassword, hashPassword, setSessionCookie } from "@/lib/auth/session";

const ALLOWED_ORIGINS = new Set([
  "https://localhost",
  "http://localhost",
  "capacitor://localhost",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
]);

function getCorsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin && (ALLOWED_ORIGINS.has(origin) || origin.endsWith(".up.railway.app"));
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin! : "https://localhost",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
    "Access-Control-Max-Age": "86400",
  };
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Current password, new password, and confirmation are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirm password do not match" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Derive target user exclusively from authenticated session ID
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404, headers: corsHeaders });
    }

    const isValidCurrent = await comparePassword(currentPassword, dbUser.passwordHash);
    if (!isValidCurrent) {
      return NextResponse.json(
        {
          error: "Current password is incorrect.",
          errorTa: "தற்போதைய கடவுச்சொல் தவறாக உள்ளது.",
          message: "Current password is incorrect. (தற்போதைய கடவுச்சொல் தவறாக உள்ளது.)",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Hash new password using bcrypt
    const newPasswordHash = await hashPassword(newPassword);

    // Update only the authenticated user's record
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { passwordHash: newPasswordHash },
    });

    // Record audit log without plaintext credentials
    await prisma.auditLog.create({
      data: {
        action: "CHANGE_PASSWORD",
        entity: "USER",
        entityId: dbUser.id,
        performedBy: dbUser.username,
        details: `User ${dbUser.username} (${dbUser.role}) successfully changed password`,
      },
    });

    // Re-issue updated session cookie
    await setSessionCookie({
      userId: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
      name: dbUser.name,
      partnerId: dbUser.partnerId,
      permissions: sessionUser.permissions,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Password changed successfully",
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to change password";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
