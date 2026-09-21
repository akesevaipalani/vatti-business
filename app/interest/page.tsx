"use client";

import React, { useState, useEffect } from "react";
import {
  Percent,
  Search,
  Printer,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface InterestLoanItem {
  id: string;
  loanNo: string;
  customerId: string;
  customer: { name: string; mobile: string };
  interestRate: number;
  interestFrequency: string;
  interestType: string;
  principalAmount: number;
  interestPaid: number;
  interestOutstanding: number;
}

interface InterestPaymentItem {
  id: string;
  interestPortion: number;
}

export default function InterestPage() {
  const { t, formatCurrency } = useLanguage();
  const [loans, setLoans] = useState<InterestLoanItem[]>([]);
  const [payments, setPayments] = useState<InterestPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/loans").then((r) => r.json()),
      fetch("/api/collections").then((r) => r.json()),
    ])
      .then(([loansRes, collRes]) => {
        setLoans(loansRes.loans || []);
        setPayments(collRes.payments || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const totalInterestReceived = payments.reduce((s, p) => s + (p.interestPortion || 0), 0);
  const totalInterestPending = loans.reduce((s, l) => s + (l.interestOutstanding || 0), 0);
  const totalInterestEarned = totalInterestReceived + totalInterestPending;

  // Customer-wise interest aggregation
  const customerInterestMap: Record<string, { name: string; mobile: string; earned: number; received: number; pending: number }> = {};

  loans.forEach((l) => {
    const cid = l.customerId;
    if (!customerInterestMap[cid]) {
      customerInterestMap[cid] = {
        name: l.customer.name,
        mobile: l.customer.mobile,
        earned: 0,
        received: 0,
        pending: 0,
      };
    }
    customerInterestMap[cid].received += l.interestPaid || 0;
    customerInterestMap[cid].pending += l.interestOutstanding || 0;
    customerInterestMap[cid].earned += (l.interestPaid || 0) + (l.interestOutstanding || 0);
  });

  const customerInterestList = Object.values(customerInterestMap).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.mobile.includes(search)
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Percent className="w-5 h-5 text-amber-600" />
            <span>{t.interestManagement}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Interest revenue analytics, interest received, pending interest, and customer-wise interest breakdown
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Interest Earned</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(totalInterestEarned)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Total contract interest across all loans</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Interest Collected & Realized</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
            {formatCurrency(totalInterestReceived)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Actual interest collected into cash/bank</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-amber-50 dark:bg-amber-950/30 border-amber-500/30 shadow-sm">
          <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Pending / Receivable Interest
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 font-mono">
            {formatCurrency(totalInterestPending)}
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
            Future interest income to collect
          </div>
        </div>
      </div>

      {/* Customer Wise Interest Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Customer-Wise Interest Performance & Receivables
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading interest data...</div>
        ) : customerInterestList.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No customer interest records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Borrower Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-right">Total Interest Contracted</th>
                  <th className="py-3 px-4 text-right">Interest Paid</th>
                  <th className="py-3 px-4 text-right">Interest Pending</th>
                  <th className="py-3 px-4 text-center">Collection %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {customerInterestList.map((c, i) => {
                  const pct = c.earned > 0 ? Math.round((c.received / c.earned) * 100) : 0;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-sans font-bold text-slate-900 dark:text-slate-100">
                        {c.name}
                      </td>
                      <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-slate-400">
                        {c.mobile}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(c.earned)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(c.received)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-amber-600">
                        {formatCurrency(c.pending)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-sans font-bold">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400">
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
