"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  Printer,
  CheckCircle2,
  Lock,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface DayClosingRecord {
  id: string;
  date: string;
  openingCash: number;
  totalCashCollected: number;
  totalCashDisbursed: number;
  totalExpenses: number;
  systemExpectedCash: number;
  actualCashCounted: number;
  differenceAmount: number;
  closedBy: string;
  closedAt: string;
  isAudited: boolean;
  notes: string | null;
}

interface DayClosingInfo {
  date: string;
  isClosed: boolean;
  existingRecord?: DayClosingRecord | null;
  openingCash: number;
  totalCollections: number;
  totalIncome: number;
  totalInvestments: number;
  totalExpenses: number;
  totalWithdrawals: number;
  expectedClosingCash: number;
  currentCashInHand: number;
}

export default function DayClosingPage() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [data, setData] = useState<DayClosingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchDayInfo();
  }, []);

  const fetchDayInfo = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/day-closing/status");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setActualCash(String(json.expectedClosingCash || ""));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirm("Are you sure you want to CLOSE and LOCK today's business books?")) return;

    setClosingLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/day-closing/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: data?.date,
          actualCashCount: Number(actualCash),
          notes,
        }),
      });

      if (res.ok) {
        setSuccessMsg(t.dayClosedSuccess);
        fetchDayInfo();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to close day");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setClosingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const expected = data?.expectedClosingCash || 0;
  const actual = Number(actualCash) || 0;
  const variance = actual - expected;
  const isClosed = data?.isClosed;

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              <span>{t.dayClosing}</span>
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isClosed
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 animate-pulse"
              }`}
            >
              {isClosed ? t.dayClosed : t.dayOpen}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            End-of-day physical cash counter tally, variance check, and audit lock
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Printer className="w-4 h-4" />
          <span>{t.print}</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 text-rose-600 text-xs font-bold">
          {errorMsg}
        </div>
      )}

      {/* Main Cash Reconciliation Sheet */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span>Date: {formatDate(data?.date)}</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Status: {isClosed ? "LOCKED" : "ACTIVE SESSION"}
          </span>
        </div>

        {/* Breakdown Flow */}
        <div className="space-y-3 font-mono text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40">
            <span className="font-sans font-semibold text-slate-700 dark:text-slate-300">
              1. Opening Cash-in-Hand
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {formatCurrency(data?.openingCash)}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
            <span className="font-sans font-semibold">
              2. Total Cash Collections (+)
            </span>
            <span className="font-bold">{formatCurrency(data?.totalCollections)}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 text-cyan-800 dark:text-cyan-300">
            <span className="font-sans font-semibold">
              3. Total Other Cash Incomes (+)
            </span>
            <span className="font-bold">{formatCurrency(data?.totalIncome)}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-teal-50/50 dark:bg-teal-950/20 text-teal-800 dark:text-teal-300">
            <span className="font-sans font-semibold">
              4. Partner Cash Capital Injected (+)
            </span>
            <span className="font-bold">{formatCurrency(data?.totalInvestments)}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300">
            <span className="font-sans font-semibold">
              5. Total Cash Expenses (-)
            </span>
            <span className="font-bold">-{formatCurrency(data?.totalExpenses)}</span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300">
            <span className="font-sans font-semibold">
              6. Partner Cash Withdrawals (-)
            </span>
            <span className="font-bold">-{formatCurrency(data?.totalWithdrawals)}</span>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-black border border-slate-200 dark:border-slate-700">
            <span className="font-sans text-slate-900 dark:text-slate-100">
              Expected Physical Cash Count
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 text-base">
              {formatCurrency(expected)}
            </span>
          </div>
        </div>

        {/* Physical Cash Verification Input */}
        <form onSubmit={handleCloseDay} className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Actual Physical Cash Counted in Safe / Counter (₹) *
              </label>
              <input
                type="number"
                required
                disabled={isClosed}
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-mono font-black text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cash Variance / Difference
              </label>
              <div
                className={`px-3 py-2.5 rounded-lg font-mono font-bold text-base border flex items-center justify-between ${
                  variance === 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40"
                    : variance > 0
                    ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40"
                    : "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40"
                }`}
              >
                <span>{formatCurrency(variance)}</span>
                <span className="text-xs font-sans font-medium">
                  {variance === 0 ? "Exact Match" : variance > 0 ? "Cash Excess" : "Cash Shortage"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Closing Notes
            </label>
            <input
              type="text"
              disabled={isClosed}
              placeholder="e.g. All borrower payments collected, counter verified"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
          </div>

          {!isClosed ? (
            <button
              type="submit"
              disabled={closingLoading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{closingLoading ? "Closing & Locking Day..." : "CONFIRM & CLOSE DAY"}</span>
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Day has been locked by Administrator. Records are secured.</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
