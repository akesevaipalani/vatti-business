"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  WalletCards,
  Search,
  Printer,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { CollectionReceiptModal } from "@/components/documents/CollectionReceiptModal";

interface PaymentItem {
  id: string;
  paymentNo: string;
  date: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  paymentMethod: string;
  customer: { id: string; name: string; mobile: string };
  loan: { id: string; loanNo: string; principalAmount: number };
  notes: string | null;
}

export default function CollectionsPage() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [totals, setTotals] = useState({ totalCollected: 0, totalPrincipal: 0, totalInterest: 0 });
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      setLoading(true);
      try {
        const url = methodFilter === "ALL" ? "/api/collections" : `/api/collections?method=${methodFilter}`;
        const res = await fetch(url);
        if (res.ok) {
          const json = await res.json();
          setPayments(json.payments || []);
          setTotals({
            totalCollected: json.totalCollected || 0,
            totalPrincipal: json.totalPrincipal || 0,
            totalInterest: json.totalInterest || 0,
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, [methodFilter]);

  const filtered = payments.filter(
    (p) =>
      p.customer?.name.toLowerCase().includes(search.toLowerCase()) ||
      p.loan?.loanNo.toLowerCase().includes(search.toLowerCase()) ||
      p.paymentNo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <WalletCards className="w-5 h-5 text-emerald-600" />
            <span>{t.collections}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Master register of all loan collections, principal repayments, and interest income received
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/daily-collections"
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.dailyCollections}</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{t.print}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Money Collected</div>
          <div className="text-2xl font-black text-emerald-600 mt-1 font-mono">
            {formatCurrency(totals.totalCollected)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{payments.length} collection transactions</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Principal Recovered</div>
          <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(totals.totalPrincipal)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Returned to capital pool</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">Total Interest Earned & Received</div>
          <div className="text-2xl font-black text-amber-600 mt-1 font-mono">
            {formatCurrency(totals.totalInterest)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Net interest income realized</div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {["ALL", "CASH", "UPI", "BANK"].map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                methodFilter === m
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search customer, loan no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading collections...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No collections found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Receipt No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Loan No</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Principal</th>
                  <th className="py-3 px-4 text-right">Interest</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPaymentId(p.id);
                          setShowReceiptModal(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5 transition text-left"
                        title="View Official Collection Receipt"
                      >
                        <Printer className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                        <span>{p.paymentNo}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-600 dark:text-slate-400">
                      {formatDate(p.date)}
                    </td>
                    <td className="py-3.5 px-4 font-sans font-bold text-slate-900 dark:text-slate-100">
                      <Link href={`/customers/${p.customer.id}`} className="hover:underline">
                        {p.customer.name}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <Link href={`/loans/${p.loan.id}`} className="text-indigo-600 hover:underline">
                        {p.loan.loanNo}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-700">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(p.principalPortion)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-amber-600 font-semibold">
                      {formatCurrency(p.interestPortion)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-600 text-sm">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-500">{p.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* INSTANT COLLECTION RECEIPT MODAL                                          */}
      {/* ========================================================================= */}
      <CollectionReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedPaymentId(null);
        }}
        paymentId={selectedPaymentId}
      />
    </div>
  );
}
