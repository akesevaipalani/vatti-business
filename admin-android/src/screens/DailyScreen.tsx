import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  AlertCircle,
  X,
  Share2,
  Receipt,
  Phone,
  ArrowLeft,
  ArrowRight,
  Filter,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { TodayCollectionItem, TodayCollectionListResponse, LoanPayment } from "../types";
import { ReceiptModal } from "../components/ReceiptModal";

interface DailyScreenProps {
  onBack?: () => void;
}

export const DailyScreen: React.FC<DailyScreenProps> = ({ onBack }) => {
  const { language } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [collectionData, setCollectionData] = useState<TodayCollectionListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING" | "COLLECTED">("ALL");
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

  const fetchCollections = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getTodayCollections(selectedDate);
      setCollectionData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "வசூல் விவரங்களை ஏற்றுவதில் பிழை");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const items = collectionData?.items || [];

  const filteredItems = items.filter((item) => {
    const matchesFilter =
      filterTab === "ALL" ||
      (filterTab === "PENDING" && item.status === "PENDING") ||
      (filterTab === "COLLECTED" && item.status === "PAID");

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      item.customerName?.toLowerCase().includes(q) ||
      item.loanNo?.toLowerCase().includes(q) ||
      item.customerMobile?.includes(q);

    return matchesFilter && matchesSearch;
  });

  const totalToCollect = collectionData?.totalAmountToCollect || 0;
  const totalCollected = collectionData?.totalCollected || 0;
  const pendingAmount = Math.max(0, totalToCollect - totalCollected);
  const collectionPercentage = totalToCollect > 0 ? Math.min(100, Math.round((totalCollected / totalToCollect) * 100)) : 0;

  const handleOpenCollectModal = (item: TodayCollectionItem) => {
    setSelectedItem(item);
    setCollectAmount(String(item.amount));
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
      const result = await api.recordCollection({
        installmentId: selectedItem.installmentId,
        amount: amt,
        collectionDate: selectedDate,
        paymentMethod,
        notes: collectNotes.trim() || undefined,
      });

      // Prepare receipt
      setReceiptPayment(result.payment);
      setReceiptCustomer({
        name: selectedItem.customerName,
        mobile: selectedItem.customerMobile,
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
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
                  {language === "ta" ? "தினசரி வசூல் பட்டியல்" : "Daily Collections"}
                </h1>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === "ta" ? "தவணை அட்டவணை & ரசீது உருவாக்கம்" : "Schedule & Instant Digital Receipts"}
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
        <div className="mt-4 flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/10">
          <Calendar className="w-4 h-4 text-indigo-300 ml-2" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent text-white text-xs font-semibold focus:outline-none w-full"
          />
        </div>

        {/* Summary Card */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
            <span className="text-[10px] text-slate-300 block">எதிர்பார்ப்பு</span>
            <span className="text-sm font-bold text-white">₹{totalToCollect.toLocaleString("en-IN")}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
            <span className="text-[10px] text-emerald-300 block">வசூல்</span>
            <span className="text-sm font-bold text-emerald-400">₹{totalCollected.toLocaleString("en-IN")}</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 text-center">
            <span className="text-[10px] text-amber-300 block">நிலுவை</span>
            <span className="text-sm font-bold text-amber-400">₹{pendingAmount.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-emerald-400 h-full transition-all duration-500 rounded-full"
            style={{ width: `${collectionPercentage}%` }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 mt-4 grid grid-cols-3 gap-2">
        {(["ALL", "PENDING", "COLLECTED"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilterTab(tab)}
            className={`py-2 text-center text-xs font-semibold rounded-xl border transition tap-active ${
              filterTab === tab
                ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800"
            }`}
          >
            {tab === "ALL"
              ? language === "ta" ? "அனைத்தும்" : "All"
              : tab === "PENDING"
              ? language === "ta" ? "நிலுவை" : "Pending"
              : language === "ta" ? "வசூலித்தவை" : "Collected"}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={language === "ta" ? "பெயர், கடன் எண் அல்லது மொபைல்..." : "Search name or loan #..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs">{language === "ta" ? "ஏற்றுகிறது..." : "Loading collections..."}</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Calendar className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {language === "ta" ? "இந்த தேதியில் தவணைகள் இல்லை" : "No collections for this date"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? "தேடலை மாற்றவும்" : "மற்றொரு தேதியைத் தேர்ந்தெடுக்கவும்"}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.installmentId}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                      {item.loanNo}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      #{item.installmentNo}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {item.customerName}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                    <Phone className="w-3 h-3" />
                    <span>{item.customerMobile}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    item.status === "PAID"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                  }`}
                >
                  {item.status === "PAID" ? "✓ வசூலானது" : "நிலுவை"}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div>
                  <span className="text-[10px] text-slate-400 block">தவணைத் தொகை</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    ₹{item.amount.toLocaleString("en-IN")}
                  </span>
                </div>

                {item.status === "PENDING" ? (
                  <button
                    type="button"
                    onClick={() => handleOpenCollectModal(item)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md tap-active"
                  >
                    {language === "ta" ? "வசூல் செய்" : "Collect"}
                  </button>
                ) : (
                  <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{language === "ta" ? "முழு வசூல்" : "Received"}</span>
                  </div>
                )}
              </div>
            </div>
          ))
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
                  {selectedItem.customerName} • {selectedItem.loanNo} (#{selectedItem.installmentNo})
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
                  <option value="UPI">UPI (Google Pay / PhonePe)</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "குறிப்புகள்" : "Notes / Remarks"}
                </label>
                <input
                  type="text"
                  placeholder="Optional reference"
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
                  {submitting ? "பதிவாகிறது..." : language === "ta" ? "ரசீது உருவாக்கு" : "Record & Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Receipt Modal */}
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
