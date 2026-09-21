import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

const DEFAULT_BACKUP_DIR = path.resolve(process.cwd(), "backups");

export function getDatabaseFilePath(): string {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith("file:")) {
    const rawPath = url.replace("file:", "");
    return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), "prisma", rawPath);
  }
  return path.resolve(process.cwd(), "prisma", "vatti.db");
}

export function getBackupDirectory(): string {
  const dir = process.env.VATTI_BACKUP_DIR || DEFAULT_BACKUP_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function createDatabaseBackup(customFolder?: string): Promise<{
  fileName: string;
  filePath: string;
  fileSize: number;
}> {
  const destDir = customFolder && fs.existsSync(customFolder) ? customFolder : getBackupDirectory();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const fileName = `VattiBusiness_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.db`;
  const destPath = path.join(destDir, fileName);

  const dbFilePath = getDatabaseFilePath();
  if (!fs.existsSync(dbFilePath)) {
    throw new Error(`Active database file not found at ${dbFilePath}`);
  }

  // Copy active database file
  fs.copyFileSync(dbFilePath, destPath);
  const stats = fs.statSync(destPath);

  // Record in BackupRecord table
  await prisma.backupRecord.create({
    data: {
      fileName,
      filePath: destPath,
      fileSize: stats.size,
      status: "SUCCESS",
    },
  });

  return {
    fileName,
    filePath: destPath,
    fileSize: stats.size,
  };
}

export async function listBackups() {
  const dir = getBackupDirectory();
  const records = await prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Also verify files in the backup directory
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".db")) : [];

  return {
    records,
    directory: dir,
    filesCount: files.length,
  };
}

export async function restoreDatabaseBackup(backupFileName: string): Promise<{ success: boolean; preBackupFile: string }> {
  const dir = getBackupDirectory();
  const backupFilePath = path.join(dir, backupFileName);

  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file ${backupFileName} not found in ${dir}`);
  }

  // 1. Mandatory safety pre-restore backup of current state
  const preRestore = await createDatabaseBackup();

  // 2. Disconnect prisma client temporarily
  await prisma.$disconnect();

  // 3. Overwrite current DB with selected backup
  const dbFilePath = getDatabaseFilePath();
  fs.copyFileSync(backupFilePath, dbFilePath);

  // 4. Log in AuditLog
  await prisma.auditLog.create({
    data: {
      action: "RESTORE",
      entity: "DATABASE",
      performedBy: "Admin",
      details: `Restored database from ${backupFileName}. Pre-restore backup created: ${preRestore.fileName}`,
    },
  });

  return {
    success: true,
    preBackupFile: preRestore.fileName,
  };
}
