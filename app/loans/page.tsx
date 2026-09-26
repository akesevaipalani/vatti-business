"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Plus,
  Search,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface LoanListItem {
  id: string;
  loanNo: string;
  date: string;
  principalAmount: number;
  principalPaid: number;
  principalOutstanding: number;
  interestPaid: number;
  interestOutstanding: number;
  interestRate: number;
  interestFrequency: string;
  interestType: string;
  loanCalculationType?: string;
  advanceInterest?: number;
  disbursedAmount?: number;
  paymentFrequency?: string;
  totalInstallments?: number;
  status: string;
  customer: {
    id: string;
    name: string;
    mobile: string;
    city: string | null;
  };
}

export default function LoansPage() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [loans, setLoans] = useState<LoanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("status");
      if (s) {
        setStatusFilter(s);
      }
    }
  }, []);

  useEffect(() => {
    const fetchLoans = async () => {
      setLoading(true);
      try {
        const url = statusFilter === "ALL" ? "/api/loans" : `/api/loans?status=${statusFilter}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setLoans(data.loans || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchLoans();
  }, [statusFilter]);

  const filtered = loans.filter(
    (l) =>
      l.loanNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.customer.mobile.includes(searchTerm)
  );

  const totalDisbursed = loans.reduce((s, l) => s + l.principalAmount, 0);
  const totalPrincipalDue = loans.reduce((s, l) => s + l.principalOutstanding, 0);
  const totalInterestDue = loans.reduce((s, l) => s + l.interestOutstanding, 0);
  const activeCount = loans.filter((l) => l.status === "ACTIVE").length;
  const overdueCount = loans.filter((l) => l.status === "OVERDUE").length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" />
            <span>{t.loansGiven}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Money given, customer loans, interest schedules, and repayment records
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/daily-collections"
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{t.dailyCollections}</span>
          </Link>
          <Link
            href="/loans/new"
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newLoan}</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">{t.totalMoneyGiven}</div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(totalDisbursed)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{loans.length} total loans issued</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">{t.totalPrincipalOutstanding}</div>
          <div className="text-xl font-black text-blue-600 mt-1 font-mono">
            {formatCurrency(totalPrincipalDue)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{activeCount} active borrowers</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">{t.totalInterestReceivable}</div>
          <div className="text-xl font-black text-amber-600 mt-1 font-mono">
            {formatCurrency(totalInterestDue)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Pending interest profit</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">{t.totalAmountReceivable}</div>
          <div className="text-xl font-black text-emerald-600 mt-1 font-mono">
            {formatCurrency(totalPrincipalDue + totalInterestDue)}
          </div>
          <div className="text-xs text-rose-500 mt-1 font-semibold">{overdueCount} overdue accounts</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {["ALL", "ACTIVE", "OVERDUE", "CLOSED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === s
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search loans, customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Loans Master Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading loans...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No loans found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Loan No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Rate & Type</th>
                  <th className="py-3 px-4 text-right">Principal</th>
                  <th className="py-3 px-4 text-right">Principal Due</th>
                  <th className="py-3 px-4 text-right">Interest Due</th>
                  <th className="py-3 px-4 text-right">Total Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      <Link href={`/loans/${loan.id}`} className="hover:underline">
                        {loan.loanNo}
                      </Link>
                      <div className="text-[10px] text-slate-400 font-sans font-normal mt-0.5">
                        {formatDate(loan.date)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {loan.customer?.name}
                      </div>
                      <div className="text-[10px] text-slate-400">{loan.customer?.mobile}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      {loan.loanCalculationType === "ADVANCE_INTEREST" ? (
                        <div>
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800">
                            Advance Interest
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Adv Int: {formatCurrency(loan.advanceInterest || 0)}
                          </div>
                        </div>
                      ) : loan.loanCalculationType === "INTEREST_PRINCIPAL" ? (
                        <div>
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[10px] border border-blue-200 dark:border-blue-800">
                            Interest + Principal
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {loan.paymentFrequency || "Monthly"}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {loan.interestRate}% {loan.interestFrequency.toLowerCase()}
                          </span>
                          <div className="text-[10px] text-slate-400">{loan.interestType}</div>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(loan.principalAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatCurrency(loan.principalOutstanding)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-amber-600">
                      {formatCurrency(loan.interestOutstanding)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                      {formatCurrency(loan.principalOutstanding + loan.interestOutstanding)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          loan.status === "ACTIVE"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                            : loan.status === "CLOSED"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400"
                        }`}
                      >
                        {loan.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/loans/${loan.id}`}
                        className="py-1 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition inline-flex items-center gap-1"
                      >
                        <span>View</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
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
