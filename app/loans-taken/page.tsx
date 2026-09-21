"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Landmark,
  Plus,
  Search,
  Printer,
  X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface BorrowedLoanItem {
  id: string;
  loanCode: string;
  lenderName: string;
  contact: string | null;
  amount: number;
  paidAmount: number;
  balanceAmount: number;
  interestRate: number;
  installmentAmount: number;
  status: string;
}

export default function LoansTakenPage() {
  const { t, formatCurrency } = useLanguage();
  const [loans, setLoans] = useState<BorrowedLoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    lenderName: "",
    contact: "",
    amount: "",
    interestRate: "12",
    installmentAmount: "10000",
    dueDate: "",
    paymentMethod: "BANK",
    notes: "",
  });
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchLoansTaken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/loans-taken");
      if (res.ok) {
        const json = await res.json();
        setLoans(json.loans || []);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoansTaken();
  }, [fetchLoansTaken]);

  const handleCreateLoanTaken = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/loans-taken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setModalOpen(false);
        setFormData({
          lenderName: "",
          contact: "",
          amount: "",
          interestRate: "12",
          installmentAmount: "10000",
          dueDate: "",
          paymentMethod: "BANK",
          notes: "",
        });
        fetchLoansTaken();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to record loan");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = loans.filter(
    (l) =>
      l.lenderName.toLowerCase().includes(search.toLowerCase()) ||
      l.loanCode.toLowerCase().includes(search.toLowerCase())
  );

  const totalBorrowed = filtered.reduce((s, l) => s + l.amount, 0);
  const totalBalance = filtered.reduce((s, l) => s + l.balanceAmount, 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-orange-600" />
            <span>{t.loansTaken}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track business debts, bank loans, external financier credit lines, and liabilities
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{t.print}</span>
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md shadow-orange-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Borrowed Loan</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Borrowed Amount</div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(totalBorrowed)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{loans.length} lenders / credit facilities</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Repaid to Date</div>
          <div className="text-xl font-black text-emerald-600 mt-1 font-mono">
            {formatCurrency(totalBorrowed - totalBalance)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Principal returned to lenders</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-orange-50 dark:bg-orange-950/30 border-orange-500/30 shadow-sm">
          <div className="text-xs font-semibold text-orange-800 dark:text-orange-300">
            Total Remaining Liability
          </div>
          <div className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1 font-mono">
            {formatCurrency(totalBalance)}
          </div>
          <div className="text-xs text-orange-700 dark:text-orange-400 mt-1 font-medium">
            Active borrowed debt to settle
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-2">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by lender name or loan code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-xs bg-transparent border-none outline-none focus:ring-0 text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading borrowed loans...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No borrowed loans found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Lender / Financier</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Interest Rate</th>
                  <th className="py-3 px-4 text-right">Borrowed Amount</th>
                  <th className="py-3 px-4 text-right">Repaid</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filtered.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-orange-600">{l.loanCode}</td>
                    <td className="py-3.5 px-4 font-sans font-bold text-slate-900 dark:text-slate-100">
                      {l.lenderName}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-slate-400">
                      {l.contact || "-"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-sans text-slate-700 dark:text-slate-300">
                      {l.interestRate}% p.a.
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(l.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-600">
                      {formatCurrency(l.paidAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-orange-600 text-sm">
                      {formatCurrency(l.balanceAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD BORROWED LOAN MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Record Borrowed Loan
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLoanTaken} className="p-6 space-y-3.5">
              {errorMsg && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-600 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lender / Financier / Bank Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sundaram Finance Ltd"
                  value={formData.lenderName}
                  onChange={(e) => setFormData({ ...formData, lenderName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Borrowed Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="200000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-orange-600 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.interestRate}
                    onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly EMI (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.installmentAmount}
                    onChange={(e) => setFormData({ ...formData, installmentAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Received Via
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  >
                    <option value="BANK">Bank Account</option>
                    <option value="CASH">Cash-in-Hand</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lender Contact
                  </label>
                  <input
                    type="text"
                    placeholder="Phone / Manager"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "Recording..." : "Save Borrowed Loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
