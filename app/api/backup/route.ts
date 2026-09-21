import { NextResponse } from "next/server";
import { createDatabaseBackup, listBackups } from "@/lib/backup/backup-service";

export async function GET() {
  try {
    const data = await listBackups();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to list backups";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const backup = await createDatabaseBackup(body.customFolder);
    return NextResponse.json({ success: true, backup });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create backup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
