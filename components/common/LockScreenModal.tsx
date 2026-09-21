"use client";

import React, { useState } from "react";
import { Lock, KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function LockScreenModal({
  isLocked,
  onUnlock,
}: {
  isLocked: boolean;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  if (!isLocked) return null;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        setPin("");
        onUnlock();
      } else {
        const data = await res.json();
        setError(data.error || t.wrongPin);
      }
    } catch {
      setError(t.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-sm p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {t.appName}
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          {t.locked} • {t.enterPin}
        </p>

        <form onSubmit={handleUnlock} className="space-y-4">
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="password"
              autoFocus
              placeholder="PIN or Password (Default: 1234)"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center tracking-widest text-lg font-mono"
            />
          </div>

          {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading || !pin}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {loading ? "Verifying..." : t.unlock}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Private Local Encryption Guard</span>
        </div>
      </div>
    </div>
  );
}
