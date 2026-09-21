import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, setSessionCookie } from "@/lib/auth/session";
import { parsePermissions } from "@/lib/auth/permissions";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const permissions = parsePermissions(user.permissions, user.role);

    await setSessionCookie({
      userId: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      partnerId: user.partnerId,
      permissions,
    });

    await prisma.auditLog.create({
      data: {
        action: "LOGIN",
        entity: "USER",
        entityId: user.id,
        performedBy: user.username,
        details: `User ${user.username} (${user.role}) successfully logged in`,
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        name: user.name,
        role: user.role,
        partnerId: user.partnerId,
        permissions,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to login";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
