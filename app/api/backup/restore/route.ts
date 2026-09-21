import { NextResponse } from "next/server";
import { restoreDatabaseBackup } from "@/lib/backup/backup-service";

export async function POST(req: Request) {
  try {
    const { fileName } = await req.json();

    if (!fileName) {
      return NextResponse.json({ error: "Backup file name is required" }, { status: 400 });
    }

    const result = await restoreDatabaseBackup(fileName);
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to restore backup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
