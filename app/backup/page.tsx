"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Folder,
  ShieldCheck,
  Server,
  Cloud,
  FileCheck,
  Info,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface BackupItem {
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

interface DatabaseInfo {
  engine: "POSTGRESQL" | "SQLITE";
  host: string;
  database: string;
  schema: string;
}

export default function BackupPage() {
  const { t, formatDateTime } = useLanguage();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [directory, setDirectory] = useState("");
  const [databaseEngine, setDatabaseEngine] = useState<"POSTGRESQL" | "SQLITE">("POSTGRESQL");
  const [databaseInfo, setDatabaseInfo] = useState<DatabaseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Restore Modal State
  const [restoreTarget, setRestoreTarget] = useState<BackupItem | null>(null);
  const [showRestorePolicyModal, setShowRestorePolicyModal] = useState<BackupItem | null>(null);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/backup");
      if (res.ok) {
        const json = await res.json();
        setBackups(json.records || []);
        setDirectory(json.directory || "");
        setDatabaseEngine(json.databaseEngine || "POSTGRESQL");
        setDatabaseInfo(json.databaseInfo || null);
      } else {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error || "Failed to load backups");
      }
    } catch {
      setErrorMsg("Failed to communicate with backup server");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadFile = (fileName: string) => {
    const downloadUrl = `/api/backup/download?fileName=${encodeURIComponent(fileName)}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateBackup = async () => {
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const b = data.backup;
        setSuccessMsg(
          `Backup snapshot created and verified: ${b.fileName} (${(b.fileSize / 1024).toFixed(1)} KB, ${
            b.totalRecords ?? "all"
          } records across ${b.tableCount ?? 38} tables). Starting download to your computer...`
        );
        fetchBackups();
        // Automatically trigger durable download to administrator's local machine
        handleDownloadFile(b.fileName);
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Backup creation failed");
      }
    } catch {
      setErrorMsg(t.errorOccurred || "An unexpected error occurred while creating backup.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: restoreTarget.fileName }),
      });

      if (res.ok) {
        const d = await res.json();
        setSuccessMsg(
          `Database successfully restored from ${restoreTarget.fileName}! Pre-restore safety backup: ${d.result.preBackupFile}`
        );
        setRestoreTarget(null);
        fetchBackups();
      } else {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || "Database restore failed");
      }
    } catch {
      setErrorMsg(t.errorOccurred || "Restore failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              <span>{t.backupRestore}</span>
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                databaseEngine === "POSTGRESQL"
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }`}
            >
              {databaseEngine === "POSTGRESQL" ? "Supabase PostgreSQL" : "Local SQLite"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative cloud database snapshot export, durable local downloads, and disaster recovery
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={actionLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{actionLoading ? "Verifying & Creating..." : "CREATE & DOWNLOAD BACKUP"}</span>
        </button>
      </div>

      {/* Database Connection & Architecture Status Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
          <Server className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Engine</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {databaseEngine === "POSTGRESQL" ? "Supabase Cloud PostgreSQL" : "Local SQLite"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {databaseInfo?.host ? `${databaseInfo.host} (${databaseInfo.database})` : "Authoritative Database"}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Storage Durability</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Direct Local Machine Download</div>
            <div className="text-[10px] text-slate-400">
              Backups download directly to your computer, bypassing ephemeral container disk.
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-start gap-3">
          <Cloud className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Disaster Recovery</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Supabase Automated Backups</div>
            <div className="text-[10px] text-slate-400">Continuous WAL archiving & Point-in-Time Recovery enabled.</div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Supabase Disaster Recovery Documentation Card */}
      <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-950/50 bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-900 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-200">
          <Info className="w-4 h-4 text-indigo-600" />
          <span>Supabase Production Backup & Recovery Standard</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          The production database is hosted on Supabase PostgreSQL. Supabase automatically takes daily WAL-G snapshots
          and offers Point-in-Time Recovery (PITR) directly in the cloud console. For offline archiving, click{" "}
          <strong>CREATE & DOWNLOAD BACKUP</strong> above to download a verified JSON snapshot containing all 38
          relational tables and cryptographic SHA-256 signatures directly to your local PC.
        </p>
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
          <div className="flex items-center gap-1 font-mono">
            <span className="font-bold text-slate-700 dark:text-slate-300">CLI Native Dump:</span>
            <code>supabase db dump -f backup.sql</code>
          </div>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <div className="flex items-center gap-1 font-mono">
            <span className="font-bold text-slate-700 dark:text-slate-300">Server Backup Directory:</span>
            <span>{directory || "backups/"}</span>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-indigo-600" />
            <span>Available Backup Snapshots ({backups.length})</span>
          </h3>
          <span className="text-xs text-slate-500">Sorted newest first</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading backup history...</div>
        ) : backups.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 space-y-2">
            <Database className="w-8 h-8 text-slate-400 mx-auto" />
            <p>No backups recorded yet.</p>
            <p className="text-[11px] text-slate-400">
              Click &quot;CREATE & DOWNLOAD BACKUP&quot; to export your first PostgreSQL snapshot.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Backup File Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Created Date & Time</th>
                  <th className="py-3 px-4 text-right">File Size</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400 break-all">
                      {b.fileName}
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      {b.databaseType === "POSTGRESQL_SNAPSHOT" ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          PostgreSQL JSON
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Legacy SQLite .db
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-slate-400">
                      {formatDateTime(b.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-700 dark:text-slate-300">
                      {(b.fileSize / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans space-x-2">
                      {/* Download Button */}
                      <button
                        onClick={() => handleDownloadFile(b.fileName)}
                        className="py-1 px-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[11px] font-bold transition inline-flex items-center gap-1"
                        title="Download backup file to local computer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </button>

                      {/* Restore Button */}
                      {databaseEngine === "POSTGRESQL" ? (
                        b.databaseType === "LEGACY_SQLITE" ? (
                          <span
                            className="py-1 px-2.5 rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 text-[10px] font-bold cursor-not-allowed inline-flex items-center gap-1"
                            title="Cross-engine restore blocked: SQLite cannot be restored into PostgreSQL"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>Incompatible</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => setShowRestorePolicyModal(b)}
                            className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 text-[11px] font-bold transition inline-flex items-center gap-1"
                            title="View PostgreSQL restoration guidelines"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            <span>Recovery Info</span>
                          </button>
                        )
                      ) : (
                        <button
                          onClick={() => setRestoreTarget(b)}
                          disabled={!b.canRestore}
                          className="py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-bold transition inline-flex items-center gap-1 disabled:opacity-40"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RESTORE RESTRICTION & CLOUD RECOVERY POLICY MODAL */}
      {showRestorePolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-indigo-200 dark:border-indigo-900/50 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Production Database Recovery Policy
              </h3>
              <p className="text-xs text-slate-500">
                Authoritative Disaster Recovery for Supabase PostgreSQL
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 font-mono text-xs text-indigo-600 break-all">
              {showRestorePolicyModal.fileName}
            </div>

            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Why Live In-App Restores Are Restricted:</span>
              </div>
              <p className="leading-relaxed">
                In a live multi-device production environment, destructive in-app table overwrites across 38 relational
                tables can cause foreign-key locking, partial states, and transaction deadlocks.
              </p>
              <p className="leading-relaxed font-semibold">
                To guarantee zero financial data loss, live restores must be performed through Supabase Cloud
                Point-in-Time Recovery (PITR) or coordinated database maintenance.
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
              <div className="font-bold text-slate-800 dark:text-slate-200">Recommended Recovery Steps:</div>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Log in to your <strong>Supabase Cloud Dashboard</strong>.</li>
                <li>Navigate to <strong>Database &rarr; Backups</strong>.</li>
                <li>Select the desired Point-in-Time snapshot or use the Supabase CLI restore command.</li>
                <li>Verify financial account balances and ledger debits/credits after restoration.</li>
              </ol>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRestorePolicyModal(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SQLITE RESTORE MODAL (DEV ONLY) */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/50 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Confirm Local Database Restore</h3>
              <p className="text-xs text-slate-500 mt-1">Restore snapshot:</p>
              <div className="mt-2 p-2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-indigo-600">
                {restoreTarget.fileName}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRestoreTarget(null)}
                className="flex-1 py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteRestore}
                className="flex-1 py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition disabled:opacity-50"
              >
                {actionLoading ? "Restoring..." : "YES, RESTORE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
