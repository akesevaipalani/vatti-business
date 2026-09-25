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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { CollectionReceiptModal, ReceiptData } from "@/components/documents/CollectionReceiptModal";

interface TodayItem {
  id: string;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  installmentNumber: number;
  scheduledCollectionDate: string;
  amountToCollect: number;
  principal: number;
  interest: number;
  paidAmount: number;
  remainingAmount: number;
  status: "PENDING" | "COLLECTED" | "PARTIALLY_PAID" | "OVERDUE";
  actualPaymentDate?: string | null;
}

interface PendingInstallmentItem {
  id: string;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  installmentNumber: number;
  dueDate: string;
  expectedAmount: number;
  collectedAmount: number;
  pendingAmount: number;
  principal: number;
  interest: number;
  status: "PENDING" | "PARTIALLY_PAID" | "OVERDUE";
}

interface CustomerPendingSummary {
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  loans: Array<{ loanId: string; loanNo: string }>;
  loanNumbers: string;
  pendingInstallmentsCount: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
  totalPendingAmount: number;
  status: "PENDING" | "PARTIALLY_PAID" | "OVERDUE";
  installments: PendingInstallmentItem[];
}

const getTodayDateStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function CollectionManagementPage() {
  const { formatCurrency, formatDate } = useLanguage();

  // Active Main Tab: "today" | "pending"
  const [activeTab, setActiveTab] = useState<"today" | "pending">("today");

  // Selected date for Today's Collection Visit List
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateStr());

  // Today's list state
  const [todayItems, setTodayItems] = useState<TodayItem[]>([]);
  const [todayTotals, setTodayTotals] = useState({
    totalCustomers: 0,
    totalAmountToCollect: 0,
    totalCollected: 0,
    totalRemaining: 0,
  });

  // Pending list state (Customer-Wise)
  const [pendingCustomers, setPendingCustomers] = useState<CustomerPendingSummary[]>([]);
  const [pendingTotals, setPendingTotals] = useState({
    totalPendingCustomers: 0,
    totalPendingInstallments: 0,
    totalPendingAmount: 0,
  });
  const [expandedCustomerIds, setExpandedCustomerIds] = useState<Set<string>>(new Set());

  const toggleCustomerExpand = (customerId: string) => {
    setExpandedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Quick Collect Modal State
  const [collectTarget, setCollectTarget] = useState<TodayItem | PendingInstallmentItem | null>(null);
  const [collectionDate, setCollectionDate] = useState(() => getTodayDateStr());
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

  // Fetch Today's List
  const fetchTodayList = useCallback(async (dateToFetch: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/today?date=${dateToFetch}`);
      if (res.ok) {
        const data = await res.json();
        setTodayItems(data.items || []);
        setTodayTotals({
          totalCustomers: data.totalCustomers || 0,
          totalAmountToCollect: data.totalAmountToCollect || 0,
          totalCollected: data.totalCollected || 0,
          totalRemaining: data.totalRemaining || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch today's list:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Pending List
  const fetchPendingList = useCallback(async (dateToFetch: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/collections/pending?date=${dateToFetch}`);
      if (res.ok) {
        const data = await res.json();
        setPendingCustomers(data.customers || []);
        setPendingTotals({
          totalPendingCustomers: data.totalPendingCustomers || 0,
          totalPendingInstallments: data.totalPendingInstallments || 0,
          totalPendingAmount: data.totalPendingAmount || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch pending list:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial and reactive fetch
  useEffect(() => {
    if (activeTab === "today") {
      fetchTodayList(selectedDate);
    } else {
      fetchPendingList(selectedDate);
    }
  }, [activeTab, selectedDate, fetchTodayList, fetchPendingList]);

  // Open Collect Modal
  const openCollectModal = (item: TodayItem | PendingInstallmentItem) => {
    setCollectTarget(item);
    setCollectionDate(getTodayDateStr());
    setErrorMsg("");
    setSuccessMsg("");

    const dueAmount =
      "amountToCollect" in item
        ? item.remainingAmount || item.amountToCollect
        : item.pendingAmount || item.expectedAmount;

    setAmount(String(dueAmount));

    const pPart = item.principal || Math.round(dueAmount * 0.8);
    const iPart = item.interest || Math.round(dueAmount * 0.2);

    setPrincipalPortion(String(pPart));
    setInterestPortion(String(iPart));
    setPaymentMethod("CASH");
    setNotes(`Installment #${item.installmentNumber} Collection`);
  };

  const handleAmountChange = (newAmtStr: string) => {
    setAmount(newAmtStr);
    const num = Number(newAmtStr) || 0;
    const iPart = Math.round(num * 0.2);
    const pPart = num - iPart;
    setInterestPortion(String(iPart));
    setPrincipalPortion(String(pPart));
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
          installmentId: collectTarget.id,
          amount: Number(amount),
          principalPortion: Number(principalPortion),
          interestPortion: Number(interestPortion),
          collectionDate, // Actual Collection Date
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
              loanNo: collectTarget.loanNo,
              collectionDate: data.payment.date || collectionDate,
              actualPaymentDate: data.payment.date || new Date(),
              installmentNumber: collectTarget.installmentNumber,
              customer: {
                name: collectTarget.customerName,
                mobile: collectTarget.mobile,
                address: collectTarget.address,
              },
              totalAmountPaid: data.payment.amount,
              principalPaid: data.payment.principalPortion,
              interestPaid: data.payment.interestPortion,
              paymentMethod: data.payment.paymentMethod || paymentMethod,
            }
          : null;

        // Dismiss collection input form
        setCollectTarget(null);

        // Open Instant Collection Receipt Modal immediately
        setReceiptPaymentId(paymentId);
        setReceiptInitialData(initialReceipt);
        setShowReceiptModal(true);

        // Refresh underlying collection schedule table
        if (activeTab === "today") {
          fetchTodayList(selectedDate);
        } else {
          fetchPendingList(selectedDate);
        }
      } else {
        setErrorMsg(data.error || "Failed to record payment");
      }
    } catch {
      setErrorMsg("A network error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const formattedDate = formatDate(selectedDate);

    // Header
    doc.setFontSize(16);
    doc.text(businessName, 14, 15);
    doc.setFontSize(12);
    doc.text(`TODAY COLLECTION – ${formattedDate}`, 14, 22);

    doc.setFontSize(10);
    doc.text(
      `Total Customers to Visit: ${todayTotals.totalCustomers}  |  Total Amount to Collect: ₹${todayTotals.totalAmountToCollect.toLocaleString("en-IN")}  |  Collected: ₹${todayTotals.totalCollected.toLocaleString("en-IN")}`,
      14,
      28
    );

    // Table
    const tableData = todayItems.map((item, idx) => [
      idx + 1,
      item.customerName,
      item.mobile,
      item.address,
      item.loanNo,
      `₹${item.amountToCollect.toLocaleString("en-IN")}`,
      `₹${item.principal.toLocaleString("en-IN")}`,
      `₹${item.interest.toLocaleString("en-IN")}`,
      item.status,
    ]);

    autoTable(doc, {
      startY: 33,
      head: [
        [
          "#",
          "Customer Name",
          "Mobile",
          "Address",
          "Loan No",
          "Amount",
          "Principal",
          "Interest",
          "Status",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [16, 185, 129] },
      styles: { fontSize: 8 },
    });

    doc.save(`Today_Collection_${selectedDate}.pdf`);
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    // 1. Generate and download PDF first
    handleDownloadPDF();

    // 2. Prepare WhatsApp message
    const formattedDate = formatDate(selectedDate);
    let msg = `*${businessName}*\n`;
    msg += `*TODAY COLLECTION – ${formattedDate}*\n\n`;
    msg += `👥 *Total Customers to Visit:* ${todayTotals.totalCustomers}\n`;
    msg += `💰 *Total Collection Expected:* ₹${todayTotals.totalAmountToCollect.toLocaleString("en-IN")}\n`;
    msg += `✅ *Total Collected:* ₹${todayTotals.totalCollected.toLocaleString("en-IN")}\n`;
    msg += `⏳ *Remaining:* ₹${todayTotals.totalRemaining.toLocaleString("en-IN")}\n\n`;
    msg += `*--- CUSTOMER VISIT LIST ---*\n`;

    todayItems.forEach((item, idx) => {
      msg += `\n${idx + 1}. *${item.customerName}* (${item.mobile})\n`;
      msg += `   Address: ${item.address}\n`;
      msg += `   Loan: ${item.loanNo} (Inst #${item.installmentNumber})\n`;
      msg += `   Expected: ₹${item.amountToCollect.toLocaleString("en-IN")} (Prin: ₹${item.principal}, Int: ₹${item.interest})\n`;
      msg += `   Status: *${item.status}*\n`;
    });

    msg += `\n\n📄 _Note: Today's Collection PDF has been generated and saved to your device for easy attachment._`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  // Filtered Today items
  const filteredToday = todayItems.filter(
    (i) =>
      i.customerName.toLowerCase().includes(search.toLowerCase()) ||
      i.loanNo.toLowerCase().includes(search.toLowerCase()) ||
      i.mobile.includes(search) ||
      i.address.toLowerCase().includes(search.toLowerCase())
  );

  // Filtered Pending customers
  const filteredPendingCustomers = pendingCustomers.filter(
    (c) =>
      c.customerName.toLowerCase().includes(search.toLowerCase()) ||
      c.loanNumbers.toLowerCase().includes(search.toLowerCase()) ||
      c.mobile.includes(search) ||
      c.address.toLowerCase().includes(search.toLowerCase())
  );

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
              SCHEDULE ENGINE
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage daily scheduled visit lists and customer-wise pending collections
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              activeTab === "today"
                ? fetchTodayList(selectedDate)
                : fetchPendingList(selectedDate)
            }
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
            title="Refresh list"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <Link
            href="/collections"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5 transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Payment History</span>
          </Link>
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="print:hidden flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-sm ${
            activeTab === "today"
              ? "bg-emerald-600 text-white shadow-emerald-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Today&apos;s Collection Visit List</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === "today"
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600"
            }`}
          >
            {todayTotals.totalCustomers}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition shadow-sm ${
            activeTab === "pending"
              ? "bg-indigo-600 text-white shadow-indigo-600/20"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Collection List</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === "pending"
                ? "bg-indigo-700 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600"
            }`}
          >
            {pendingTotals.totalPendingCustomers} Customers ({pendingTotals.totalPendingInstallments} Inst)
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* FEATURE 1: TODAY'S COLLECTION VISIT LIST                                   */}
      {/* ========================================================================= */}
      {activeTab === "today" && (
        <div className="space-y-6">
          {/* Action & Date Selector Bar */}
          <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Visit Date:</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-1.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => setSelectedDate(getTodayDateStr())}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 hover:text-emerald-600 transition"
              >
                Today
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
                <span>Download PDF</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
              >
                <Share2 className="w-4 h-4" />
                <span>Share via WhatsApp</span>
              </button>
            </div>
          </div>

          {/* PRINT-ONLY HEADER */}
          <div className="hidden print:block p-4 border-b border-slate-300 mb-4">
            <h1 className="text-xl font-bold">{businessName}</h1>
            <h2 className="text-sm font-bold text-slate-700 mt-1">
              TODAY COLLECTION – {formatDate(selectedDate)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Total Customers to Visit: {todayTotals.totalCustomers} | Total
              Collection Expected: {formatCurrency(todayTotals.totalAmountToCollect)}
            </p>
          </div>

          {/* Title Banner & Summary Cards */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 rounded-2xl text-white shadow-lg shadow-emerald-600/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-100 bg-emerald-800/40 px-3 py-1 rounded-full">
                  FIELD COLLECTION VISIT SCHEDULE
                </span>
                <h2 className="text-2xl font-black mt-2 tracking-tight">
                  TODAY COLLECTION – {formatDate(selectedDate)}
                </h2>
                <p className="text-xs text-emerald-100 mt-1">
                  Showing customers whose scheduled collection date is exactly{" "}
                  {formatDate(selectedDate)}
                </p>
              </div>

              {/* Summary KPIs */}
              <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20">
                <div className="text-center px-3 border-r border-white/20">
                  <div className="text-[11px] font-medium text-emerald-100">
                    Customers to Visit
                  </div>
                  <div className="text-2xl font-black mt-0.5">
                    {todayTotals.totalCustomers}
                  </div>
                </div>
                <div className="text-center px-3">
                  <div className="text-[11px] font-medium text-emerald-100">
                    Total to Collect
                  </div>
                  <div className="text-2xl font-black mt-0.5 font-mono">
                    {formatCurrency(todayTotals.totalAmountToCollect)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="print:hidden relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, mobile, address, or loan number..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Today's Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Loading schedule...</p>
              </div>
            ) : filteredToday.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No customer collection scheduled for {formatDate(selectedDate)}.
              </div>
            ) : (
              <>
                {/* MOBILE TOUCH-FRIENDLY CARDS (MD:HIDDEN) */}
                <div className="md:hidden space-y-3 p-3">
                  {filteredToday.map((item) => {
                    const isCollected = item.status === "COLLECTED";
                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-xl border transition ${
                          isCollected
                            ? "bg-slate-50/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-80"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-sm"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                              {item.customerName}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono font-bold text-indigo-600">{item.loanNo}</span>
                              <span>•</span>
                              <span>Inst #{item.installmentNumber}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-mono font-black text-slate-900 dark:text-slate-100">
                              {formatCurrency(item.amountToCollect)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              P: {formatCurrency(item.principal)} | I: {formatCurrency(item.interest)}
                            </div>
                          </div>
                        </div>

                        {item.address && (
                          <div className="text-xs text-slate-500 mb-3 truncate">
                            📍 {item.address}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          {/* Quick Call */}
                          <a
                            href={`tel:${item.mobile}`}
                            className="flex items-center gap-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Call</span>
                          </a>

                          {/* Quick Action Collect */}
                          <button
                            onClick={() => openCollectModal(item)}
                            disabled={isCollected}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5 ${
                              isCollected
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 cursor-not-allowed"
                                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isCollected ? "Paid" : `Collect ${formatCurrency(item.amountToCollect)}`}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE VIEW (HIDDEN ON MOBILE) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                      <th className="py-3.5 px-4">#</th>
                      <th className="py-3.5 px-4">Customer Name</th>
                      <th className="py-3.5 px-4">Mobile</th>
                      <th className="py-3.5 px-4">Address</th>
                      <th className="py-3.5 px-4">Loan No</th>
                      <th className="py-3.5 px-4">Scheduled Date</th>
                      <th className="py-3.5 px-4 text-right">Amount to Collect</th>
                      <th className="py-3.5 px-4 text-right">Principal</th>
                      <th className="py-3.5 px-4 text-right">Interest</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="print:hidden py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredToday.map((item, idx) => {
                      const isCollected = item.status === "COLLECTED";
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                        >
                          <td className="py-3.5 px-4 text-slate-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {item.customerName}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Inst #{item.installmentNumber}
                            </div>
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
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-[150px] truncate">
                            {item.address}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-indigo-600">
                            <Link href={`/loans/${item.loanId}`} className="hover:underline">
                              {item.loanNo}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                            {formatDate(item.scheduledCollectionDate)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                            {formatCurrency(item.amountToCollect)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                            {formatCurrency(item.principal)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-amber-600">
                            {formatCurrency(item.interest)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {item.status === "COLLECTED" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Collected</span>
                              </span>
                            )}
                            {item.status === "PARTIALLY_PAID" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                <span>Partially Paid</span>
                              </span>
                            )}
                            {item.status === "OVERDUE" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Overdue</span>
                              </span>
                            )}
                            {item.status === "PENDING" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Clock className="w-3 h-3" />
                                <span>Pending</span>
                              </span>
                            )}
                          </td>
                          <td className="print:hidden py-3.5 px-4 text-center">
                            <button
                              onClick={() => openCollectModal(item)}
                              disabled={isCollected}
                              className={`py-1.5 px-3 rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1 mx-auto ${
                                isCollected
                                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isCollected ? "Paid" : "Collect"}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Table Footer Totals */}
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-bold">
                      <td colSpan={6} className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        Total Scheduled for Today:
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600 text-sm">
                        {formatCurrency(todayTotals.totalAmountToCollect)}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FEATURE 2: PENDING COLLECTION LIST                                        */}
      {/* ========================================================================= */}
      {activeTab === "pending" && (
        <div className="space-y-6">
          {/* Action & Date Selector Bar for Pending List */}
          <div className="print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Collection Date:</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="py-1.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold font-mono text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => setSelectedDate(getTodayDateStr())}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 hover:text-indigo-600 transition"
              >
                Today
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Showing uncollected customers scheduled for <span className="font-bold font-mono text-indigo-600">{formatDate(selectedDate)}</span>
            </div>
          </div>

          {/* Summary Banner */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 rounded-2xl text-white shadow-lg shadow-indigo-600/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-extrabold text-indigo-100 bg-indigo-800/40 px-3 py-1 rounded-full">
                  SCHEDULED DATE PENDING
                </span>
                <h2 className="text-2xl font-black mt-2 tracking-tight">
                  PENDING COLLECTION – {formatDate(selectedDate)}
                </h2>
                <p className="text-xs text-indigo-100 mt-1">
                  Customer-wise list of unpaid collections scheduled for {formatDate(selectedDate)}
                </p>
              </div>

              {/* Summary KPIs */}
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/20">
                <div className="text-center px-3 border-r border-white/20">
                  <div className="text-[10px] uppercase font-bold text-indigo-200">
                    Pending Customers
                  </div>
                  <div className="text-2xl font-black mt-0.5">
                    {pendingTotals.totalPendingCustomers}
                  </div>
                </div>
                <div className="text-center px-3 border-r border-white/20">
                  <div className="text-[10px] uppercase font-bold text-indigo-200">
                    Pending Installments
                  </div>
                  <div className="text-2xl font-black mt-0.5">
                    {pendingTotals.totalPendingInstallments}
                  </div>
                </div>
                <div className="text-center px-3">
                  <div className="text-[10px] uppercase font-bold text-indigo-200">
                    Total Pending Amount
                  </div>
                  <div className="text-2xl font-black mt-0.5 font-mono">
                    {formatCurrency(pendingTotals.totalPendingAmount)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pending by customer name, mobile, address, or loan number..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Pending Table (Customer-Wise) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400 mt-2">Loading customer pending list...</p>
              </div>
            ) : filteredPendingCustomers.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No pending collections found for {formatDate(selectedDate)}. All scheduled customers have paid or none scheduled!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                      <th className="py-3.5 px-3 text-center w-10"></th>
                      <th className="py-3.5 px-3 text-center w-10">#</th>
                      <th className="py-3.5 px-4">Customer Name</th>
                      <th className="py-3.5 px-4">Mobile</th>
                      <th className="py-3.5 px-4">Address</th>
                      <th className="py-3.5 px-4">Loan No</th>
                      <th className="py-3.5 px-4 text-center">Pending Installments</th>
                      <th className="py-3.5 px-4 text-right">Expected Amount</th>
                      <th className="py-3.5 px-4 text-right">Collected Amount</th>
                      <th className="py-3.5 px-4 text-right">Pending Amount</th>
                      <th className="py-3.5 px-4 text-center">Status</th>
                      <th className="py-3.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPendingCustomers.map((cust, idx) => {
                      const isExpanded = expandedCustomerIds.has(cust.customerId);
                      return (
                        <React.Fragment key={cust.customerId}>
                          <tr
                            onClick={() => toggleCustomerExpand(cust.customerId)}
                            className={`transition cursor-pointer ${
                              isExpanded
                                ? "bg-indigo-50/30 dark:bg-slate-800/60"
                                : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <td className="py-4 px-3 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCustomerExpand(cust.customerId);
                                }}
                                className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-600 transition"
                                title={isExpanded ? "Collapse installments" : "Expand installments"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="py-4 px-3 text-slate-400 font-mono text-center">
                              {idx + 1}
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                {cust.customerName}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {cust.loans.length} {cust.loans.length === 1 ? "Active Loan" : "Active Loans"}
                              </div>
                            </td>
                            <td className="py-4 px-4 font-mono">
                              <a
                                href={`tel:${cust.mobile}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span>{cust.mobile}</span>
                              </a>
                            </td>
                            <td className="py-4 px-4 text-slate-600 dark:text-slate-400 max-w-[150px] truncate">
                              {cust.address}
                            </td>
                            <td
                              className="py-4 px-4 font-mono font-bold text-indigo-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {cust.loans.map((l, lIdx) => (
                                <span key={l.loanId}>
                                  <Link href={`/loans/${l.loanId}`} className="hover:underline">
                                    {l.loanNo}
                                  </Link>
                                  {lIdx < cust.loans.length - 1 ? ", " : ""}
                                </span>
                              ))}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                {cust.pendingInstallmentsCount} Pending
                              </span>
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                              {formatCurrency(cust.totalExpectedAmount)}
                            </td>
                            <td className="py-4 px-4 text-right font-mono text-emerald-600">
                              {formatCurrency(cust.totalCollectedAmount)}
                            </td>
                            <td className="py-4 px-4 text-right font-mono font-black text-rose-600 text-sm">
                              {formatCurrency(cust.totalPendingAmount)}
                            </td>
                            <td className="py-4 px-4 text-center">
                              {cust.status === "PARTIALLY_PAID" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                  <span>Partially Paid</span>
                                </span>
                              )}
                              {cust.status === "OVERDUE" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Overdue</span>
                                </span>
                              )}
                              {cust.status === "PENDING" && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                  <Clock className="w-3 h-3" />
                                  <span>Pending</span>
                                </span>
                              )}
                            </td>
                            <td
                              className="py-4 px-4 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => toggleCustomerExpand(cust.customerId)}
                                  className="py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                                >
                                  {isExpanded ? "Hide" : "Details"}
                                </button>
                                {cust.installments.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => openCollectModal(cust.installments[0])}
                                    className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-1"
                                    title={`Collect next due installment (#${cust.installments[0].installmentNumber})`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Collect</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* EXPANDED ACCORDION: Individual Pending Installments */}
                          {isExpanded && (
                            <tr className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-indigo-100 dark:border-indigo-950">
                              <td colSpan={12} className="p-4 sm:p-5">
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                                    <div className="flex items-center gap-2">
                                      <Clock className="w-4 h-4 text-indigo-600" />
                                      <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                                        Pending Installments for {cust.customerName}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400">
                                        {cust.pendingInstallmentsCount} Unpaid
                                      </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                      Total Remaining:{" "}
                                      <span className="text-rose-600 font-mono font-black ml-1">
                                        {formatCurrency(cust.totalPendingAmount)}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                        <tr className="text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 pb-2">
                                          <th className="py-2.5 px-3">#</th>
                                          <th className="py-2.5 px-3">Loan No</th>
                                          <th className="py-2.5 px-3">Scheduled Due Date</th>
                                          <th className="py-2.5 px-3 text-right">Expected (₹)</th>
                                          <th className="py-2.5 px-3 text-right">Principal (₹)</th>
                                          <th className="py-2.5 px-3 text-right">Interest (₹)</th>
                                          <th className="py-2.5 px-3 text-right">Collected (₹)</th>
                                          <th className="py-2.5 px-3 text-right font-bold text-rose-600">
                                            Pending Amount (₹)
                                          </th>
                                          <th className="py-2.5 px-3 text-center">Status</th>
                                          <th className="py-2.5 px-3 text-center">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                        {cust.installments.map((inst) => (
                                          <tr
                                            key={inst.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                                          >
                                            <td className="py-2.5 px-3 font-mono font-bold text-slate-500">
                                              Inst #{inst.installmentNumber}
                                            </td>
                                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">
                                              <Link
                                                href={`/loans/${inst.loanId}`}
                                                className="hover:underline"
                                              >
                                                {inst.loanNo}
                                              </Link>
                                            </td>
                                            <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                                              {formatDate(inst.dueDate)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                              {formatCurrency(inst.expectedAmount)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                              {formatCurrency(inst.principal)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                                              {formatCurrency(inst.interest)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-emerald-600">
                                              {formatCurrency(inst.collectedAmount)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                                              {formatCurrency(inst.pendingAmount)}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                              {inst.status === "PARTIALLY_PAID" && (
                                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                                  Partially Paid
                                                </span>
                                              )}
                                              {inst.status === "OVERDUE" && (
                                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                                  Overdue
                                                </span>
                                              )}
                                              {inst.status === "PENDING" && (
                                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                                  Pending
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                              <button
                                                type="button"
                                                onClick={() => openCollectModal(inst)}
                                                className="py-1 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-sm transition flex items-center gap-1 mx-auto"
                                              >
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span>Collect</span>
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 font-bold">
                      <td colSpan={7} className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        Total Pending for {formatDate(selectedDate)} ({pendingTotals.totalPendingCustomers} {pendingTotals.totalPendingCustomers === 1 ? 'Customer' : 'Customers'}, {pendingTotals.totalPendingInstallments} {pendingTotals.totalPendingInstallments === 1 ? 'Installment' : 'Installments'}):
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        {formatCurrency(
                          pendingCustomers.reduce((s, c) => s + c.totalExpectedAmount, 0)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600">
                        {formatCurrency(
                          pendingCustomers.reduce((s, c) => s + c.totalCollectedAmount, 0)
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-rose-600 text-sm">
                        {formatCurrency(pendingTotals.totalPendingAmount)}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK COLLECT PAYMENT MODAL                                                */}
      {/* ========================================================================= */}
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
                <span className="text-slate-500">Scheduled Date:</span>
                <span className="font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatDate("scheduledCollectionDate" in collectTarget ? collectTarget.scheduledCollectionDate : collectTarget.dueDate)}
                </span>
              </div>

              {/* MANDATORY COLLECTION DATE */}
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1.5">
                <label className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Actual Collection Date *</span>
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
              {collectTarget && (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                    <span>Collection Component Breakdown</span>
                    <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Live Preview</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded border border-emerald-100 dark:border-emerald-900/50">
                      <span className="text-[10px] text-slate-500 font-sans block">Current Due</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(
                          "amountToCollect" in collectTarget
                            ? collectTarget.remainingAmount || collectTarget.amountToCollect
                            : collectTarget.pendingAmount || collectTarget.expectedAmount
                        )}
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
                          ("amountToCollect" in collectTarget
                            ? collectTarget.remainingAmount || collectTarget.amountToCollect
                            : collectTarget.pendingAmount || collectTarget.expectedAmount) - (Number(amount) || 0)
                        )
                      )}
                    </span>
                  </div>
                </div>
              )}

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
