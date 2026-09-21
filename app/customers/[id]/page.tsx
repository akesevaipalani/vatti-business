"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MessageCircle,
  MapPin,
  Briefcase,
  Printer,
  Plus,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface CustomerLoan {
  id: string;
  loanNo: string;
  date: string;
  interestRate: number;
  interestFrequency: string;
  interestType: string;
  principalAmount: number;
  principalPaid: number;
  interestPaid: number;
  principalOutstanding: number;
  interestOutstanding: number;
  status: string;
}

interface CustomerPayment {
  id: string;
  paymentNo: string;
  date: string;
  paymentMethod: string;
  principalPortion: number;
  interestPortion: number;
  amount: number;
  notes: string | null;
}

interface CustomerDetail {
  id: string;
  customerCode: string;
  name: string;
  mobile: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  occupation: string | null;
  referencePerson: string | null;
  notes: string | null;
  loans?: CustomerLoan[];
  payments?: CustomerPayment[];
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { formatCurrency, formatDate } = useLanguage();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/${id}`);
        if (res.ok) {
          const json = await res.json();
          setCustomer(json.customer);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Customer record not found.
      </div>
    );
  }

  const loans = customer.loans || [];
  const payments = customer.payments || [];

  const totalBorrowed = loans.reduce((s: number, l: CustomerLoan) => s + l.principalAmount, 0);
  const totalPrincipalPaid = loans.reduce((s: number, l: CustomerLoan) => s + l.principalPaid, 0);
  const totalInterestPaid = loans.reduce((s: number, l: CustomerLoan) => s + l.interestPaid, 0);
  const totalPrincipalDue = loans.reduce((s: number, l: CustomerLoan) => s + l.principalOutstanding, 0);
  const totalInterestDue = loans.reduce((s: number, l: CustomerLoan) => s + l.interestOutstanding, 0);
  const totalOutstanding = totalPrincipalDue + totalInterestDue;

  const whatsappMessage = encodeURIComponent(
    `Dear ${customer.name},\nThis is a friendly reminder regarding your outstanding balance with Vatti Business: ₹${totalOutstanding.toLocaleString("en-IN")}.\nPlease arrange payment at your earliest convenience.\nThank you!`
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers</span>
        </Link>

        <div className="flex items-center gap-2">
          {customer.mobile && (
            <a
              href={`https://wa.me/91${customer.mobile.replace(/\D/g, "")}?text=${whatsappMessage}`}
              target="_blank"
              rel="noreferrer"
              className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow flex items-center gap-1.5 transition"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Send WhatsApp Reminder</span>
            </a>
          )}
          <Link
            href={`/loans/new?customerId=${customer.id}`}
            className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Give New Loan</span>
          </Link>
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Print Customer Statement</span>
          </button>
        </div>
      </div>

      {/* Customer Header Card */}
      <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-mono text-xs font-bold">
              {customer.customerCode}
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {customer.name}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-mono font-bold text-slate-800 dark:text-slate-200">
              {customer.mobile}
            </span>
            {customer.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {customer.city}
              </span>
            )}
            {customer.occupation && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                {customer.occupation}
              </span>
            )}
            {customer.referencePerson && (
              <span>Ref: <strong className="text-slate-700 dark:text-slate-300">{customer.referencePerson}</strong></span>
            )}
          </div>

          {customer.address && (
            <p className="text-xs text-slate-500 max-w-xl">
              {customer.address}
            </p>
          )}
        </div>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col items-start md:items-end">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Outstanding
          </span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {formatCurrency(totalOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Principal: {formatCurrency(totalPrincipalDue)} • Interest: {formatCurrency(totalInterestDue)}
          </div>
        </div>
      </div>

      {/* 4 KPI SUMMARY TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 font-sans">Total Borrowed</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(totalBorrowed)}
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-0.5">{loans.length} Loans Total</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 font-sans">Principal Paid Back</div>
          <div className="text-lg font-black text-emerald-600 mt-1">
            {formatCurrency(totalPrincipalPaid)}
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-0.5">Capital Returned</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 font-sans">Total Interest Paid</div>
          <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {formatCurrency(totalInterestPaid)}
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-0.5">Earnings from Client</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 font-sans">Total Money Collected</div>
          <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
            {formatCurrency(totalPrincipalPaid + totalInterestPaid)}
          </div>
          <div className="text-[10px] text-slate-400 font-sans mt-0.5">{payments.length} Payments Recorded</div>
        </div>
      </div>

      {/* ACTIVE & PAST LOANS GIVEN TO THIS CUSTOMER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Loans Taken ({loans.length})
          </h2>
          <Link
            href={`/loans/new?customerId=${customer.id}`}
            className="text-xs font-bold text-indigo-600 hover:underline"
          >
            + Give Another Loan
          </Link>
        </div>

        {loans.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No loans recorded for this customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Loan No</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Interest Terms</th>
                  <th className="py-3 px-4 text-right">Principal</th>
                  <th className="py-3 px-4 text-right">Prin. Due</th>
                  <th className="py-3 px-4 text-right">Interest Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {loans.map((l: CustomerLoan) => (
                  <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-indigo-600">
                      <Link href={`/loans/${l.id}`} className="hover:underline">
                        {l.loanNo}
                      </Link>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-700 dark:text-slate-300">
                      {formatDate(l.date)}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 dark:text-slate-400">
                      {l.interestRate}% {l.interestFrequency.toLowerCase()} ({l.interestType})
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(l.principalAmount)}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(l.principalOutstanding)}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-600">
                      {formatCurrency(l.interestOutstanding)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <Link
                        href={`/loans/${l.id}`}
                        className="py-1 px-2.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-[11px] font-semibold text-slate-700 dark:text-slate-300"
                      >
                        View Loan
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ALL PAYMENTS RECEIVED FROM THIS CUSTOMER */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Payment & Collection History ({payments.length})
          </h2>
        </div>

        {payments.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No payments recorded yet for this customer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Payment No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4 text-right">Principal</th>
                  <th className="py-3 px-4 text-right">Interest</th>
                  <th className="py-3 px-4 text-right">Total Paid</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {payments.map((p: CustomerPayment) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-bold text-indigo-600">{p.paymentNo}</td>
                    <td className="py-3 px-4 font-sans text-slate-700 dark:text-slate-300">
                      {formatDate(p.date)}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-[10px]">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(p.principalPortion)}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-600">
                      {formatCurrency(p.interestPortion)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-emerald-600 text-sm">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500">{p.notes || "-"}</td>
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
