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
  Download,
  Share2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { CollectionReceiptModal, ReceiptData } from "@/components/documents/CollectionReceiptModal";

import { getTodayIST, isPastDateIST } from "@/lib/date";

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
  address?: string;
  city?: string;
  guarantors: GuarantorItem[];
}

interface LoanDetail {
  id: string;
  loanNo: string;
  status: string;
  date: string;
  loanCalculationType?: string;
  advanceInterest?: number;
  disbursedAmount?: number;
  processingFee?: number;
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
  totalPayable?: number;
  paymentFrequency?: string;
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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"schedule" | "payments" | "collateral">("schedule");

  // Payment Modal
  const [payModal, setPayModal] = useState(false);
  const [collectionDate, setCollectionDate] = useState(() => getTodayIST());
  const [amount, setAmount] = useState("");
  const [principalPortion, setPrincipalPortion] = useState("");
  const [interestPortion, setInterestPortion] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Instant Collection Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [receiptInitialData, setReceiptInitialData] = useState<Partial<ReceiptData> | null>(null);

  const fetchLoan = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/loans/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const errJson = await res.json().catch(() => null);
        const errorMsg = errJson?.error || `Unable to load loan record (HTTP ${res.status})`;
        setFetchError(errorMsg);
      }
    } catch (err: unknown) {
      console.error(err);
      setFetchError(err instanceof Error ? err.message : "Network error while loading loan details");
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

    const isAdvInt = data.loan.loanCalculationType === "ADVANCE_INTEREST" || (data.loan.interestOutstanding || 0) <= 0;
    let iPart = 0;
    if (!isAdvInt) {
      const nextUnpaid = data.loan.installments?.find(
        (i) => i.status !== "COLLECTED" && (i.paidAmount || 0) < i.installmentAmount
      );
      if (nextUnpaid && nextUnpaid.interestPortion > 0) {
        const remInstInterest = Math.max(0, nextUnpaid.interestPortion - (nextUnpaid as any).interestPaid || 0);
        iPart = Math.min(remInstInterest, Math.min(data.loan.interestOutstanding || 0, defaultAmt));
      } else {
        iPart = Math.min(data.loan.interestOutstanding || 0, defaultAmt);
      }
    }

    setInterestPortion(String(iPart));
    setPrincipalPortion(String(Math.max(0, defaultAmt - iPart)));
    setPaymentMethod("CASH");
    setNotes("Installment Payment");
    setErrorMsg("");
    setCollectionDate(getTodayIST());
    setPayModal(true);
  };

  const handleAmountChange = (newAmtStr: string) => {
    setAmount(newAmtStr);
    const num = Number(newAmtStr) || 0;
    const isAdvInt = data?.loan?.loanCalculationType === "ADVANCE_INTEREST" || (data?.loan?.interestOutstanding || 0) <= 0;
    if (isAdvInt) {
      setInterestPortion("0");
      setPrincipalPortion(String(num));
    } else {
      const nextUnpaid = data?.loan?.installments?.find(
        (i) => i.status !== "COLLECTED" && (i.paidAmount || 0) < i.installmentAmount
      );
      let iPart = 0;
      if (nextUnpaid && nextUnpaid.interestPortion > 0) {
        const remInstInterest = Math.max(0, nextUnpaid.interestPortion - (nextUnpaid as any).interestPaid || 0);
        iPart = Math.min(remInstInterest, Math.min(data?.loan?.interestOutstanding || 0, num));
      } else {
        iPart = Math.min(data?.loan?.interestOutstanding || 0, num);
      }
      setInterestPortion(String(iPart));
      setPrincipalPortion(String(Math.max(0, num - iPart)));
    }
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

      const d = await res.json();
      if (res.ok && d.success) {
        setPayModal(false);
        fetchLoan();
        const p = d.payment;
        if (p) {
          setReceiptPaymentId(p.id);
          setReceiptInitialData({
            receiptNo: p.paymentNo,
            loanNo: loan?.loanNo || "",
            collectionDate: p.date || collectionDate,
            actualPaymentDate: p.date || new Date(),
            customer: {
              name: loan?.customer.name || "",
              mobile: loan?.customer.mobile || "",
              address: (() => {
                const a = (loan?.customer.address || "").trim();
                const c = (loan?.customer.city || "").trim();
                if (!a) return c || "—";
                if (!c || a.toLowerCase().includes(c.toLowerCase())) return a;
                return `${a}, ${c}`;
              })(),
            },
            previousOutstanding: d.previousOutstanding ?? (p as any).previousOutstanding,
            currentOutstanding: d.currentOutstanding ?? (p as any).currentOutstanding,
            totalAmountPaid: p.amount,
            principalPaid: p.principalPortion,
            interestPaid: p.interestPortion,
            paymentMethod: p.paymentMethod || paymentMethod,
          });
          setShowReceiptModal(true);
        }
      } else {
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

  if (fetchError) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm space-y-4">
        <div className="w-12 h-12 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Unable to load loan details</h3>
          <p className="text-xs text-red-600 dark:text-red-400 font-mono mt-1">{fetchError}</p>
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={fetchLoan}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
          <Link
            href="/loans"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold"
          >
            Back to Loans
          </Link>
        </div>
      </div>
    );
  }

  const loan = data?.loan;
  const schedule = data?.schedule || [];

  if (!loan) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="text-slate-400 text-sm">Loan record not found.</div>
        <Link
          href="/loans"
          className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
        >
          Back to Loans
        </Link>
      </div>
    );
  }

  const isAdvanceInterest = loan.loanCalculationType === "ADVANCE_INTEREST" || Boolean((loan as any).advanceInterest && (loan as any).advanceInterest > 0);
  const isInterestPrincipal = loan.loanCalculationType === "INTEREST_PRINCIPAL";

  const calculationTypeDisplay = isAdvanceInterest
    ? "Advance Interest (முன் வட்டி)"
    : isInterestPrincipal
    ? "Interest + Principal (அசல் + வட்டி)"
    : "Standard Loan";

  const interestMethodDisplay = isAdvanceInterest
    ? "Upfront Advance Deduction"
    : `${loan.interestType || "Flat"} (${loan.interestRate}% ${loan.interestFrequency?.toLowerCase() || "monthly"})`;

  const customerReceivedAmt = loan.disbursedAmount && loan.disbursedAmount > 0
    ? loan.disbursedAmount
    : Math.max(0, loan.principalAmount - (loan.advanceInterest || 0) - (loan.processingFee || 0));

  const totalPayableAmt = loan.totalPayable && loan.totalPayable > 0
    ? loan.totalPayable
    : (loan.principalAmount + (isAdvanceInterest ? 0 : (loan.interestOutstanding + loan.interestPaid)));

  const totalOutstandingAmt = loan.principalOutstanding + (isAdvanceInterest ? 0 : loan.interestOutstanding);

  // Determine Next Due Date from first unpaid installment
  const nextUnpaidInst = loan.installments?.find(
    (i) => i.status !== "COLLECTED" && (i.paidAmount || 0) < i.installmentAmount
  ) || schedule.find((s) => {
    const inst = loan.installments?.find((i) => i.installmentNumber === s.installmentNumber);
    return !inst || (inst.status !== "COLLECTED" && (inst.paidAmount || 0) < s.installmentAmount);
  });
  const nextDueDateStr = nextUnpaidInst
    ? formatDate(nextUnpaidInst.dueDate)
    : (loan.status === "CLOSED" ? "Completed" : "None");

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
            onClick={() => window.open(`/api/documents/loan-document?id=${loan.id}&download=1`, "_blank")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sanction PDF</span>
          </button>
          <button
            onClick={() => window.open(`/api/documents/loan-document?id=${loan.id}`, "_blank")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sanction</span>
          </button>
          <button
            onClick={() => {
              const text = `*ABC FINANCE - LOAN SANCTION ORDER*
--------------------------------
Loan No: ${loan.loanNo}
Customer: ${loan.customer?.name}
Sanctioned Principal: Rs. ${loan.principalAmount?.toLocaleString("en-IN")}
Customer Received: Rs. ${customerReceivedAmt.toLocaleString("en-IN")}
Total Repayable: Rs. ${totalPayableAmt.toLocaleString("en-IN")}
Tenure: ${loan.totalInstallments} ${loan.paymentFrequency} installments
Installment Amount: Rs. ${loan.installmentAmount?.toLocaleString("en-IN")}
Next Due Date: ${nextDueDateStr}
--------------------------------
Your official loan sanction document with complete installment schedule has been generated.
ABC FINANCE | Contact: +91 96008 71898`;
              const phone = loan.customer?.mobile || "";
              const clean = phone.replace(/\D/g, "");
              const waPhone = clean.length === 10 ? `91${clean}` : clean;
              const url = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
              window.open(url, "_blank");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
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
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                Next Due: {nextDueDateStr}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">
              {loan.customer?.name}
            </h1>
            <p className="text-xs text-slate-500">
              Loan Account Statement & Amortization Schedule • Mobile: <span className="font-semibold text-slate-700 dark:text-slate-300">{loan.customer?.mobile}</span> • Sanction Date: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatDate(loan.date)}</span>
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-500 block">Total Outstanding Balance</span>
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5 block">
              {formatCurrency(totalOutstandingAmt)}
            </span>
            <span className="text-xs text-slate-400">
              Principal: {formatCurrency(loan.principalOutstanding)} • Interest: {formatCurrency(loan.interestOutstanding)}
            </span>
          </div>
        </div>

        {/* Loan Terms Grid - Detailed Specifications */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-slate-400 block font-medium">Calculation Type</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{calculationTypeDisplay}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Interest Method</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{interestMethodDisplay}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Frequency</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 uppercase">{loan.paymentFrequency || loan.interestFrequency || "Monthly"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">No. of Installments</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{loan.totalInstallments} {loan.paymentFrequency || "Dues"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Next Due Date</span>
            <span className="font-bold font-mono text-amber-600 dark:text-amber-400">{nextDueDateStr}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Installment Amount</span>
            <span className="font-bold font-mono text-emerald-600">
              {formatCurrency(loan.installmentAmount)} / {loan.paymentFrequency?.toLowerCase() || "due"}
            </span>
          </div>
        </div>
      </div>

      {/* Financial Progress Cards (8 Distinct Financial Metrics matching Requirement 7) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* 1. Principal / Face Amount */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">Principal / Face Amount</div>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(loan.principalAmount)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Sanctioned Face Capital</div>
        </div>

        {/* 2. Charges / Processing Fee */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">Charges / Processing Fee</div>
          <div className="text-base font-bold text-slate-700 dark:text-slate-300 mt-1 font-mono">
            {formatCurrency(loan.processingFee || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Deducted Upfront</div>
        </div>

        {/* 3. Disbursed Amount */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">Disbursed Amount</div>
          <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 font-mono">
            {formatCurrency(loan.disbursedAmount || loan.principalAmount)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Disbursement Outflow</div>
        </div>

        {/* 4. Customer Received Amount */}
        <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">Customer Received Amount</div>
          <div className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
            {formatCurrency(customerReceivedAmt)}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">
            {isAdvanceInterest ? "Face - Adv Interest - Fees" : "Net Received In-Hand"}
          </div>
        </div>

        {/* 5. Advance Interest or Total Interest */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">
            {isAdvanceInterest ? "Advance Interest (முன் வட்டி)" : "Total Interest"}
          </div>
          <div className="text-base font-bold text-teal-600 mt-1 font-mono">
            {formatCurrency(isAdvanceInterest ? (loan.advanceInterest || 0) : Math.max(0, totalPayableAmt - loan.principalAmount))}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {isAdvanceInterest ? "Retained Upfront" : `Interest Paid: ${formatCurrency(loan.interestPaid)}`}
          </div>
        </div>

        {/* 6. Total Payable */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">Total Payable / Repayable</div>
          <div className="text-base font-bold text-indigo-600 mt-1 font-mono">
            {formatCurrency(totalPayableAmt)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{loan.totalInstallments} Total Dues</div>
        </div>

        {/* 7. Total Paid Amount */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">Paid Amount (Collections)</div>
          <div className="text-base font-bold text-emerald-600 mt-1 font-mono">
            {formatCurrency(loan.principalPaid + (isAdvanceInterest ? 0 : loan.interestPaid))}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Prin: {formatCurrency(loan.principalPaid)} • Int: {formatCurrency(loan.interestPaid)}
          </div>
        </div>

        {/* 8. Total Outstanding */}
        <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="text-[11px] font-bold text-amber-800 dark:text-amber-400">Total Outstanding</div>
          <div className="text-base font-black text-amber-700 dark:text-amber-300 mt-1 font-mono">
            {formatCurrency(totalOutstandingAmt)}
          </div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400 mt-0.5">
            Prin: {formatCurrency(loan.principalOutstanding)}
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
                  <th className="py-3 px-4 text-right">Expected Amount</th>
                  <th className="py-3 px-4 text-right">Principal</th>
                  <th className="py-3 px-4 text-right">Interest</th>
                  <th className="py-3 px-4 text-right">Paid Amount</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {schedule.map((item: ScheduleItem) => {
                  const inst = loan.installments?.find((i) => i.installmentNumber === item.installmentNumber);
                  const isPaid = inst?.status === "COLLECTED";
                  const isPartial = inst?.status === "PARTIALLY_PAID";
                  const isOverdue = inst?.status === "OVERDUE" || (inst ? (isPastDateIST(inst.dueDate) && !isPaid) : false);
                  const paidAmt = inst?.paidAmount || 0;
                  const balanceAmt = inst ? Math.max(0, item.installmentAmount - paidAmt) : item.installmentAmount;

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
                        {formatCurrency(paidAmt)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(balanceAmt)}
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
                    <th className="py-3 px-4">Receipt / Payment No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4 text-right">Principal</th>
                    <th className="py-3 px-4 text-right">Interest</th>
                    <th className="py-3 px-4 text-right">Total Paid</th>
                    <th className="py-3 px-4 text-center">Receipt Actions</th>
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
                      <td className="py-3 px-4 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => window.open(`/api/documents/collection-receipt?paymentId=${p.id}&download=1`, "_blank")}
                            title="Download Official Receipt PDF"
                            className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 text-xs font-semibold transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => window.open(`/api/documents/collection-receipt?paymentId=${p.id}`, "_blank")}
                            title="Print Official Receipt"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const text = `*ABC FINANCE - PAYMENT RECEIPT*
--------------------------------
Receipt No: ${p.paymentNo}
Loan No: ${loan.loanNo}
Customer: ${loan.customer?.name}
Date: ${formatDate(p.date)}
Amount Paid: Rs. ${p.amount?.toLocaleString("en-IN")}
Principal Credited: Rs. ${p.principalPortion?.toLocaleString("en-IN")}
Interest Credited: Rs. ${p.interestPortion?.toLocaleString("en-IN")}
Payment Mode: ${p.paymentMethod}
--------------------------------
Thank you for your payment! Please preserve this receipt for your records.
ABC FINANCE | Contact: +91 96008 71898`;
                              const phone = loan.customer?.mobile || "";
                              const clean = phone.replace(/\D/g, "");
                              const waPhone = clean.length === 10 ? `91${clean}` : clean;
                              const url = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
                              window.open(url, "_blank");
                            }}
                            title="Share via WhatsApp"
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 text-xs font-semibold transition"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
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
                    readOnly={isAdvanceInterest}
                    className={`w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 ${isAdvanceInterest ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-not-allowed" : "bg-white dark:bg-slate-700"} text-xs font-mono font-bold`}
                  />
                  {isAdvanceInterest && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">100% Principal Recovery</span>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Interest Portion
                  </label>
                  <input
                    type="number"
                    value={isAdvanceInterest ? 0 : interestPortion}
                    onChange={(e) => !isAdvanceInterest && setInterestPortion(e.target.value)}
                    disabled={isAdvanceInterest}
                    className={`w-full px-2 py-1.5 rounded border border-slate-300 dark:border-slate-600 ${isAdvanceInterest ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed" : "bg-white dark:bg-slate-700 text-amber-600"} text-xs font-mono font-bold`}
                  />
                  {isAdvanceInterest && (
                    <span className="text-[10px] text-slate-400 font-medium block mt-0.5">Deducted upfront</span>
                  )}
                </div>
              </div>

              {/* LIVE COLLECTION BREAKDOWN & OUTSTANDING AFTER PAYMENT */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                  <span>Collection Component Breakdown</span>
                  <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Live Preview</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                    <span className="text-[10px] text-slate-500 font-sans block">Current Outstanding</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(totalOutstandingAmt)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                    <span className="text-[10px] text-slate-500 font-sans block">Total Collection</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(Number(amount) || 0)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                    <span className="text-[10px] text-slate-500 font-sans block">Principal Component</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {formatCurrency(Number(principalPortion) || 0)}
                    </span>
                  </div>
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                    <span className="text-[10px] text-slate-500 font-sans block">Interest Component</span>
                    <span className="font-bold text-amber-600">
                      {formatCurrency(Number(interestPortion) || 0)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-emerald-200 dark:border-emerald-800/80 text-xs font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Outstanding After Payment:</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-mono text-sm font-black">
                    {formatCurrency(Math.max(0, totalOutstandingAmt - (Number(amount) || 0)))}
                  </span>
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

      {/* ========================================================================= */}
      {/* INSTANT COLLECTION RECEIPT MODAL                                          */}
      {/* ========================================================================= */}
      <CollectionReceiptModal
        isOpen={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setReceiptPaymentId(null);
          setReceiptInitialData(null);
        }}
        paymentId={receiptPaymentId}
        initialData={receiptInitialData}
      />
    </div>
  );
}
