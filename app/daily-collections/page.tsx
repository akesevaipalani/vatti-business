"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Calendar,
  Search,
  Phone,
  Printer,
  Download,
  Share2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  RefreshCw,
  FileSpreadsheet,
  Receipt,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CollectionReceiptModal, ReceiptData } from "@/components/documents/CollectionReceiptModal";
import { getTodayIST, formatISTDisplay } from "@/lib/date";

export interface ScheduleItem {
  id: string;
  installmentId: string;
  loanId: string;
  loanNo: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  mobile: string;
  customerMobile: string;
  address: string;
  installmentNumber: number;
  installmentNo: number;
  dueDate: string;
  scheduledCollectionDate?: string;
  installmentAmount: number;
  amount: number;
  dueAmount: number;
  paidAmount: number;
  pendingAmount: number;
  balance: number;
  principal: number;
  interest: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  actualPaymentDate?: string | null;
}

export interface CollectedTodayPaymentItem {
  paymentId: string;
  id: string;
  paymentNo: string;
  loanId: string;
  loanNo: string;
  loanNumber: string;
  customerId: string;
  customerName: string;
  customerCode: string;
  mobile: string;
  customerMobile: string;
  installmentId?: string | null;
  installmentNo: number;
  installmentNumber: number;
  amount: number;
  amountCollected: number;
  principal: number;
  principalPaid: number;
  interest: number;
  interestPaid: number;
  paymentMethod: string;
  collectionDate: string;
  actualPaymentDate: string;
  status: "PAID";
  address?: string;
  previousOutstanding?: number;
  currentOutstanding?: number;
  remainingOutstanding?: number;
  loan?: any;
  customer?: any;
}

export interface ScheduleSummary {
  todayDueCount: number;
  todayDueAmount: number;
  todayCollectedAmount: number;
  todayPendingCount: number;
  todayPendingAmount: number;
  overdueCount: number;
  overdueAmount: number;
}

type CollectionTab = "today" | "pending" | "collected" | "overdue";

export default function CollectionManagementPage() {
  const { formatCurrency, formatDate } = useLanguage();

  // Active Tab: "today" | "pending" | "collected" | "overdue"
  const [activeTab, setActiveTab] = useState<CollectionTab>("today");

  // Selected date for schedule
  const [selectedDate, setSelectedDate] = useState(() => getTodayIST());

  // Schedule data states
  const [todayDue, setTodayDue] = useState<ScheduleItem[]>([]);
  const [todayPending, setTodayPending] = useState<ScheduleItem[]>([]);
  const [collectedToday, setCollectedToday] = useState<CollectedTodayPaymentItem[]>([]);
  const [overdueItems, setOverdueItems] = useState<ScheduleItem[]>([]);
  const [summary, setSummary] = useState<ScheduleSummary>({
    todayDueCount: 0,
    todayDueAmount: 0,
    todayCollectedAmount: 0,
    todayPendingCount: 0,
    todayPendingAmount: 0,
    overdueCount: 0,
    overdueAmount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Quick Collect Modal State
  const [collectTarget, setCollectTarget] = useState<ScheduleItem | null>(null);
  const [collectionDate, setCollectionDate] = useState(() => getTodayIST());
  const [amount, setAmount] = useState("");
  const [principalPortion, setPrincipalPortion] = useState("");
  const [interestPortion, setInterestPortion] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Instant Collection Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [receiptInitialData, setReceiptInitialData] = useState<Partial<ReceiptData> | null>(null);

  // Business Name for PDF and Print
  const [businessName, setBusinessName] = useState("VATTI BUSINESS");

  // Read URL query params on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as CollectionTab | null;
      if (tabParam && ["today", "pending", "collected", "overdue"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  // Load Business Profile
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.profile?.name) {
          setBusinessName(data.profile.name);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Central Schedule API
  const fetchSchedule = useCallback(async (dateToFetch: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/schedule?date=${dateToFetch}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTodayDue(data.todayDue || []);
          setTodayPending(data.todayPending || []);
          setCollectedToday(data.collectedToday || []);
          setOverdueItems(data.overdue || []);
          setSummary(
            data.summary || {
              todayDueCount: 0,
              todayDueAmount: 0,
              todayCollectedAmount: 0,
              todayPendingCount: 0,
              todayPendingAmount: 0,
              overdueCount: 0,
              overdueAmount: 0,
            }
          );
        }
      }
    } catch (err) {
      console.error("Failed to fetch collection schedule:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule(selectedDate);
  }, [selectedDate, fetchSchedule]);

  // Open Collect Modal
  const openCollectModal = (item: ScheduleItem) => {
    setCollectTarget(item);
    setCollectionDate(getTodayIST());
    setErrorMsg("");
    setSuccessMsg("");

    const dueAmount = item.pendingAmount || item.balance || item.installmentAmount;
    setAmount(String(dueAmount));

    const isAdvInt = (item as any).loanCalculationType === "ADVANCE_INTEREST" || Boolean((item as any).advanceInterest && (item as any).advanceInterest > 0);
    const isZeroInterest = isAdvInt || item.interest === 0 || (item as any).interestPortion === 0;
    const defaultInterest = isZeroInterest ? 0 : Number(item.interest ?? (item as any).interestPortion ?? 0);
    const pPart = Math.max(0, dueAmount - defaultInterest);
    const iPart = defaultInterest;

    setPrincipalPortion(String(pPart));
    setInterestPortion(String(iPart));
    setPaymentMethod("CASH");
    setNotes(`Installment #${item.installmentNumber} Collection`);
  };

  const handleAmountChange = (newAmtStr: string) => {
    setAmount(newAmtStr);
    const num = Number(newAmtStr) || 0;
    const isAdvInt = (collectTarget as any)?.loanCalculationType === "ADVANCE_INTEREST" || Boolean((collectTarget as any)?.advanceInterest && (collectTarget as any)?.advanceInterest > 0);
    const isZeroInterest = isAdvInt || !collectTarget || collectTarget.interest === 0 || (collectTarget as any).interestPortion === 0;
    if (isZeroInterest) {
      setInterestPortion("0");
      setPrincipalPortion(String(num));
    } else {
      const scheduledInt = Number(collectTarget.interest ?? (collectTarget as any).interestPortion ?? 0);
      const iPart = Math.min(scheduledInt, num);
      const pPart = Math.max(0, num - iPart);
      setInterestPortion(String(iPart));
      setPrincipalPortion(String(pPart));
    }
  };

  const handleCollectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectTarget) return;

    setActionLoading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/collections/today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId: collectTarget.installmentId || collectTarget.id,
          amount: Number(amount),
          principalPortion: Number(principalPortion),
          interestPortion: Number(interestPortion),
          collectionDate,
          paymentMethod,
          notes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg("Collection recorded successfully!");
        const paymentId = data.payment?.id || null;
        const initialReceipt: Partial<ReceiptData> | null = data.payment
          ? {
              receiptNo: data.payment.paymentNo,
              loanNo: collectTarget.loanNumber || collectTarget.loanNo,
              collectionDate: data.payment.date || collectionDate,
              actualPaymentDate: data.payment.date || new Date(),
              installmentNumber: collectTarget.installmentNumber,
              customer: {
                name: collectTarget.customerName,
                mobile: collectTarget.mobile,
                address: collectTarget.address,
              },
              previousOutstanding: data.previousOutstanding ?? (data.payment as any)?.previousOutstanding,
              currentOutstanding: data.currentOutstanding ?? (data.payment as any)?.currentOutstanding,
              totalAmountPaid: data.payment.amount,
              principalPaid: data.payment.principalPortion,
              interestPaid: data.payment.interestPortion,
              paymentMethod: data.payment.paymentMethod || paymentMethod,
            }
          : null;

        // Dismiss collection form
        setCollectTarget(null);

        // Open Instant Collection Receipt Modal
        setReceiptPaymentId(paymentId);
        setReceiptInitialData(initialReceipt);
        setShowReceiptModal(true);

        // Refresh underlying collection schedule
        fetchSchedule(selectedDate);
      } else {
        setErrorMsg(data.error || "Failed to record payment");
      }
    } catch {
      setErrorMsg("A network error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  // View Receipt for an already collected item
  const openReceiptForPayment = (payment: CollectedTodayPaymentItem) => {
    setReceiptPaymentId(payment.paymentId || payment.id);
    setReceiptInitialData({
      receiptNo: payment.paymentNo,
      loanNo: payment.loanNo,
      collectionDate: payment.collectionDate,
      actualPaymentDate: payment.actualPaymentDate,
      installmentNumber: payment.installmentNo || payment.installmentNumber,
      customer: {
        name: payment.customerName,
        mobile: payment.mobile,
        address: payment.address || (payment.customer as any)?.address,
      },
      previousOutstanding: (payment as any).previousOutstanding,
      currentOutstanding: (payment as any).currentOutstanding,
      totalAmountPaid: payment.amount,
      principalPaid: payment.principalPaid ?? payment.principal ?? (payment as any).principalPortion,
      interestPaid: payment.interestPaid ?? payment.interest ?? (payment as any).interestPortion,
      paymentMethod: payment.paymentMethod,
    });
    setShowReceiptModal(true);
  };

  // Filtered lists by search term
  const filterList = <T extends { customerName: string; loanNo?: string; loanNumber?: string; mobile?: string }>(
    list: T[]
  ): T[] => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((i) => {
      const name = i.customerName?.toLowerCase() || "";
      const loan = (i.loanNo || i.loanNumber || "").toLowerCase();
      const mob = i.mobile || "";
      return name.includes(q) || loan.includes(q) || mob.includes(q);
    });
  };

  const filteredTodayDue = filterList(todayDue);
  const filteredTodayPending = filterList(todayPending);
  const filteredCollectedToday = filterList(collectedToday);
  const filteredOverdue = filterList(overdueItems);

  // PDF Generation respects current active tab (Section 11)
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const formattedDate = formatISTDisplay(selectedDate);

    let title = "";
    let head: string[][] = [];
    let body: (string | number)[][] = [];

    if (activeTab === "today") {
      title = `TODAY COLLECTION LIST – ${formattedDate}`;
      head = [["#", "Customer", "Code", "Mobile", "Loan No", "Inst #", "Due (₹)", "Paid (₹)", "Balance (₹)", "Status"]];
      body = filteredTodayDue.map((item, idx) => [
        idx + 1,
        item.customerName,
        item.customerCode || "-",
        item.mobile,
        item.loanNo,
        `#${item.installmentNumber}`,
        item.installmentAmount.toLocaleString("en-IN"),
        item.paidAmount.toLocaleString("en-IN"),
        item.pendingAmount.toLocaleString("en-IN"),
        item.status,
      ]);
    } else if (activeTab === "pending") {
      title = `TODAY PENDING COLLECTION – ${formattedDate}`;
      head = [["#", "Customer", "Code", "Mobile", "Loan No", "Inst #", "Due (₹)", "Paid (₹)", "Pending (₹)", "Status"]];
      body = filteredTodayPending.map((item, idx) => [
        idx + 1,
        item.customerName,
        item.customerCode || "-",
        item.mobile,
        item.loanNo,
        `#${item.installmentNumber}`,
        item.installmentAmount.toLocaleString("en-IN"),
        item.paidAmount.toLocaleString("en-IN"),
        item.pendingAmount.toLocaleString("en-IN"),
        item.status,
      ]);
    } else if (activeTab === "collected") {
      title = `COLLECTED TODAY – ${formattedDate}`;
      head = [["#", "Receipt No", "Customer", "Loan No", "Inst #", "Collected (₹)", "Principal (₹)", "Interest (₹)", "Method"]];
      body = filteredCollectedToday.map((p, idx) => [
        idx + 1,
        p.paymentNo,
        p.customerName,
        p.loanNo,
        `#${p.installmentNo}`,
        p.amount.toLocaleString("en-IN"),
        p.principal.toLocaleString("en-IN"),
        p.interest.toLocaleString("en-IN"),
        p.paymentMethod,
      ]);
    } else {
      title = `OVERDUE COLLECTIONS – As of ${formattedDate}`;
      head = [["#", "Customer", "Code", "Mobile", "Loan No", "Inst #", "Due Date", "Due (₹)", "Overdue (₹)", "Status"]];
      body = filteredOverdue.map((item, idx) => [
        idx + 1,
        item.customerName,
        item.customerCode || "-",
        item.mobile,
        item.loanNo,
        `#${item.installmentNumber}`,
        formatISTDisplay(item.dueDate),
        item.installmentAmount.toLocaleString("en-IN"),
        item.pendingAmount.toLocaleString("en-IN"),
        "OVERDUE",
      ]);
    }

    doc.setFontSize(16);
    doc.text(businessName, 14, 15);
    doc.setFontSize(12);
    doc.text(title, 14, 22);

    doc.setFontSize(9);
    doc.text(
      `Today Due: ₹${summary.todayDueAmount.toLocaleString("en-IN")}  |  Collected Today: ₹${summary.todayCollectedAmount.toLocaleString("en-IN")}  |  Today Pending: ₹${summary.todayPendingAmount.toLocaleString("en-IN")}  |  Overdue: ₹${summary.overdueAmount.toLocaleString("en-IN")}`,
      14,
      28
    );

    autoTable(doc, {
      startY: 33,
      head,
      body,
      theme: "grid",
      headStyles: {
        fillColor:
          activeTab === "today"
            ? [16, 185, 129]
            : activeTab === "pending"
            ? [99, 102, 241]
            : activeTab === "collected"
            ? [5, 150, 105]
            : [225, 29, 72],
      },
      styles: { fontSize: 8 },
    });

    doc.save(`Collection_${activeTab}_${selectedDate}.pdf`);
  };

  // WhatsApp Share respects current active tab (Section 11)
  const handleShareWhatsApp = () => {
    handleDownloadPDF();

    const formattedDate = formatISTDisplay(selectedDate);
    let msg = `*${businessName}*\n`;

    if (activeTab === "today") {
      msg += `*TODAY COLLECTION / இன்றைய வசூல் – ${formattedDate}*\n\n`;
      msg += `📋 *Today Due Customers:* ${summary.todayDueCount}\n`;
      msg += `💰 *Today Due Amount:* ₹${summary.todayDueAmount.toLocaleString("en-IN")}\n`;
      msg += `✅ *Collected Today:* ₹${summary.todayCollectedAmount.toLocaleString("en-IN")}\n`;
      msg += `⏳ *Pending Today:* ₹${summary.todayPendingAmount.toLocaleString("en-IN")}\n\n`;
      msg += `*--- CUSTOMER LIST ---*\n`;
      filteredTodayDue.forEach((item, idx) => {
        msg += `\n${idx + 1}. *${item.customerName}* (${item.customerCode || ""})\n`;
        msg += `   Loan: ${item.loanNo} (Inst #${item.installmentNumber})\n`;
        msg += `   Due: ₹${item.installmentAmount.toLocaleString("en-IN")} | Paid: ₹${item.paidAmount} | Bal: ₹${item.pendingAmount}\n`;
        msg += `   Status: *${item.status}*\n`;
      });
    } else if (activeTab === "pending") {
      msg += `*TODAY PENDING COLLECTION / இன்றைய நிலுவை – ${formattedDate}*\n\n`;
      msg += `⚠️ *Pending Installments:* ${summary.todayPendingCount}\n`;
      msg += `⏳ *Total Pending Amount:* ₹${summary.todayPendingAmount.toLocaleString("en-IN")}\n\n`;
      msg += `*--- PENDING CUSTOMERS ---*\n`;
      filteredTodayPending.forEach((item, idx) => {
        msg += `\n${idx + 1}. *${item.customerName}* (${item.mobile})\n`;
        msg += `   Loan: ${item.loanNo} (Inst #${item.installmentNumber})\n`;
        msg += `   Pending Balance: *₹${item.pendingAmount.toLocaleString("en-IN")}*\n`;
        msg += `   Status: *${item.status}*\n`;
      });
    } else if (activeTab === "collected") {
      msg += `*COLLECTED TODAY / இன்று வசூலித்தது – ${formattedDate}*\n\n`;
      msg += `✅ *Total Payments Received:* ${collectedToday.length}\n`;
      msg += `💰 *Total Amount Collected:* ₹${summary.todayCollectedAmount.toLocaleString("en-IN")}\n\n`;
      msg += `*--- COLLECTION RECEIPTS ---*\n`;
      filteredCollectedToday.forEach((p, idx) => {
        msg += `\n${idx + 1}. *${p.customerName}* – ₹${p.amount.toLocaleString("en-IN")}\n`;
        msg += `   Receipt: ${p.paymentNo} | Loan: ${p.loanNo} (Inst #${p.installmentNo})\n`;
      });
    } else {
      msg += `*OVERDUE COLLECTIONS / காலதாமத நிலுவை – ${formattedDate}*\n\n`;
      msg += `🚨 *Overdue Loans:* ${summary.overdueCount}\n`;
      msg += `💰 *Overdue Amount:* ₹${summary.overdueAmount.toLocaleString("en-IN")}\n\n`;
      msg += `*--- OVERDUE LIST ---*\n`;
      filteredOverdue.forEach((item, idx) => {
        msg += `\n${idx + 1}. *${item.customerName}* (${item.mobile})\n`;
        msg += `   Loan: ${item.loanNo} (Due: ${formatISTDisplay(item.dueDate)})\n`;
        msg += `   Overdue Amount: *₹${item.pendingAmount.toLocaleString("en-IN")}*\n`;
      });
    }

    msg += `\n\n📄 _Note: Matching PDF report downloaded on your device for attachment._`;
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              <span>Collection Management</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              RECONCILED ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Today&apos;s Due, Today&apos;s Pending, Collected Today, and Overdue with strict IST reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSchedule(selectedDate)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
            title="Refresh schedule"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/collections"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Full History</span>
          </Link>
        </div>
      </div>

      {/* Date Selector & Action Bar */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Business Date (IST):</span>
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="py-1.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => setSelectedDate(getTodayIST())}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 hover:text-emerald-600 transition"
          >
            Today (IST)
          </button>
        </div>

        {/* Export Buttons: Print, PDF, WhatsApp */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold shadow-sm transition"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-sm transition"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>PDF Report</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp Share</span>
          </button>
        </div>
      </div>

      {/* 4 RECONCILED SUMMARY CARDS (SECTION 12 & SECTION 2) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Today's Due */}
        <div
          onClick={() => setActiveTab("today")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === "today"
              ? "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400">
            <span>Today&apos;s Due / இன்றைய வசூல்</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              {summary.todayDueCount}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-slate-100 mt-2">
            {formatCurrency(summary.todayDueAmount)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span>Installments due {formatISTDisplay(selectedDate)}</span>
          </div>
        </div>

        {/* Card 2: Collected Today */}
        <div
          onClick={() => setActiveTab("collected")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === "collected"
              ? "bg-teal-50/70 dark:bg-teal-950/40 border-teal-500 shadow-md ring-2 ring-teal-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-teal-700 dark:text-teal-400">
            <span>Collected Today / இன்று வசூலித்தது</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
              {collectedToday.length}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-teal-600 mt-2">
            {formatCurrency(summary.todayCollectedAmount)}
          </div>
          <div className="text-[11px] text-teal-600/80 mt-1">
            Received today across all collections
          </div>
        </div>

        {/* Card 3: Today's Pending */}
        <div
          onClick={() => setActiveTab("pending")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === "pending"
              ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-400">
            <span>Today&apos;s Pending / இன்றைய நிலுவை</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
              {summary.todayPendingCount}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-indigo-600 mt-2">
            {formatCurrency(summary.todayPendingAmount)}
          </div>
          <div className="text-[11px] text-indigo-600/80 mt-1">
            Unpaid / partially paid from today&apos;s due
          </div>
        </div>

        {/* Card 4: Overdue */}
        <div
          onClick={() => setActiveTab("overdue")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            activeTab === "overdue"
              ? "bg-rose-50/70 dark:bg-rose-950/40 border-rose-500 shadow-md ring-2 ring-rose-500/20"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-300"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-400">
            <span>Overdue / காலதாமத நிலுவை</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
              {summary.overdueCount}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-rose-600 mt-2">
            {formatCurrency(summary.overdueAmount)}
          </div>
          <div className="text-[11px] text-rose-600/80 mt-1">
            Installments due before {formatISTDisplay(selectedDate)}
          </div>
        </div>
      </div>

      {/* Reconciliation Note Banner */}
      <div className="bg-slate-50 dark:bg-slate-800/40 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>
            Strict Reconciliation: <strong>Today Due</strong> ({formatCurrency(summary.todayDueAmount)}) ={" "}
            <strong>Collected on Due</strong> (
            {formatCurrency(Math.max(0, summary.todayDueAmount - summary.todayPendingAmount))}) +{" "}
            <strong>Pending Today</strong> ({formatCurrency(summary.todayPendingAmount)})
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-500">
          Business Date: <strong>{formatISTDisplay(selectedDate)}</strong>
        </div>
      </div>

      {/* 4 REQUIRED TABS SWITCHER (SECTION 2) */}
      <div className="print:hidden flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        {/* Tab 1: Today's Collection */}
        <button
          onClick={() => setActiveTab("today")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition shadow-sm ${
            activeTab === "today"
              ? "bg-emerald-600 text-white shadow-emerald-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Today&apos;s Collection (இன்றைய வசூல்)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === "today" ? "bg-emerald-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
            }`}
          >
            {summary.todayDueCount}
          </span>
        </button>

        {/* Tab 2: Today's Pending */}
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition shadow-sm ${
            activeTab === "pending"
              ? "bg-indigo-600 text-white shadow-indigo-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Today&apos;s Pending (இன்றைய நிலுவை)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === "pending" ? "bg-indigo-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
            }`}
          >
            {summary.todayPendingCount}
          </span>
        </button>

        {/* Tab 3: Collected Today */}
        <button
          onClick={() => setActiveTab("collected")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition shadow-sm ${
            activeTab === "collected"
              ? "bg-teal-600 text-white shadow-teal-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Collected Today (இன்று வசூலித்தது)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === "collected" ? "bg-teal-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
            }`}
          >
            {collectedToday.length}
          </span>
        </button>

        {/* Tab 4: Overdue */}
        <button
          onClick={() => setActiveTab("overdue")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition shadow-sm ${
            activeTab === "overdue"
              ? "bg-rose-600 text-white shadow-rose-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Overdue (காலதாமத நிலுவை)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === "overdue" ? "bg-rose-700 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600"
            }`}
          >
            {summary.overdueCount}
          </span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="print:hidden relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name, code, loan number, or mobile..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2 font-medium">Loading collection schedule...</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: TODAY'S COLLECTION (இன்றைய வசூல்)                                  */}
          {/* ========================================================================= */}
          {activeTab === "today" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Today&apos;s Collection List (இன்றைய வசூல்)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    All customers whose installment is due on {formatISTDisplay(selectedDate)}
                  </p>
                </div>
                <div className="text-xs font-mono font-bold text-emerald-600">
                  Total Due: {formatCurrency(summary.todayDueAmount)}
                </div>
              </div>

              {filteredTodayDue.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No installment due on {formatISTDisplay(selectedDate)}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Mobile</th>
                        <th className="py-3 px-4">Loan No</th>
                        <th className="py-3 px-4 text-center">Inst #</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4 text-right">Due Amount</th>
                        <th className="py-3 px-4 text-right">Paid Amount</th>
                        <th className="py-3 px-4 text-right">Balance</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="print:hidden py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTodayDue.map((item, idx) => {
                        const isFullyPaid = item.status === "PAID";
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{item.customerName}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{item.customerCode || "-"}</div>
                            </td>
                            <td className="py-3.5 px-4 font-mono">
                              <a
                                href={`tel:${item.mobile}`}
                                className="text-emerald-600 hover:underline flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3" />
                                <span>{item.mobile}</span>
                              </a>
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                              <Link href={`/loans/${item.loanId}`} className="hover:underline">
                                {item.loanNo}
                              </Link>
                            </td>
                            <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                              #{item.installmentNumber}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                              {formatISTDisplay(item.dueDate)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 dark:text-slate-100">
                              {formatCurrency(item.installmentAmount)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-emerald-600">
                              {formatCurrency(item.paidAmount)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                              {formatCurrency(item.pendingAmount)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {item.status === "PAID" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>PAID</span>
                                </span>
                              )}
                              {item.status === "PARTIAL" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                  <span>PARTIAL</span>
                                </span>
                              )}
                              {item.status === "PENDING" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  <Clock className="w-3 h-3" />
                                  <span>PENDING</span>
                                </span>
                              )}
                            </td>
                            <td className="print:hidden py-3.5 px-4 text-center">
                              <button
                                onClick={() => openCollectModal(item)}
                                disabled={isFullyPaid}
                                className={`py-1.5 px-3 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1 mx-auto ${
                                  isFullyPaid
                                    ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{isFullyPaid ? "Paid" : "Collect"}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-bold">
                        <td colSpan={6} className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          Total ({filteredTodayDue.length} Installments):
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100">
                          {formatCurrency(filteredTodayDue.reduce((s, i) => s + i.installmentAmount, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          {formatCurrency(filteredTodayDue.reduce((s, i) => s + i.paidAmount, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600 font-black">
                          {formatCurrency(filteredTodayDue.reduce((s, i) => s + i.pendingAmount, 0))}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: TODAY'S PENDING (இன்றைய நிலுவை)                                    */}
          {/* ========================================================================= */}
          {activeTab === "pending" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Today&apos;s Pending List (இன்றைய நிலுவை)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Today&apos;s due installments where paidAmount &lt; installmentAmount
                  </p>
                </div>
                <div className="text-xs font-mono font-bold text-rose-600">
                  Total Pending: {formatCurrency(summary.todayPendingAmount)}
                </div>
              </div>

              {filteredTodayPending.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  🎉 No pending collections for {formatISTDisplay(selectedDate)}! All due installments are fully collected.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Mobile</th>
                        <th className="py-3 px-4">Loan No</th>
                        <th className="py-3 px-4 text-center">Inst #</th>
                        <th className="py-3 px-4">Due Date</th>
                        <th className="py-3 px-4 text-right">Due Amount</th>
                        <th className="py-3 px-4 text-right">Paid Amount</th>
                        <th className="py-3 px-4 text-right text-rose-600 font-bold">Pending Amount</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="print:hidden py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTodayPending.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{item.customerName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.customerCode || "-"}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <a
                              href={`tel:${item.mobile}`}
                              className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{item.mobile}</span>
                            </a>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                            <Link href={`/loans/${item.loanId}`} className="hover:underline">
                              {item.loanNo}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                            #{item.installmentNumber}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400">
                            {formatISTDisplay(item.dueDate)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatCurrency(item.installmentAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-600">
                            {formatCurrency(item.paidAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-rose-600 text-sm">
                            {formatCurrency(item.pendingAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.status === "PARTIAL" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                <span>PARTIAL</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Clock className="w-3 h-3" />
                                <span>PENDING</span>
                              </span>
                            )}
                          </td>
                          <td className="print:hidden py-3.5 px-4 text-center">
                            <button
                              onClick={() => openCollectModal(item)}
                              className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-1 mx-auto"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Collect</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-bold">
                        <td colSpan={6} className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          Total Pending ({filteredTodayPending.length} Installments):
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatCurrency(filteredTodayPending.reduce((s, i) => s + i.installmentAmount, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          {formatCurrency(filteredTodayPending.reduce((s, i) => s + i.paidAmount, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600 text-sm font-black">
                          {formatCurrency(filteredTodayPending.reduce((s, i) => s + i.pendingAmount, 0))}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: COLLECTED TODAY (இன்று வசூலித்தது)                                   */}
          {/* ========================================================================= */}
          {activeTab === "collected" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                    <span>Collected Today (இன்று வசூலித்தது)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Payments actually received and posted on {formatISTDisplay(selectedDate)}
                  </p>
                </div>
                <div className="text-xs font-mono font-bold text-teal-600">
                  Total Collected: {formatCurrency(summary.todayCollectedAmount)}
                </div>
              </div>

              {filteredCollectedToday.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  No payments collected yet on {formatISTDisplay(selectedDate)}.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Receipt No</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Loan No</th>
                        <th className="py-3 px-4 text-center">Inst #</th>
                        <th className="py-3 px-4 text-right">Amount Collected</th>
                        <th className="py-3 px-4 text-right">Principal</th>
                        <th className="py-3 px-4 text-right">Interest</th>
                        <th className="py-3 px-4 text-center">Method</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="print:hidden py-3 px-4 text-center">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredCollectedToday.map((p, idx) => (
                        <tr key={p.paymentId || p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                            {p.paymentNo}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{p.customerName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.customerCode || p.mobile}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                            <Link href={`/loans/${p.loanId}`} className="hover:underline">
                              {p.loanNo}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                            #{p.installmentNo}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-600 text-sm">
                            {formatCurrency(p.amount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatCurrency(p.principal)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-amber-600">
                            {formatCurrency(p.interest)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {p.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>PAID</span>
                            </span>
                          </td>
                          <td className="print:hidden py-3.5 px-4 text-center">
                            <button
                              onClick={() => openReceiptForPayment(p)}
                              className="py-1 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition flex items-center gap-1 mx-auto"
                            >
                              <Receipt className="w-3.5 h-3.5 text-teal-600" />
                              <span>Receipt</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-bold">
                        <td colSpan={5} className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          Total Received Today ({filteredCollectedToday.length} Payments):
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600 font-black text-sm">
                          {formatCurrency(filteredCollectedToday.reduce((s, p) => s + p.amount, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatCurrency(filteredCollectedToday.reduce((s, p) => s + p.principal, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-amber-600">
                          {formatCurrency(filteredCollectedToday.reduce((s, p) => s + p.interest, 0))}
                        </td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: OVERDUE (காலதாமத நிலுவை)                                           */}
          {/* ========================================================================= */}
          {activeTab === "overdue" && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Overdue Collections (காலதாமத நிலுவை)</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Installments due strictly before {formatISTDisplay(selectedDate)} and not fully settled
                  </p>
                </div>
                <div className="text-xs font-mono font-bold text-rose-600">
                  Total Overdue: {formatCurrency(summary.overdueAmount)}
                </div>
              </div>

              {filteredOverdue.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-400">
                  ✨ No overdue installments found! All past installments are fully collected.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Mobile</th>
                        <th className="py-3 px-4">Loan No</th>
                        <th className="py-3 px-4 text-center">Inst #</th>
                        <th className="py-3 px-4">Scheduled Due Date</th>
                        <th className="py-3 px-4 text-right">Due Amount</th>
                        <th className="py-3 px-4 text-right">Paid Amount</th>
                        <th className="py-3 px-4 text-right text-rose-600 font-bold">Overdue Balance</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="print:hidden py-3 px-4 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredOverdue.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{item.customerName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.customerCode || "-"}</div>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            <a
                              href={`tel:${item.mobile}`}
                              className="text-rose-600 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{item.mobile}</span>
                            </a>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                            <Link href={`/loans/${item.loanId}`} className="hover:underline">
                              {item.loanNo}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600 dark:text-slate-300">
                            #{item.installmentNumber}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-rose-600 font-bold">
                            {formatISTDisplay(item.dueDate)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatCurrency(item.installmentAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-emerald-600">
                            {formatCurrency(item.paidAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-rose-600 text-sm">
                            {formatCurrency(item.pendingAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              <AlertTriangle className="w-3 h-3" />
                              <span>OVERDUE</span>
                            </span>
                          </td>
                          <td className="print:hidden py-3.5 px-4 text-center">
                            <button
                              onClick={() => openCollectModal(item)}
                              className="py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition flex items-center gap-1 mx-auto"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Collect</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-bold">
                        <td colSpan={6} className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                          Total Overdue ({filteredOverdue.length} Installments):
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {formatCurrency(filteredOverdue.reduce((s, i) => s + i.installmentAmount, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-600">
                          {formatCurrency(filteredOverdue.reduce((s, i) => s + i.paidAmount, 0))}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-600 text-sm font-black">
                          {formatCurrency(filteredOverdue.reduce((s, i) => s + i.pendingAmount, 0))}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* QUICK COLLECT PAYMENT MODAL */}
      {collectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Record Loan Collection Payment</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {collectTarget.customerName} • {collectTarget.loanNo} (Inst #{collectTarget.installmentNumber})
                </p>
              </div>
              <button
                onClick={() => setCollectTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCollectSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Scheduled Due Date Notice */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500">Scheduled Due Date:</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatISTDisplay(collectTarget.dueDate)}
                </span>
              </div>

              {/* MANDATORY COLLECTION DATE */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1.5">
                <label className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Actual Collection Date (IST) *</span>
                  </span>
                  <span className="text-[10px] font-normal text-amber-700 dark:text-amber-400">
                    Indian Format (DD/MM/YYYY)
                  </span>
                </label>
                <input
                  type="date"
                  required
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-mono"
                />
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Recorded in cash book & ledger. The original scheduled date remains untouched.
                </p>
              </div>

              {/* Collection Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Collection Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold font-mono text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Principal and Interest Split */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Principal Portion (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={principalPortion}
                    onChange={(e) => setPrincipalPortion(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Interest Portion (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={interestPortion}
                    onChange={(e) => setInterestPortion(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                  />
                </div>
              </div>

              {/* LIVE COLLECTION BREAKDOWN & OUTSTANDING AFTER PAYMENT */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                  <span>Collection Component Breakdown</span>
                  <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">
                    Live Preview
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-white dark:bg-slate-800 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                    <span className="text-[10px] text-slate-500 font-sans block">Current Due</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(collectTarget.pendingAmount || collectTarget.installmentAmount)}
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
                  <span className="text-slate-700 dark:text-slate-300">Outstanding Due After Payment:</span>
                  <span className="text-emerald-700 dark:text-emerald-300 font-mono text-sm font-black">
                    {formatCurrency(
                      Math.max(
                        0,
                        (collectTarget.pendingAmount || collectTarget.installmentAmount) - (Number(amount) || 0)
                      )
                    )}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["CASH", "BANK", "UPI"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        paymentMethod === m
                          ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes / reference"
                  className="w-full py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCollectTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {actionLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Save Collection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSTANT COLLECTION RECEIPT MODAL */}
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
