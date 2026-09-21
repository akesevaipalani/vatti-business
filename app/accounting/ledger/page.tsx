"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Printer,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface LedgerAccountItem {
  id: string;
  code: string;
  name: string;
  type: string;
  currentBalance?: number;
  balance?: number;
}

interface LedgerEntryItem {
  id: string;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
  description: string;
  account: { code: string; name: string; type: string };
  ledgerTransaction: { transactionNo: string; date: string; description: string; referenceType: string };
}

export default function AccountingLedgerPage() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [accounts, setAccounts] = useState<LedgerAccountItem[]>([]);
  const [entries, setEntries] = useState<LedgerEntryItem[]>([]);
  const [totals, setTotals] = useState({ totalDebits: 0, totalCredits: 0, isBalanced: true });
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState("ALL");

  useEffect(() => {
    const fetchLedger = async () => {
      setLoading(true);
      try {
        const url = selectedAccount === "ALL" ? "/api/accounting/ledger" : `/api/accounting/ledger?accountCode=${selectedAccount}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setAccounts(json.accounts || []);
          setEntries(json.entries || []);
          setTotals({
            totalDebits: json.totalDebits || 0,
            totalCredits: json.totalCredits || 0,
            isBalanced: json.isBalanced,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, [selectedAccount]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            <span>{t.accountingLedger}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time Double-Entry General Ledger with automatic Debit & Credit trial balance verification
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

      {/* Trial Balance Audit Verification Banner */}
      <div
        className={`p-4 rounded-xl border flex items-center justify-between ${
          totals.isBalanced
            ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
            : "bg-rose-50 dark:bg-rose-950/30 border-rose-500/30 text-rose-800 dark:text-rose-300"
        }`}
      >
        <div className="flex items-center gap-2.5">
          {totals.isBalanced ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <div>
            <div className="text-xs font-bold">
              {totals.isBalanced
                ? "Double-Entry Ledger Verified & In Balance"
                : "Trial Balance Variance Detected"}
            </div>
            <div className="text-[11px] opacity-80">
              Total Debits: {formatCurrency(totals.totalDebits)} • Total Credits: {formatCurrency(totals.totalCredits)}
            </div>
          </div>
        </div>
        <span className="font-mono font-bold text-xs">
          Difference: {formatCurrency(Math.abs(totals.totalDebits - totals.totalCredits))}
        </span>
      </div>

      {/* Chart of Accounts Grid */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
          Chart of Accounts Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
          <button
            onClick={() => setSelectedAccount("ALL")}
            className={`p-2.5 rounded-xl border text-left transition ${
              selectedAccount === "ALL"
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            }`}
          >
            <div className="text-[10px] text-slate-400 font-mono">ALL ACCOUNTS</div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">All Entries</div>
          </button>

          {accounts.map((acct) => (
            <button
              key={acct.id}
              onClick={() => setSelectedAccount(acct.code)}
              className={`p-2.5 rounded-xl border text-left transition ${
                selectedAccount === acct.code
                  ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/50"
                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              }`}
            >
              <div className="text-[10px] font-mono text-indigo-600">{acct.code} ({acct.type})</div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                {acct.name}
              </div>
              <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-1 font-semibold">
                {formatCurrency(acct.currentBalance ?? acct.balance ?? 0)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* General Journal Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Journal Entries & Postings
          </h3>
          <span className="text-xs text-slate-500">{entries.length} recent postings</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading ledger entries...</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No journal postings found for this account.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Txn No</th>
                  <th className="py-3 px-4">Account</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit (₹)</th>
                  <th className="py-3 px-4 text-right">Credit (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-slate-400">
                      {formatDate(entry.ledgerTransaction.date)}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-indigo-600">
                      {entry.ledgerTransaction.transactionNo}
                    </td>
                    <td className="py-3.5 px-4 font-sans font-bold text-slate-800 dark:text-slate-200">
                      {entry.account.code} - {entry.account.name}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-700 dark:text-slate-300">
                      {entry.ledgerTransaction.description}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 text-sm">
                      {entry.entryType === "DEBIT" ? formatCurrency(entry.amount) : "-"}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-blue-600 text-sm">
                      {entry.entryType === "CREDIT" ? formatCurrency(entry.amount) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
