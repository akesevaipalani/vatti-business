"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  X,
  Landmark,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface BankAccountItem {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc: string | null;
  openingBalance: number;
  currentBalance: number;
  isPrimary: boolean;
}

export default function BankAccountsPage() {
  const { t, formatCurrency } = useLanguage();
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [newBankModal, setNewBankModal] = useState(false);
  const [txnModal, setTxnModal] = useState<BankAccountItem | null>(null);

  const [bankForm, setBankForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    ifsc: "",
    openingBalance: "0",
  });

  const [txnForm, setTxnForm] = useState({
    type: "DEPOSIT",
    amount: "",
    referenceNo: "",
    description: "",
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bank-accounts");
      if (res.ok) {
        const json = await res.json();
        setBankAccounts(json.bankAccounts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm),
      });
      if (res.ok) {
        setNewBankModal(false);
        setBankForm({ bankName: "", accountName: "", accountNumber: "", ifsc: "", openingBalance: "0" });
        fetchBanks();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to create bank account");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTxnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnModal) return;
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/bank-accounts/${txnModal.id}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txnForm),
      });
      if (res.ok) {
        setTxnModal(null);
        setTxnForm({ type: "DEPOSIT", amount: "", referenceNo: "", description: "" });
        fetchBanks();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Transaction failed");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setActionLoading(false);
    }
  };

  const totalBankBalance = bankAccounts.reduce((s, b) => s + b.currentBalance, 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span>{t.bankAccounts}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage multiple bank accounts, bank deposits, withdrawals, NEFT/UPI, and reconciliation
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
            onClick={() => setNewBankModal(true)}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Bank Account</span>
          </button>
        </div>
      </div>

      {/* Overall Total Balance Card */}
      <div className="p-5 rounded-2xl border border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/30 flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
            Total Combined Bank Balance
          </span>
          <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-0.5 font-mono">
            {formatCurrency(totalBankBalance)}
          </div>
        </div>
        <span className="text-xs text-slate-500">Across {bankAccounts.length} active bank accounts</span>
      </div>

      {/* Bank Account Cards */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 font-medium">Loading bank accounts...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {bankAccounts.map((bank) => (
          <div
            key={bank.id}
            className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
                    <Landmark className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {bank.bankName}
                    </h3>
                    <p className="text-xs text-slate-500">{bank.accountName}</p>
                  </div>
                </div>
                {bank.isPrimary && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    PRIMARY
                  </span>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Account Number</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {bank.accountNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">IFSC Code</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {bank.ifsc || "-"}
                  </span>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Available Balance</span>
                <span className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono">
                  {formatCurrency(bank.currentBalance)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                onClick={() => {
                  setTxnModal(bank);
                  setTxnForm({ ...txnForm, type: "DEPOSIT" });
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition flex items-center justify-center gap-1"
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Deposit / In</span>
              </button>
              <button
                onClick={() => {
                  setTxnModal(bank);
                  setTxnForm({ ...txnForm, type: "WITHDRAWAL" });
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition flex items-center justify-center gap-1"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Withdraw / Out</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {/* MODAL 1: ADD BANK ACCOUNT */}
      {newBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Add Bank Account
              </h3>
              <button onClick={() => setNewBankModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBank} className="p-6 space-y-3.5">
              {errorMsg && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-600 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. State Bank of India"
                  value={bankForm.bankName}
                  onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Account Name / Nickname
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vatti Business Current A/c"
                  value={bankForm.accountName}
                  onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="30894567890"
                    value={bankForm.accountNumber}
                    onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    placeholder="SBIN0001234"
                    value={bankForm.ifsc}
                    onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={bankForm.openingBalance}
                  onChange={(e) => setBankForm({ ...bankForm, openingBalance: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewBankModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "Saving..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BANK TRANSACTION */}
      {txnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Record Bank Transaction
                </h3>
                <p className="text-xs text-blue-600 font-semibold">{txnModal.bankName}</p>
              </div>
              <button onClick={() => setTxnModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTxnSubmit} className="p-6 space-y-3.5">
              {errorMsg && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-600 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Transaction Type
                </label>
                <select
                  value={txnForm.type}
                  onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold"
                >
                  <option value="DEPOSIT">Cash Deposit (+ In)</option>
                  <option value="WITHDRAWAL">Cash Withdrawal (- Out)</option>
                  <option value="TRANSFER_IN">Transfer In (+ In)</option>
                  <option value="TRANSFER_OUT">Transfer Out (- Out)</option>
                  <option value="CHARGES">Bank Charges (- Out)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  autoFocus
                  placeholder="10000"
                  value={txnForm.amount}
                  onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference / Cheque / UTR No
                </label>
                <input
                  type="text"
                  placeholder="UTR / Cheque No"
                  value={txnForm.referenceNo}
                  onChange={(e) => setTxnForm({ ...txnForm, referenceNo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g., Counter cash deposit into bank"
                  value={txnForm.description}
                  onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTxnModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
