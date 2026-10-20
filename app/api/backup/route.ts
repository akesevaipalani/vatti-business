import { NextResponse } from "next/server";
import { createDatabaseBackup, listBackups } from "@/lib/backup/backup-service";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access: Please log in." }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required to access backups." }, { status: 403 });
    }

    const data = await listBackups();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list backups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access: Please log in." }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required to create backups." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const backup = await createDatabaseBackup(body.customFolder);
    return NextResponse.json({ success: true, backup });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create backup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
