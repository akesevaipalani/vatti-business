import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Phone,
  RefreshCw,
  AlertTriangle,
  X,
  Receipt,
  CheckCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { syncManager } from "../services/sync";
import {
  TodayCollectionItem,
  CollectedTodayPaymentItem,
  CollectionScheduleResponse,
  LoanPayment,
} from "../types";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { ReceiptModal } from "../components/ReceiptModal";
import { getTodayIST } from "../utils/date";

export const DailyScreen: React.FC = () => {
  const { language, isOnline } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => getTodayIST());
  const [activeTab, setActiveTab] = useState<"today" | "pending" | "collected">("today");
  const [scheduleData, setScheduleData] = useState<CollectionScheduleResponse | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collection modal state
  const [collectingItem, setCollectingItem] = useState<TodayCollectionItem | null>(null);
  const [collectionAmount, setCollectionAmount] = useState<number>(0);
  const [actualDate, setActualDate] = useState<string>(() => getTodayIST());
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [notes, setNotes] = useState<string>("");

  // Confirmation modal state
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Receipt modal state
  const [receiptPayment, setReceiptPayment] = useState<LoanPayment | null>(null);
  const [receiptCustomer, setReceiptCustomer] = useState<{ name: string; mobile: string; loanNo: string; address?: string }>({
    name: "",
    mobile: "",
    loanNo: "",
    address: "",
  });

  const fetchCollections = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await api.getCollectionSchedule(selectedDate);
        setScheduleData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "வசூல் பட்டியலை ஏற்றுவதில் பிழை");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    fetchCollections();

    // Listen for real-time collections from web/admin/other devices
    const unsubscribe = syncManager.subscribe((event) => {
      if (event.type === "COLLECTION_RECORDED") {
        fetchCollections(true);
      }
    });

    return () => unsubscribe();
  }, [fetchCollections]);

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

  const handleOpenCollectModal = (item: TodayCollectionItem) => {
    if (!isOnline) {
      alert(
        language === "ta"
          ? "இணைய இணைப்பு இல்லாதபோது வசூல் பதிவு செய்ய முடியாது."
          : "Offline: Cannot record collection without internet."
      );
      return;
    }
    setCollectingItem(item);
    const pendingVal =
      item.pendingAmount !== undefined ? item.pendingAmount : item.remainingAmount || item.amountToCollect;
    setCollectionAmount(pendingVal);
    setActualDate(getTodayIST());
    setPaymentMethod("CASH");
    setNotes("");
  };

  const handlePromptConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionAmount || collectionAmount <= 0) {
      alert(language === "ta" ? "செல்லுபடியாகும் தொகையை உள்ளிடவும்" : "Enter a valid collection amount");
      return;
    }
    setShowConfirm(true);
  };

  const handleExecutePayment = async () => {
    if (!collectingItem) return;
    setSubmitting(true);

    try {
      const instId = collectingItem.id || collectingItem.installmentId;
      if (!instId) throw new Error("தவணை அடையாளம் கிடைக்கவில்லை");

      const res = await api.recordCollection({
        installmentId: instId,
        amount: Number(collectionAmount),
        collectionDate: actualDate,
        paymentMethod,
        notes: notes || undefined,
      });

      setShowConfirm(false);
      setCollectingItem(null);

      // Open digital receipt modal
      const resolvedAddress = (collectingItem as any).address || (collectingItem as any).customerAddress || (collectingItem as any).city;
      setReceiptPayment({
        ...res.payment,
        previousOutstanding: (res.payment as any).previousOutstanding,
        currentOutstanding: (res.payment as any).currentOutstanding ?? (res.payment as any).remainingOutstanding,
        address: (res.payment as any).address || resolvedAddress,
      } as any);
      setReceiptCustomer({
        name: collectingItem.customerName,
        mobile: collectingItem.mobile,
        loanNo: collectingItem.loanNo,
        address: resolvedAddress,
      });

      // Refresh list
      fetchCollections(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "வசூல் பதிவு தோல்வியடைந்தது");
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewReceipt = (payment: CollectedTodayPaymentItem) => {
    const resolvedAddress = (payment as any).address || (payment as any).customerAddress || (payment as any).city;
    setReceiptPayment({
      id: payment.id,
      paymentNo: payment.paymentNo,
      loanId: payment.loanId,
      customerId: payment.customerId,
      amount: payment.amount,
      principalPortion: payment.principalPortion,
      interestPortion: payment.interestPortion,
      date: payment.date,
      paymentMethod: payment.paymentMethod as any,
      notes: payment.notes || undefined,
      previousOutstanding: (payment as any).previousOutstanding,
      currentOutstanding: (payment as any).currentOutstanding ?? (payment as any).remainingOutstanding,
      address: resolvedAddress,
      loan: (payment as any).loan,
      customer: (payment as any).customer,
    } as any);
    setReceiptCustomer({
      name: payment.customerName,
      mobile: payment.mobile,
      loanNo: payment.loanNo,
      address: resolvedAddress,
    });
  };

  // Determine items based on active tab
  const activeItems =
    activeTab === "today"
      ? scheduleData?.todayDue || []
      : activeTab === "pending"
      ? scheduleData?.todayPending || []
      : scheduleData?.collectedToday || [];

  const q = search.trim().toLowerCase();
  const displayedList = activeItems.filter((i: any) => {
    if (!q) return true;
    return (
      i.customerName?.toLowerCase().includes(q) ||
      i.mobile?.includes(q) ||
      i.loanNo?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-3 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {language === "ta" ? "தினசரி வசூல் பட்டியல்" : "Daily Collection Schedule"}
            </h1>
            <p className="text-xs text-slate-500">
              {language === "ta" ? "இன்றைய தவணைகள் & நிலுவைகள்" : "Scheduled installments & today's pending"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchCollections(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tap-active disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>

        {/* Date Selector */}
        <div className="flex items-center justify-between gap-2 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl mb-3">
          <div className="flex items-center gap-2 flex-1 pl-1">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none w-full"
            />
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(getTodayIST())}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shadow-sm"
          >
            {language === "ta" ? "இன்று" : "Today"}
          </button>
        </div>

        {/* Reconciled 3-Box Metrics Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
            <span className="text-[10px] text-slate-500 block font-medium">
              {language === "ta" ? "இன்றைய தவணை" : "Today's Due"}
            </span>
            <span className="text-xs font-black text-slate-900 dark:text-white block mt-0.5">
              ₹{summary.todayDueAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[9px] text-slate-400 block">
              {summary.todayDueCount} {language === "ta" ? "தவணைகள்" : "dues"}
            </span>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 text-center">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-medium">
              {language === "ta" ? "இன்று வசூல்" : "Collected Today"}
            </span>
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 block mt-0.5">
              ₹{summary.todayCollectedAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[9px] text-emerald-600/70 block">
              {summary.todayCollectedCount} {language === "ta" ? "ரசீதுகள்" : "payments"}
            </span>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30 text-center">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 block font-medium">
              {language === "ta" ? "இன்றைய நிலுவை" : "Today's Pending"}
            </span>
            <span className="text-xs font-black text-amber-700 dark:text-amber-400 block mt-0.5">
              ₹{summary.todayPendingAmount.toLocaleString("en-IN")}
            </span>
            <span className="text-[9px] text-amber-600/70 block">
              {summary.todayPendingCount} {language === "ta" ? "நிலுவை" : "pending"}
            </span>
          </div>
        </div>

        {/* 3 Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mt-3">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition tap-active flex items-center justify-center gap-1 ${
              activeTab === "today"
                ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{language === "ta" ? "இன்றைய வசூல்" : "Today's Due"}</span>
            <span className="text-[10px] opacity-75">({summary.todayDueCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition tap-active flex items-center justify-center gap-1 ${
              activeTab === "pending"
                ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{language === "ta" ? "இன்றைய நிலுவை" : "Pending"}</span>
            <span className="text-[10px] opacity-75">({summary.todayPendingCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("collected")}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition tap-active flex items-center justify-center gap-1 ${
              activeTab === "collected"
                ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <span>{language === "ta" ? "வசூலித்தவை" : "Collected"}</span>
            <span className="text-[10px] opacity-75">({summary.todayCollectedCount})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mt-2.5">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              language === "ta"
                ? "வாடிக்கையாளர் பெயர், கடன் எண் அல்லது மொபைல்..."
                : "Search customer name, loan # or mobile..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-xl pl-8 pr-3 py-1.5 text-xs outline-none text-slate-900 dark:text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs">{language === "ta" ? "ஏற்றுகிறது..." : "Loading collections..."}</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <CheckCircle className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              {activeTab === "today"
                ? language === "ta"
                  ? "இந்த தேதியில் தவணைகள் எதுவும் இல்லை"
                  : "No collections due for this date"
                : activeTab === "pending"
                ? language === "ta"
                  ? "இன்றைய நிலுவைகள் எதுவும் இல்லை (முழு வசூல்)"
                  : "All today's collections are fully cleared!"
                : language === "ta"
                ? "இன்று இன்னும் எந்த வசூலும் பதிவாகவில்லை"
                : "No payments recorded today"}
            </p>
          </div>
        ) : (
          displayedList.map((row: any) => {
            // Tab 3: Collected Today
            if (activeTab === "collected") {
              const payment = row as CollectedTodayPaymentItem;
              return (
                <div
                  key={payment.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-2.5"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                          {payment.paymentNo}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {payment.loanNo}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                        {payment.customerName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{payment.collectionDate}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                      ✓ {language === "ta" ? "வசூலானது" : "PAID"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-[10px] text-slate-400 block">
                        {language === "ta" ? "வசூலித்த தொகை" : "Amount Collected"}
                      </span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        ₹{payment.amount.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        (அசல்: ₹{payment.principalPortion} | வட்டி: ₹{payment.interestPortion})
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleViewReceipt(payment)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 tap-active"
                    >
                      <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{language === "ta" ? "ரசீது பார்" : "Receipt"}</span>
                    </button>
                  </div>
                </div>
              );
            }

            // Tab 1 & Tab 2: Installments
            const item = row as TodayCollectionItem;
            const isPaid = item.status === "PAID" || item.status === "COLLECTED";
            const isPartial = item.status === "PARTIAL" || item.status === "PARTIALLY_PAID";
            const pendingVal =
              item.pendingAmount !== undefined
                ? item.pendingAmount
                : item.remainingAmount || item.amountToCollect;

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                        {item.loanNo}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        #{item.installmentNumber || item.installmentNo}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                        {item.customerName}
                      </h3>
                      {item.customerCode && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.2 rounded font-mono">
                          {item.customerCode}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{item.mobile}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
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
                      : "நிலுவை"}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-400 block">
                      {activeTab === "pending"
                        ? language === "ta"
                          ? "நிலுவைத் தொகை"
                          : "Pending Amount"
                        : language === "ta"
                        ? "செலுத்த வேண்டிய தவணை"
                        : "Due Amount"}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        ₹{pendingVal.toLocaleString("en-IN")}
                      </span>
                      {isPartial && (
                        <span className="text-[10px] text-slate-400 line-through">
                          ₹{item.amountToCollect.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isPaid ? (
                    <button
                      type="button"
                      onClick={() => handleOpenCollectModal(item)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md tap-active"
                    >
                      {language === "ta" ? "வசூல் செய்" : "Collect"}
                    </button>
                  ) : (
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{language === "ta" ? "முழு வசூல்" : "Settled"}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Collect Modal */}
      {collectingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {language === "ta" ? "வசூல் பதிவு செய்தல்" : "Record Collection"}
                </h3>
                <p className="text-xs text-slate-500">
                  {collectingItem.customerName} • {collectingItem.loanNo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollectingItem(null)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePromptConfirmation} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  {language === "ta" ? "வசூலித்த தொகை (₹) *" : "Collected Amount (₹) *"}
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={collectionAmount}
                  onChange={(e) => setCollectionAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-lg font-black text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  {language === "ta" ? "பணம் செலுத்திய முறை" : "Payment Method"}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                >
                  <option value="CASH">Cash (ரொக்கம்)</option>
                  <option value="UPI">UPI (Google Pay / PhonePe)</option>
                  <option value="BANK_TRANSFER">Bank Transfer (வங்கி)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                  {language === "ta" ? "குறிப்புகள் (விருப்பத்தேர்வு)" : "Notes (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder="Reference number"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setCollectingItem(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 tap-active"
                >
                  {language === "ta" ? "ரத்து" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md tap-active"
                >
                  {language === "ta" ? "உறுதிப்படுத்து" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmationModal
          isOpen={showConfirm}
          title={language === "ta" ? "வசூல் உறுதிப்படுத்தல்" : "Confirm Collection"}
          customerName={collectingItem?.customerName || ""}
          amount={Number(collectionAmount) || 0}
          loanNo={collectingItem?.loanNo || ""}
          installmentNo={collectingItem?.installmentNumber || collectingItem?.installmentNo || 1}
          collectionDate={actualDate}
          paymentMethod={paymentMethod}
          onConfirm={handleExecutePayment}
          onCancel={() => setShowConfirm(false)}
          isLoading={submitting}
        />
      )}

      {/* Receipt Modal */}
      {receiptPayment && (
        <ReceiptModal
          isOpen={!!receiptPayment}
          onClose={() => setReceiptPayment(null)}
          payment={receiptPayment}
          customerName={receiptCustomer.name}
          mobile={receiptCustomer.mobile}
          address={receiptCustomer.address}
          loanNo={receiptCustomer.loanNo}
          previousOutstanding={(receiptPayment as any).previousOutstanding}
          currentOutstanding={(receiptPayment as any).currentOutstanding}
        />
      )}
    </div>
  );
};
