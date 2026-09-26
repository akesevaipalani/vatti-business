import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  AlertCircle,
  X,
  Phone,
  ArrowLeft,
  Receipt,
  User,
  DollarSign,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  TodayCollectionItem,
  CollectedTodayPaymentItem,
  CollectionScheduleResponse,
  LoanPayment,
} from "../types";
import { ReceiptModal } from "../components/ReceiptModal";
import { getTodayIST } from "../utils/date";

interface DailyScreenProps {
  onBack?: () => void;
}

export const DailyScreen: React.FC<DailyScreenProps> = ({ onBack }) => {
  const { language } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getTodayIST());
  const [scheduleData, setScheduleData] = useState<CollectionScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 3 Primary Tabs
  const [activeTab, setActiveTab] = useState<"TODAY" | "PENDING" | "COLLECTED">("TODAY");
  const [searchQuery, setSearchQuery] = useState("");

  // Payment Recording Modal
  const [selectedItem, setSelectedItem] = useState<TodayCollectionItem | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [collectNotes, setCollectNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Receipt Modal State
  const [receiptPayment, setReceiptPayment] = useState<LoanPayment | null>(null);
  const [receiptCustomer, setReceiptCustomer] = useState<{ name: string; mobile?: string } | null>(null);
  const [receiptLoanNo, setReceiptLoanNo] = useState("");

  const fetchCollections = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await api.getCollectionSchedule(selectedDate);
        setScheduleData(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "வசூல் விவரங்களை ஏற்றுவதில் பிழை");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Tab data selection
  const rawList =
    activeTab === "TODAY"
      ? scheduleData?.todayDue || []
      : activeTab === "PENDING"
      ? scheduleData?.todayPending || []
      : scheduleData?.collectedToday || [];

  const q = searchQuery.trim().toLowerCase();
  const filteredList = rawList.filter((item) => {
    if (!q) return true;
    return (
      item.customerName?.toLowerCase().includes(q) ||
      item.loanNo?.toLowerCase().includes(q) ||
      item.mobile?.includes(q)
    );
  });

  const summary = scheduleData?.summary || {
    todayDueAmount: 0,
    todayDueCount: 0,
    todayCollectedAmount: 0,
    todayCollectedCount: 0,
    todayPendingAmount: 0,
    todayPendingCount: 0,
    todayCollectedOnDue: 0,
    overdueAmount: 0,
    overdueCount: 0,
    futureCount: 0,
    reconciled: true,
  };

  const collectionPercentage =
    summary.todayDueAmount > 0
      ? Math.min(100, Math.round((summary.todayCollectedOnDue / summary.todayDueAmount) * 100))
      : 0;

  const handleOpenCollectModal = (item: TodayCollectionItem) => {
    setSelectedItem(item);
    const pendingVal = item.pendingAmount !== undefined ? item.pendingAmount : item.amount;
    setCollectAmount(String(pendingVal));
    setPaymentMethod("CASH");
    setCollectNotes("");
    setSubmitError(null);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    const amt = parseFloat(collectAmount);
    if (isNaN(amt) || amt <= 0) {
      setSubmitError("சரியான தொகையை உள்ளிடவும்.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const instId = selectedItem.installmentId || selectedItem.id;
      if (!instId) throw new Error("தவணை அடையாளம் கிடைக்கவில்லை");

      const result = await api.recordCollection({
        installmentId: instId,
        amount: amt,
        collectionDate: selectedDate,
        paymentMethod,
        notes: collectNotes.trim() || undefined,
      });

      // Prepare receipt view
      setReceiptPayment(result.payment);
      setReceiptCustomer({
        name: selectedItem.customerName,
        mobile: selectedItem.customerMobile || selectedItem.mobile,
      });
      setReceiptLoanNo(selectedItem.loanNo);

      setSelectedItem(null);
      fetchCollections(true);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "வசூல் பதிவு செய்வதில் தோல்வி");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewExistingReceipt = (item: CollectedTodayPaymentItem) => {
    setReceiptPayment({
      id: item.id,
      receiptNo: item.paymentNo,
      paymentNo: item.paymentNo,
      loanId: item.loanId,
      customerId: item.customerId,
      amount: item.amount,
      principalPortion: item.principalPortion,
      interestPortion: item.interestPortion,
      date: item.date,
      paymentMethod: item.paymentMethod as any,
      notes: item.notes || undefined,
    });
    setReceiptCustomer({
      name: item.customerName,
      mobile: item.mobile,
    });
    setReceiptLoanNo(item.loanNo);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Top Header & Reconciled Ribbon */}
      <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white tap-active"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <h1 className="text-xl font-bold">
                  {language === "ta" ? "தினசரி வசூல் மேலாண்மை" : "Collection Management"}
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === "ta" ? "இன்றைய தவணைகள் & நிலுவைகள்" : "Today's Due & Pending Collections"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchCollections(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition tap-active disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>

        {/* Date Selector */}
        <div className="mt-4 flex items-center justify-between bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10">
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-4 h-4 text-indigo-300 ml-1" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-white text-xs font-semibold focus:outline-none w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayIST())}
            className="px-2.5 py-1 rounded-lg bg-white/15 text-[11px] font-bold text-indigo-200 hover:text-white"
          >
            {language === "ta" ? "இன்று" : "Today"}
          </button>
        </div>

        {/* Reconciled 3-Card Summary Grid */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block font-medium">
              {language === "ta" ? "இன்றைய தவணை" : "Today's Due"}
            </span>
            <span className="text-sm font-bold text-white block mt-0.5">
              ₹{summary.todayDueAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[9px] text-slate-400 block mt-0.5">
              {summary.todayDueCount} {language === "ta" ? "தவணைகள்" : "dues"}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
            <span className="text-[10px] text-emerald-300 block font-medium">
              {language === "ta" ? "இன்று வசூல்" : "Collected Today"}
            </span>
            <span className="text-sm font-bold text-emerald-400 block mt-0.5">
              ₹{summary.todayCollectedAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[9px] text-emerald-300/80 block mt-0.5">
              {summary.todayCollectedCount} {language === "ta" ? "ரசீதுகள்" : "payments"}
            </span>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
            <span className="text-[10px] text-amber-300 block font-medium">
              {language === "ta" ? "இன்றைய நிலுவை" : "Today's Pending"}
            </span>
            <span className="text-sm font-bold text-amber-400 block mt-0.5">
              ₹{summary.todayPendingAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[9px] text-amber-300/80 block mt-0.5">
              {summary.todayPendingCount} {language === "ta" ? "நிலுவை" : "pending"}
            </span>
          </div>
        </div>

        {/* Collection Progress Indicator */}
        <div className="mt-3 bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-400 h-full transition-all duration-500 rounded-full"
            style={{ width: `${collectionPercentage}%` }}
          />
        </div>
      </div>

      {/* 3 Main Action Tabs */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("TODAY")}
          className={`py-2 text-center text-xs font-bold rounded-xl border transition tap-active flex flex-col items-center justify-center gap-0.5 ${
            activeTab === "TODAY"
              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
          }`}
        >
          <span>{language === "ta" ? "இன்றைய வசூல்" : "Today's Due"}</span>
          <span className="text-[10px] opacity-80">({summary.todayDueCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("PENDING")}
          className={`py-2 text-center text-xs font-bold rounded-xl border transition tap-active flex flex-col items-center justify-center gap-0.5 ${
            activeTab === "PENDING"
              ? "bg-amber-600 text-white border-amber-600 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
          }`}
        >
          <span>{language === "ta" ? "இன்றைய நிலுவை" : "Today's Pending"}</span>
          <span className="text-[10px] opacity-80">({summary.todayPendingCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("COLLECTED")}
          className={`py-2 text-center text-xs font-bold rounded-xl border transition tap-active flex flex-col items-center justify-center gap-0.5 ${
            activeTab === "COLLECTED"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
          }`}
        >
          <span>{language === "ta" ? "இன்று வசூலித்தது" : "Collected Today"}</span>
          <span className="text-[10px] opacity-80">({summary.todayCollectedCount})</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={
              language === "ta"
                ? "வாடிக்கையாளர் பெயர், கடன் எண் அல்லது மொபைல்..."
                : "Search customer name, loan # or mobile..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* List Container */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs">{language === "ta" ? "அட்டவணை ஏற்றுகிறது..." : "Loading schedule..."}</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {activeTab === "TODAY"
                ? language === "ta"
                  ? "இந்த தேதியில் தவணைகள் இல்லை"
                  : "No installments due today"
                : activeTab === "PENDING"
                ? language === "ta"
                  ? "இன்றைய நிலுவைகள் எதுவும் இல்லை (முழு வசூல்)"
                  : "All today's installments are fully collected!"
                : language === "ta"
                ? "இன்று இன்னும் எந்த வசூலும் பதிவாகவில்லை"
                : "No payments recorded today"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? "தேடலை மாற்றவும்" : "மற்றொரு தேதியைத் தேர்ந்தெடுக்கவும்"}
            </p>
          </div>
        ) : (
          filteredList.map((row: any) => {
            // Render Tab 3 (Collected Today payments)
            if (activeTab === "COLLECTED") {
              const payment = row as CollectedTodayPaymentItem;
              return (
                <div
                  key={payment.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md font-mono">
                          {payment.paymentNo}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {payment.loanNo}
                        </span>
                      </div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                        {payment.customerName}
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{payment.collectionDate}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      ✓ {language === "ta" ? "வசூலானது" : "PAID"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {language === "ta" ? "வசூலித்த தொகை" : "Amount Collected"}
                      </span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        ₹{payment.amount.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        (அசல்: ₹{payment.principalPortion} | வட்டி: ₹{payment.interestPortion})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleViewExistingReceipt(payment)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 tap-active"
                    >
                      <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{language === "ta" ? "ரசீது பார்" : "Receipt"}</span>
                    </button>
                  </div>
                </div>
              );
            }

            // Render Tab 1 & Tab 2 (Installments)
            const item = row as TodayCollectionItem;
            const isPaid = item.status === "PAID" || item.status === "COLLECTED";
            const isPartial = item.status === "PARTIAL" || item.status === "PARTIALLY_PAID";
            const pendingVal = item.pendingAmount !== undefined ? item.pendingAmount : Math.max(0, item.amount - (item.paidAmount || 0));

            return (
              <div
                key={item.installmentId || item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                        {item.loanNo}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        #{item.installmentNo || item.installmentNumber}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.customerName}
                      </h2>
                      {item.customerCode && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded font-mono">
                          {item.customerCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{item.customerMobile || item.mobile}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      isPaid
                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : isPartial
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                        : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                    }`}
                  >
                    {isPaid
                      ? "✓ வசூலானது"
                      : isPartial
                      ? `பகுதி வசூல் (₹${(item.paidAmount || 0).toLocaleString("en-IN")})`
                      : "நிலுவை (PENDING)"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      {activeTab === "PENDING"
                        ? language === "ta"
                          ? "நிலுவைத் தொகை"
                          : "Pending Amount"
                        : language === "ta"
                        ? "செலுத்த வேண்டிய தவணை"
                        : "Due Amount"}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        ₹{pendingVal.toLocaleString("en-IN")}
                      </span>
                      {isPartial && (
                        <span className="text-[11px] text-slate-400 line-through">
                          ₹{item.amount.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isPaid ? (
                    <button
                      type="button"
                      onClick={() => handleOpenCollectModal(item)}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md tap-active"
                    >
                      {language === "ta" ? "வசூல் செய்" : "Collect Payment"}
                    </button>
                  ) : (
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === "ta" ? "முழு வசூல்" : "Fully Settled"}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Collect Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === "ta" ? "வசூல் பதிவு" : "Record Collection"}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedItem.customerName} • {selectedItem.loanNo} (#{selectedItem.installmentNo || selectedItem.installmentNumber})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "வசூலித்த தொகை (₹) *" : "Collected Amount (₹) *"}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={collectAmount}
                  onChange={(e) => setCollectAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-extrabold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "செலுத்தும் முறை" : "Payment Mode"}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                >
                  <option value="CASH">Cash (ரொக்கம்)</option>
                  <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                  <option value="BANK_TRANSFER">Bank Transfer (வங்கி பரிமாற்றம்)</option>
                  <option value="CHEQUE">Cheque (காசோலை)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "குறிப்புகள்" : "Notes / Remarks"}
                </label>
                <input
                  type="text"
                  placeholder="Optional reference / UPI ref"
                  value={collectNotes}
                  onChange={(e) => setCollectNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 tap-active"
                >
                  {language === "ta" ? "ரத்து" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-1/2 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md hover:bg-emerald-500 tap-active disabled:opacity-50"
                >
                  {submitting
                    ? "பதிவாகிறது..."
                    : language === "ta"
                    ? "ரசீது உருவாக்கு"
                    : "Record & Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instant Digital Receipt Modal */}
      {receiptPayment && (
        <ReceiptModal
          isOpen={!!receiptPayment}
          onClose={() => setReceiptPayment(null)}
          payment={receiptPayment}
          customerName={receiptCustomer?.name}
          mobile={receiptCustomer?.mobile}
          loanNo={receiptLoanNo}
        />
      )}
    </div>
  );
};
