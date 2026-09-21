"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  Printer,
  Search,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface CashBookEntry {
  id: string;
  date: string;
  type: "IN" | "OUT";
  category: string;
  title: string;
  amount: number;
  ref: string;
}

interface CashBookData {
  cashAccount?: { currentBalance: number; openingBalance: number };
  totalCashIn: number;
  totalCashOut: number;
  netCash: number;
  entries: CashBookEntry[];
}

export default function CashBookPage() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [data, setData] = useState<CashBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchCashBook();
  }, []);

  const fetchCashBook = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cash-book");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const entries = data?.entries || [];
  const cashAccount = data?.cashAccount;

  const filteredEntries = entries.filter((e: CashBookEntry) => {
    const matchesType = typeFilter === "ALL" || e.type === typeFilter;
    const matchesSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.ref.toLowerCase().includes(search.toLowerCase()) ||
      e.category.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <span>{t.cashBook}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time physical cash-in-hand register, cash inflows, and cash outflows
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Opening Cash Balance</div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(cashAccount?.openingBalance || 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Starting counter cash</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Cash In (Received)</div>
          <div className="text-xl font-black text-emerald-600 mt-1 font-mono">
            {formatCurrency(data?.totalCashIn || 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Collections, Incomes, Capital</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Cash Out (Paid)</div>
          <div className="text-xl font-black text-rose-600 mt-1 font-mono">
            {formatCurrency(data?.totalCashOut || 0)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Expenses, Withdrawals, Loans</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-950/30 shadow-sm border-emerald-500/30">
          <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            Current Cash-in-Hand
          </div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
            {formatCurrency(cashAccount?.currentBalance || 0)}
          </div>
          <div className="text-xs text-emerald-600 dark:text-emerald-500 mt-1 font-medium">
            Available at Cash Counter
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {["ALL", "IN", "OUT"].map((s) => (
            <button
              key={s}
              onClick={() => setTypeFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                typeFilter === s
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {s === "ALL" ? "All Transactions" : s === "IN" ? "Cash In (+)" : "Cash Out (-)"}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search cash entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Cash Register Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading Cash Book...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No cash transactions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Ref Code</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Transaction Description</th>
                  <th className="py-3 px-4 text-right">Cash In (+)</th>
                  <th className="py-3 px-4 text-right">Cash Out (-)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filteredEntries.map((entry: CashBookEntry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400">
                      {formatDate(entry.date)}
                    </td>
                    <td className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      {entry.ref}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {entry.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-900 dark:text-slate-100 font-medium">
                      {entry.title}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600 text-sm">
                      {entry.type === "IN" ? formatCurrency(entry.amount) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600 text-sm">
                      {entry.type === "OUT" ? formatCurrency(entry.amount) : "-"}
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
