import { NextResponse } from "next/server";
import { restoreDatabaseBackup } from "@/lib/backup/backup-service";
import { getCurrentUser } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access: Please log in." }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required to restore backups." }, { status: 403 });
    }

    const { fileName } = await req.json().catch(() => ({}));

    if (!fileName) {
      return NextResponse.json({ error: "Backup file name is required." }, { status: 400 });
    }

    const result = await restoreDatabaseBackup(fileName);
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to restore backup.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
