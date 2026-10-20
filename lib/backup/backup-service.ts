import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const DEFAULT_BACKUP_DIR = path.resolve(process.cwd(), "backups");

export const ALL_PRISMA_MODELS = [
  "user",
  "businessProfile",
  "partner",
  "partnerInvestment",
  "partnerWithdrawal",
  "partnerProfitAllocation",
  "partnerSettlement",
  "customer",
  "guarantor",
  "collateral",
  "loan",
  "loanPayment",
  "loanInstallment",
  "interestTransaction",
  "borrowedLoan",
  "expense",
  "income",
  "cashAccount",
  "bankAccount",
  "bankTransaction",
  "supplier",
  "category",
  "product",
  "stockMovement",
  "sale",
  "saleItem",
  "purchase",
  "purchaseItem",
  "asset",
  "liability",
  "ledgerAccount",
  "ledgerTransaction",
  "ledgerEntry",
  "dailyClosing",
  "monthlyClosing",
  "reminder",
  "auditLog",
  "backupRecord",
] as const;

export function isPostgreSqlDatabase(): boolean {
  const url = process.env.DATABASE_URL || "";
  return url.startsWith("postgresql:") || url.startsWith("postgres:");
}

export function getDatabaseEngine(): "POSTGRESQL" | "SQLITE" {
  return isPostgreSqlDatabase() ? "POSTGRESQL" : "SQLITE";
}

export function getMaskedDatabaseInfo(): {
  engine: "POSTGRESQL" | "SQLITE";
  host: string;
  database: string;
  schema: string;
} {
  const url = process.env.DATABASE_URL || "";
  if (isPostgreSqlDatabase()) {
    try {
      const match = url.match(/@([^:\/?#]+)(?::(\d+))?\/([^?#]+)/);
      if (match) {
        const host = match[1];
        const port = match[2] || "5432";
        const database = match[3];
        return {
          engine: "POSTGRESQL",
          host: `${host}:${port}`,
          database,
          schema: "public",
        };
      }
    } catch {
      // Fallback
    }
    return {
      engine: "POSTGRESQL",
      host: "supabase-cloud-host",
      database: "postgres",
      schema: "public",
    };
  }

  return {
    engine: "SQLITE",
    host: "localhost",
    database: "vatti.db",
    schema: "main",
  };
}

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

export function getSanitizedBackupPath(fileName: string): string {
  const sanitized = path.basename(fileName);
  if (sanitized !== fileName || !/^[A-Za-z0-9_.-]+$/.test(fileName)) {
    throw new Error("Invalid backup file name: Path traversal detected.");
  }
  const dir = getBackupDirectory();
  const filePath = path.join(dir, sanitized);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file '${fileName}' not found in backup storage.`);
  }
  return filePath;
}

function calculateSha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export interface BackupResult {
  fileName: string;
  filePath: string;
  fileSize: number;
  databaseType: "POSTGRESQL" | "SQLITE";
  totalRecords?: number;
  tableCount?: number;
  checksum?: string;
}

/**
 * Creates a verified database backup snapshot.
 * For PostgreSQL: Exports all 38 tables via Prisma, calculates SHA-256, verifies the file on disk.
 * For SQLite: Copies the SQLite database file and verifies file existence and size.
 */
export async function createDatabaseBackup(customFolder?: string): Promise<BackupResult> {
  const destDir = customFolder && fs.existsSync(customFolder) ? customFolder : getBackupDirectory();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  if (isPostgreSqlDatabase()) {
    // -------------------------------------------------------------
    // POSTGRESQL SNAPSHOT EXPORT WORKFLOW
    // -------------------------------------------------------------
    const fileName = `VattiBusiness_PostgreSQL_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.json`;
    const destPath = path.join(destDir, fileName);

    const exportData: Record<string, unknown[]> = {};
    const tableRecordCounts: Record<string, number> = {};
    let totalRecords = 0;

    // Export all 38 tables
    for (const model of ALL_PRISMA_MODELS) {
      const delegate = (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[model];
      if (delegate && typeof delegate.findMany === "function") {
        const rows = await delegate.findMany();
        exportData[model] = rows;
        tableRecordCounts[model] = rows.length;
        totalRecords += rows.length;
      }
    }

    const serializedData = JSON.stringify(exportData);
    const checksum = calculateSha256(serializedData);

    const snapshot = {
      metadata: {
        version: "1.4.0",
        createdAt: now.toISOString(),
        databaseType: "POSTGRESQL",
        tableCount: ALL_PRISMA_MODELS.length,
        totalRecords,
        tableRecordCounts,
        checksum,
      },
      data: exportData,
    };

    // Write formatted JSON snapshot to disk
    fs.writeFileSync(destPath, JSON.stringify(snapshot, null, 2), "utf8");

    // Strict Verification: File must exist, size > 0, valid JSON, matching checksum
    if (!fs.existsSync(destPath)) {
      throw new Error(`Failed to write backup snapshot to ${destPath}`);
    }

    const stats = fs.statSync(destPath);
    if (stats.size === 0) {
      throw new Error("Created backup file has 0 bytes. Aborting.");
    }

    const verificationContent = fs.readFileSync(destPath, "utf8");
    const parsed = JSON.parse(verificationContent);

    if (!parsed.metadata || parsed.metadata.databaseType !== "POSTGRESQL") {
      throw new Error("Verification failed: Corrupt snapshot metadata.");
    }

    const recomputedChecksum = calculateSha256(JSON.stringify(parsed.data));
    if (recomputedChecksum !== parsed.metadata.checksum) {
      throw new Error("Verification failed: SHA-256 checksum mismatch.");
    }

    // Record in BackupRecord table
    await prisma.backupRecord.create({
      data: {
        fileName,
        filePath: destPath,
        fileSize: stats.size,
        status: "SUCCESS",
      },
    });

    // Record in AuditLog
    await prisma.auditLog.create({
      data: {
        action: "BACKUP",
        entity: "SYSTEM",
        performedBy: "Admin",
        details: `PostgreSQL database snapshot verified and saved: ${fileName} (${stats.size} bytes, ${totalRecords} records across 38 tables).`,
      },
    });

    return {
      fileName,
      filePath: destPath,
      fileSize: stats.size,
      databaseType: "POSTGRESQL",
      totalRecords,
      tableCount: ALL_PRISMA_MODELS.length,
      checksum,
    };
  } else {
    // -------------------------------------------------------------
    // SQLITE BACKUP WORKFLOW (LOCAL / DEV ONLY)
    // -------------------------------------------------------------
    const fileName = `VattiBusiness_SQLite_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.db`;
    const destPath = path.join(destDir, fileName);

    const dbFilePath = getDatabaseFilePath();
    if (!fs.existsSync(dbFilePath)) {
      throw new Error(`Active SQLite database file not found at ${dbFilePath}`);
    }

    fs.copyFileSync(dbFilePath, destPath);
    const stats = fs.statSync(destPath);
    if (stats.size === 0) {
      throw new Error("Created SQLite backup file has 0 bytes. Aborting.");
    }

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
      databaseType: "SQLITE",
    };
  }
}

export interface BackupItemView {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  status: string;
  createdAt: string;
  databaseType: "POSTGRESQL_SNAPSHOT" | "LEGACY_SQLITE";
  canRestore: boolean;
  restoreDisabledReason?: string;
}

export async function listBackups() {
  const dir = getBackupDirectory();
  const currentEngine = getDatabaseEngine();
  const maskedInfo = getMaskedDatabaseInfo();

  const dbRecords = await prisma.backupRecord.findMany({
    orderBy: { createdAt: "desc" },
  });

  // Verify files on disk in backup directory
  const diskFiles = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".json") || f.endsWith(".db"))
    : [];

  const dbFileNames = new Set(dbRecords.map((r) => r.fileName));

  // Synthesize records combining DB audit records and discovered disk files
  const combinedItems: BackupItemView[] = [];

  for (const r of dbRecords) {
    const isJson = r.fileName.endsWith(".json");
    const isDb = r.fileName.endsWith(".db");
    const type: "POSTGRESQL_SNAPSHOT" | "LEGACY_SQLITE" = isJson ? "POSTGRESQL_SNAPSHOT" : "LEGACY_SQLITE";

    let canRestore = false;
    let restoreDisabledReason = "";

    if (currentEngine === "POSTGRESQL") {
      if (isDb) {
        canRestore = false;
        restoreDisabledReason = "Incompatible with PostgreSQL. Legacy SQLite backups cannot be restored to PostgreSQL.";
      } else {
        canRestore = false;
        restoreDisabledReason = "Live cloud production restore is restricted. Use Supabase Point-in-Time Recovery (PITR) for disaster recovery.";
      }
    } else {
      canRestore = isDb;
      if (!isDb) {
        restoreDisabledReason = "Incompatible with SQLite. PostgreSQL snapshots cannot be restored to SQLite.";
      }
    }

    combinedItems.push({
      id: r.id,
      fileName: r.fileName,
      filePath: r.filePath,
      fileSize: r.fileSize,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      databaseType: type,
      canRestore,
      restoreDisabledReason,
    });
  }

  // Include any disk files that may not be in DB records yet (e.g. legacy files)
  for (const f of diskFiles) {
    if (!dbFileNames.has(f)) {
      const fullPath = path.join(dir, f);
      let size = 0;
      let createdAt = new Date().toISOString();
      try {
        const stats = fs.statSync(fullPath);
        size = stats.size;
        createdAt = stats.birthtime.toISOString();
      } catch {
        // Fallback
      }

      const isJson = f.endsWith(".json");
      const isDb = f.endsWith(".db");
      const type: "POSTGRESQL_SNAPSHOT" | "LEGACY_SQLITE" = isJson ? "POSTGRESQL_SNAPSHOT" : "LEGACY_SQLITE";

      let canRestore = false;
      let restoreDisabledReason = "";

      if (currentEngine === "POSTGRESQL") {
        if (isDb) {
          canRestore = false;
          restoreDisabledReason = "Incompatible with PostgreSQL. Legacy SQLite backups cannot be restored to PostgreSQL.";
        } else {
          canRestore = false;
          restoreDisabledReason = "Live cloud production restore is restricted. Use Supabase Point-in-Time Recovery (PITR) for disaster recovery.";
        }
      } else {
        canRestore = isDb;
        if (!isDb) {
          restoreDisabledReason = "Incompatible with SQLite.";
        }
      }

      combinedItems.push({
        id: `disk-${f}`,
        fileName: f,
        filePath: fullPath,
        fileSize: size,
        status: "ON_DISK",
        createdAt,
        databaseType: type,
        canRestore,
        restoreDisabledReason,
      });
    }
  }

  // Sort newest first
  combinedItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    records: combinedItems,
    directory: dir,
    databaseEngine: currentEngine,
    databaseInfo: maskedInfo,
    filesCount: diskFiles.length,
  };
}

/**
 * Handles database restoration requests.
 * Cross-engine restore (SQLite -> PostgreSQL) is permanently BLOCKED.
 * In-app PostgreSQL production overwrite is restricted with guidance on Supabase PITR.
 */
export async function restoreDatabaseBackup(backupFileName: string): Promise<{ success: boolean; preBackupFile?: string }> {
  const currentEngine = getDatabaseEngine();

  if (currentEngine === "POSTGRESQL") {
    if (backupFileName.endsWith(".db")) {
      throw new Error(
        "Cross-engine restore blocked: Cannot restore a legacy SQLite .db file into PostgreSQL production. " +
          "Restoring SQLite files into PostgreSQL is prohibited to prevent catastrophic data corruption."
      );
    }

    if (backupFileName.endsWith(".json")) {
      throw new Error(
        "Live cloud database restoration is restricted for production safety. " +
          "In a live multi-user PostgreSQL environment, in-app destructive table overwriting across 38 relational tables " +
          "risks foreign key disruption, sequence locks, and partial state. " +
          "Please use the Supabase Cloud Console Point-in-Time Recovery (PITR) or native Supabase backups for authoritative database disaster recovery."
      );
    }

    throw new Error(`Unsupported backup file format for '${backupFileName}'.`);
  }

  const filePath = getSanitizedBackupPath(backupFileName);

  // -------------------------------------------------------------
  // SQLITE RESTORE WORKFLOW (LOCAL / DEV ONLY)
  // -------------------------------------------------------------
  if (!backupFileName.endsWith(".db")) {
    throw new Error("Cannot restore non-SQLite backup file in SQLite mode.");
  }

  // 1. Mandatory safety pre-restore backup of current state
  const preRestore = await createDatabaseBackup();

  // 2. Disconnect prisma client temporarily
  await prisma.$disconnect();

  // 3. Overwrite current DB with selected backup
  const dbFilePath = getDatabaseFilePath();
  fs.copyFileSync(filePath, dbFilePath);

  // 4. Log in AuditLog
  await prisma.auditLog.create({
    data: {
      action: "RESTORE",
      entity: "DATABASE",
      performedBy: "Admin",
      details: `Restored SQLite database from ${backupFileName}. Pre-restore backup created: ${preRestore.fileName}`,
    },
  });

  return {
    success: true,
    preBackupFile: preRestore.fileName,
  };
}
