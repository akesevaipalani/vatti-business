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
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface BackupRecordItem {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  status: string;
  createdAt: string;
}

export default function BackupPage() {
  const { t, formatDateTime } = useLanguage();
  const [backups, setBackups] = useState<BackupRecordItem[]>([]);
  const [directory, setDirectory] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Restore Modal State
  const [restoreTarget, setRestoreTarget] = useState<BackupRecordItem | null>(null);

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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Backup created successfully: ${data.backup.fileName}`);
        fetchBackups();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Backup creation failed");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
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
          `Database successfully restored from ${restoreTarget.fileName}! Safety pre-restore backup saved as: ${d.result.preBackupFile}`
        );
        setRestoreTarget(null);
        fetchBackups();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Database restore failed");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <span>{t.backupRestore}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Single-file SQLite database backup snapshots, local storage, and safe disaster recovery
          </p>
        </div>

        <button
          onClick={handleCreateBackup}
          disabled={actionLoading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{actionLoading ? "Creating Snapshot..." : "CREATE BACKUP NOW"}</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Directory and Architecture Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Folder className="w-4 h-4 text-amber-500" />
            <span>Local Windows Backup Folder</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 font-mono text-xs text-slate-700 dark:text-slate-300 break-all select-all">
            {directory || "Loading path..."}
          </div>
          <p className="text-[11px] text-slate-400">
            You can copy any .db file from this folder to a USB drive or external hard disk for offline storage.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Automatic Safety Guarantee</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Whenever you restore an old backup, Vatti Business will <strong>automatically create an emergency backup of your active database first</strong>. You can never accidentally lose current data.
          </p>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Historical Backup Snapshots ({backups.length})
          </h3>
          <span className="text-xs text-slate-500">Sorted newest first</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading backup history...</div>
        ) : backups.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No backups taken yet. Click &quot;CREATE BACKUP NOW&quot; above to create your first snapshot.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Backup File Name</th>
                  <th className="py-3 px-4">Created Date & Time</th>
                  <th className="py-3 px-4 text-right">File Size</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold text-indigo-600">
                      {b.fileName}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-slate-400">
                      {formatDateTime(b.createdAt)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-700 dark:text-slate-300">
                      {(b.fileSize / 1024).toFixed(1)} KB
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans">
                      <button
                        onClick={() => setRestoreTarget(b)}
                        className="py-1 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-[11px] font-bold transition inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RESTORE CONFIRMATION WARNING MODAL */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/50 p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Confirm Database Restore
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                You are about to restore the database to the snapshot from:
              </p>
              <div className="mt-2 p-2 rounded bg-slate-100 dark:bg-slate-800 font-mono text-xs font-bold text-indigo-600">
                {restoreTarget.fileName}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Safety Pre-Restore Triggered</span>
              </div>
              <p>
                A backup of your current active database will be created automatically before this file is applied.
              </p>
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
                {actionLoading ? "Restoring..." : "YES, RESTORE DATABASE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
