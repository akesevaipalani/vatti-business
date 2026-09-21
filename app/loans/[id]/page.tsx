"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  User,
  Shield,
  CheckCircle2,
  X,
  Calendar,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const getTodayDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

interface GuarantorItem {
  id: string;
  name: string;
  relationship: string | null;
  mobile: string;
}

interface CollateralItem {
  id: string;
  type: string;
  description: string;
  estimatedValue: number;
  status: string;
}

interface LoanPaymentItem {
  id: string;
  paymentNo: string;
  date: string;
  paymentMethod: string;
  principalPortion: number;
  interestPortion: number;
  amount: number;
  notes: string | null;
}

interface ScheduleItem {
  installmentNumber: number;
  dueDate: string;
  installmentAmount: number;
  principalPortion: number;
  interestPortion: number;
  remainingPrincipal: number;
}

interface LoanDetailCustomer {
  id: string;
  name: string;
  mobile: string;
  guarantors: GuarantorItem[];
}

interface LoanDetail {
  id: string;
  loanNo: string;
  status: string;
  date: string;
  interestRate: number;
  interestFrequency: string;
  interestType: string;
  installmentAmount: number;
  principalAmount: number;
  principalPaid: number;
  interestPaid: number;
  principalOutstanding: number;
  interestOutstanding: number;
  totalInstallments: number;
  customer: LoanDetailCustomer;
  payments: LoanPaymentItem[];
  collaterals: CollateralItem[];
  installments?: Array<{
    id: string;
    installmentNumber: number;
    dueDate: string;
    installmentAmount: number;
    principalPortion: number;
    interestPortion: number;
    paidAmount: number;
    status: string;
    actualPaymentDate?: string | null;
  }>;
}

interface LoanDataResponse {
  loan: LoanDetail;
  schedule: ScheduleItem[];
}

export default function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, formatCurrency, formatDate } = useLanguage();
  const [data, setData] = useState<LoanDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"schedule" | "payments" | "collateral">("schedule");

  // Payment Modal
  const [payModal, setPayModal] = useState(false);
  const [collectionDate, setCollectionDate] = useState(() => getTodayDateStr());
  const [amount, setAmount] = useState("");
  const [principalPortion, setPrincipalPortion] = useState("");
  const [interestPortion, setInterestPortion] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchLoan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/loans/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLoan();
  }, [fetchLoan]);

  const openPayModal = () => {
    if (!data?.loan) return;
    const defaultAmt = data.loan.installmentAmount || 2000;
    setAmount(String(defaultAmt));
    const iPart = Math.round(defaultAmt * 0.2);
    setInterestPortion(String(iPart));
    setPrincipalPortion(String(defaultAmt - iPart));
    setPaymentMethod("CASH");
    setNotes("Installment Payment");
    setErrorMsg("");
    setCollectionDate(getTodayDateStr());
    setPayModal(true);
  };

  const handleAmountChange = (newAmtStr: string) => {
    setAmount(newAmtStr);
    const num = Number(newAmtStr) || 0;
    const iPart = Math.round(num * 0.2);
    setInterestPortion(String(iPart));
    setPrincipalPortion(String(num - iPart));
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/loans/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          principalPortion: Number(principalPortion),
          interestPortion: Number(interestPortion),
          paymentMethod,
          collectionDate,
          notes,
        }),
      });

      if (res.ok) {
        setPayModal(false);
        fetchLoan();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Payment recording failed");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const loan = data?.loan;
  const schedule = data?.schedule || [];

  if (!loan) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Loan record not found.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top action bar */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/loans"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Loans</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Ledger</span>
          </button>
          {loan.status !== "CLOSED" && (
            <button
              onClick={openPayModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>COLLECT PAYMENT</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Loan Statement Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {loan.loanNo}
              </span>
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
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">
              {loan.customer?.name}
            </h1>
            <p className="text-xs text-slate-500">
              Loan Account Statement & Amortization Schedule
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500 block">Total Outstanding Balance</span>
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5 block">
              {formatCurrency(loan.principalOutstanding + loan.interestOutstanding)}
            </span>
            <span className="text-xs text-slate-400">
              Principal: {formatCurrency(loan.principalOutstanding)} • Interest: {formatCurrency(loan.interestOutstanding)}
            </span>
          </div>
        </div>

        {/* Loan Terms Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Customer Mobile</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{loan.customer?.mobile}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Disbursed Date</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(loan.date)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Interest Rate & Type</span>
            <span className="font-semibold text-indigo-600">
              {loan.interestRate}% {loan.interestFrequency.toLowerCase()} ({loan.interestType})
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Installment Amount</span>
            <span className="font-semibold font-mono text-emerald-600 text-sm">
              {formatCurrency(loan.installmentAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Progress Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">Principal Disbursed</div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(loan.principalAmount)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">Principal Paid</div>
          <div className="text-lg font-bold text-emerald-600 mt-1 font-mono">
            {formatCurrency(loan.principalPaid)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">Interest Paid</div>
          <div className="text-lg font-bold text-teal-600 mt-1 font-mono">
            {formatCurrency(loan.interestPaid)}
          </div>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">Remaining Installments</div>
          <div className="text-lg font-bold text-indigo-600 mt-1 font-mono">
            {loan.totalInstallments - (loan.payments?.length || 0)} of {loan.totalInstallments}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-bold">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === "schedule"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Repayment Schedule ({schedule.length} installments)
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === "payments"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Actual Payments Received ({loan.payments?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("collateral")}
          className={`pb-2.5 transition border-b-2 ${
            activeTab === "collateral"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Guarantor & Collateral
        </button>
      </div>

      {/* TAB CONTENT 1: SCHEDULE */}
      {activeTab === "schedule" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Installment Amount</th>
                  <th className="py-3 px-4 text-right">Principal</th>
                  <th className="py-3 px-4 text-right">Interest</th>
                  <th className="py-3 px-4 text-right">Paid Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {schedule.map((item: ScheduleItem) => {
                  const inst = loan.installments?.find((i) => i.installmentNumber === item.installmentNumber);
                  const isPaid = inst?.status === "COLLECTED";
                  const isPartial = inst?.status === "PARTIALLY_PAID";
                  const isOverdue = inst?.status === "OVERDUE" || (inst ? (new Date(inst.dueDate) < new Date() && !isPaid) : false);

                  return (
                    <tr key={item.installmentNumber} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-indigo-600">{item.installmentNumber}</td>
                      <td className="py-3 px-4 font-sans text-slate-700 dark:text-slate-300">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(item.installmentAmount)}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400">
                        {formatCurrency(item.principalPortion)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-600">
                        {formatCurrency(item.interestPortion)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-600">
                        {formatCurrency(inst?.paidAmount || 0)}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        {isPaid && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            Collected
                          </span>
                        )}
                        {isPartial && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            Partially Paid
                          </span>
                        )}
                        {!isPaid && !isPartial && isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            Overdue
                          </span>
                        )}
                        {!isPaid && !isPartial && !isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: ACTUAL PAYMENTS */}
      {activeTab === "payments" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {(!loan.payments || loan.payments.length === 0) ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No payments collected yet.
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
                  {loan.payments.map((p: LoanPaymentItem) => (
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
      )}

      {/* TAB CONTENT 3: COLLATERAL & GUARANTOR */}
      {activeTab === "collateral" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span>Linked Guarantor Details</span>
            </h3>
            {loan.customer?.guarantors?.length > 0 ? (
              <div className="space-y-2 text-xs">
                {loan.customer.guarantors.map((g: GuarantorItem) => (
                  <div key={g.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{g.name}</div>
                    <div className="text-slate-500">Relationship: {g.relationship || "Guarantor"}</div>
                    <div className="text-slate-500">Mobile: {g.mobile}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No guarantor linked to this borrower.</p>
            )}
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-600" />
              <span>Collateral Security Record</span>
            </h3>
            {loan.collaterals?.length > 0 ? (
              <div className="space-y-2 text-xs">
                {loan.collaterals.map((col: CollateralItem) => (
                  <div key={col.id} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{col.type}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {col.status}
                      </span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">{col.description}</div>
                    <div className="font-mono text-emerald-600 font-bold">
                      Est. Value: {formatCurrency(col.estimatedValue)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">This loan is unsecured (no collateral registered).</p>
            )}
          </div>
        </div>
      )}

      {/* COLLECT PAYMENT MODAL */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Record Loan Collection Payment
                </h3>
                <p className="text-xs text-slate-500">{loan.customer?.name} • {loan.loanNo}</p>
              </div>
              <button onClick={() => setPayModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-3.5">
              {errorMsg && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-600 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              {/* MANDATORY COLLECTION DATE FIELD */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Collection Date *</span>
                  </label>
                  <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    {formatDate(collectionDate)}
                  </span>
                </div>
                <input
                  type="date"
                  required
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  autoFocus
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-mono font-black text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Principal Portion
                  </label>
                  <input
                    type="number"
                    value={principalPortion}
                    onChange={(e) => setPrincipalPortion(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Interest Portion
                  </label>
                  <input
                    type="number"
                    value={interestPortion}
                    onChange={(e) => setInterestPortion(e.target.value)}
                    className="w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-mono font-bold text-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CASH">Cash-in-Hand</option>
                  <option value="BANK">Bank Transfer / Cheque</option>
                  <option value="UPI">UPI / Digital</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Installment payment / notes"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPayModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
