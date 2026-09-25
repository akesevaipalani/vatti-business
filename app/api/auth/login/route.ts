import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, setSessionCookie, signToken } from "@/lib/auth/session";
import { parsePermissions } from "@/lib/auth/permissions";

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
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    const permissions = parsePermissions(user.permissions, user.role);

    const sessionPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      partnerId: user.partnerId,
      permissions,
    };

    const token = signToken(sessionPayload);
    await setSessionCookie(sessionPayload);

    await prisma.auditLog.create({
      data: {
        action: "LOGIN",
        entity: "USER",
        entityId: user.id,
        performedBy: user.username,
        details: `User ${user.username} (${user.role}) successfully logged in`,
      },
    });

    return NextResponse.json(
      {
        success: true,
        token,
        user: {
          username: user.username,
          name: user.name,
          role: user.role,
          partnerId: user.partnerId,
          permissions,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to login";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
