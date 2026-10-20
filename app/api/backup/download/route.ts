import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getCurrentUser } from "@/lib/auth/session";
import { getSanitizedBackupPath } from "@/lib/backup/backup-service";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access: Please log in." }, { status: 401 });
    }
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required to download backups." }, { status: 403 });
    }

    const fileName = request.nextUrl.searchParams.get("fileName");
    if (!fileName) {
      return NextResponse.json({ error: "File name query parameter is required." }, { status: 400 });
    }

    const filePath = getSanitizedBackupPath(fileName);
    const stats = fs.statSync(filePath);
    const fileBuffer = fs.readFileSync(filePath);

    const isJson = fileName.endsWith(".json");
    const contentType = isJson ? "application/json" : "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": stats.size.toString(),
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to download backup file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
