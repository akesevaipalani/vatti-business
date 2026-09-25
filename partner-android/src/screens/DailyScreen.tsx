import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Phone,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { syncManager } from "../services/sync";
import { TodayCollectionListResponse, LoanPayment } from "../types";
import { ConfirmationModal } from "../components/ConfirmationModal";
import { ReceiptModal } from "../components/ReceiptModal";

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateDMY(ymd: string): string {
  if (!ymd) return "-";
  const parts = ymd.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return ymd;
}

export const DailyScreen: React.FC = () => {
  const { language, isOnline } = useAuth();
  const [selectedDate, setSelectedDate] = useState(() => formatDateYMD(new Date()));
  const [activeTab, setActiveTab] = useState<"pending" | "collected">("pending");
  const [data, setData] = useState<TodayCollectionListResponse | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Collection modal state
  type CollectionItem = TodayCollectionListResponse["items"][0];
  const [collectingItem, setCollectingItem] = useState<CollectionItem | null>(null);
  const [collectionAmount, setCollectionAmount] = useState<number>(0);
  const [actualDate, setActualDate] = useState<string>(() => formatDateYMD(new Date()));
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [notes, setNotes] = useState<string>("");

  // Confirmation modal state
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Receipt modal state
  const [receiptPayment, setReceiptPayment] = useState<LoanPayment | null>(null);
  const [receiptCustomer, setReceiptCustomer] = useState<{ name: string; mobile: string; loanNo: string }>({
    name: "",
    mobile: "",
    loanNo: "",
  });

  const fetchCollections = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await api.getTodayCollections(selectedDate);
        setData(res);
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

  const handleOpenCollectModal = (item: CollectionItem) => {
    if (!isOnline) {
      alert(language === "ta" ? "இணைய இணைப்பு இல்லாதபோது வசூல் பதிவு செய்ய முடியாது." : "Offline: Cannot record collection without internet.");
      return;
    }
    setCollectingItem(item);
    setCollectionAmount(item.remainingAmount || item.amountToCollect);
    setActualDate(formatDateYMD(new Date()));
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
      const res = await api.recordCollection({
        installmentId: collectingItem.id,
        amount: Number(collectionAmount),
        collectionDate: actualDate,
        paymentMethod,
        notes: notes.trim() || undefined,
      });

      setShowConfirm(false);
      setCollectingItem(null);

      // Open Receipt View
      setReceiptPayment(res.payment);
      setReceiptCustomer({
        name: collectingItem.customerName,
        mobile: collectingItem.mobile,
        loanNo: collectingItem.loanNo,
      });

      // Refresh list
      fetchCollections(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "வசூல் பதிவு தோல்வியடைந்தது");
    } finally {
      setSubmitting(false);
    }
  };

  const items = data?.items || [];
  const pendingItems = items.filter((i) => i.status !== "COLLECTED");
  const collectedItems = items.filter((i) => i.status === "COLLECTED");

  const displayedList = (activeTab === "pending" ? pendingItems : collectedItems).filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.customerName.toLowerCase().includes(q) ||
      i.mobile.toLowerCase().includes(q) ||
      i.loanNo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-3 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {language === "ta" ? "தினசரி வசூல் அட்டவணை" : "Daily Collection Schedule"}
            </h1>
            <p className="text-xs text-slate-500">
              {language === "ta" ? "தேதி வாரியான திட்டமிடப்பட்ட தவணைகள்" : "Scheduled installments by due date"}
            </p>
          </div>
          <button
            onClick={() => fetchCollections(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tap-active disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Date Selector & Search */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
            />
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={language === "ta" ? "தேடுக..." : "Search customer..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Tabs: Pending vs Collected */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "pending"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{language === "ta" ? "நிலுவை" : "Pending"}</span>
            <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {pendingItems.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("collected")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === "collected"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{language === "ta" ? "வசூலிக்கப்பட்டது" : "Collected"}</span>
            <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              {collectedItems.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main List */}
      <div className="p-4 space-y-3">
        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>{language === "ta" ? "வசூல் பட்டியல் ஏற்றப்படுகிறது..." : "Loading collections..."}</p>
          </div>
        ) : displayedList.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {activeTab === "pending"
                ? language === "ta"
                  ? "இந்த தேதியில் நிலுவையில் உள்ள தவணைகள் இல்லை!"
                  : "No pending collections for this date!"
                : language === "ta"
                ? "இந்த தேதியில் வசூல் பதிவுகள் இல்லை."
                : "No collections recorded for this date."}
            </p>
          </div>
        ) : (
          displayedList.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {item.customerName}
                    </h3>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono font-medium">
                      {item.loanNo}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <a
                      href={`tel:${item.mobile}`}
                      className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{item.mobile}</span>
                    </a>
                    <span>• {item.address}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      item.status === "COLLECTED"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        : item.status === "PARTIALLY_PAID"
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : item.status === "OVERDUE"
                        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    }`}
                  >
                    {item.status}
                  </span>
                  <div className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                    ₹{item.amountToCollect.toLocaleString("en-IN")}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Inst #{item.installmentNumber}
                  </div>
                </div>
              </div>

              {/* Installment breakdown & dates */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5 flex justify-between items-center text-[11px] text-slate-600 dark:text-slate-400">
                <div>
                  <span className="text-slate-400">{language === "ta" ? "திட்டமிட்ட தேதி" : "Due Date"}: </span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {formatDateDMY(item.scheduledCollectionDate)}
                  </span>
                </div>
                {item.actualPaymentDate && (
                  <div>
                    <span className="text-slate-400">{language === "ta" ? "வசூலிக்கப்பட்ட தேதி" : "Collected"}: </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatDateDMY(item.actualPaymentDate)}
                    </span>
                  </div>
                )}
                {item.status !== "COLLECTED" && (
                  <div>
                    <span className="text-slate-400">{language === "ta" ? "மீதம்" : "Rem"}: </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      ₹{item.remainingAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {item.status !== "COLLECTED" && (
                <div className="pt-1">
                  <button
                    onClick={() => handleOpenCollectModal(item)}
                    disabled={!isOnline}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 tap-active disabled:opacity-50"
                  >
                    <span>{language === "ta" ? "வசூல் பதிவு செய்" : "Record Collection"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Collect Modal Sheet */}
      {collectingItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {language === "ta" ? "வசூல் பதிவு" : "Record Collection"}
                </h3>
                <p className="text-xs text-slate-500">
                  {collectingItem.customerName} • {collectingItem.loanNo} (Inst #{collectingItem.installmentNumber})
                </p>
              </div>
              <button
                onClick={() => setCollectingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePromptConfirmation} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {language === "ta" ? "வசூல் தொகை (₹)" : "Collection Amount (₹)"}
                </label>
                <input
                  type="number"
                  step="any"
                  value={collectionAmount}
                  onChange={(e) => setCollectionAmount(Number(e.target.value))}
                  required
                  min="1"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-3.5 text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400">
                  {language === "ta" ? "திட்டமிடப்பட்ட தவணை தொகை" : "Scheduled amount"}: ₹{collectingItem.amountToCollect}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {language === "ta" ? "உண்மையான வசூல் தேதி" : "Actual Collection Date"}
                </label>
                <input
                  type="date"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-xs font-medium text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {language === "ta" ? "செலுத்தும் முறை" : "Payment Method"}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["CASH", "UPI", "BANK"].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition tap-active border ${
                        paymentMethod === m
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  {language === "ta" ? "குறிப்புகள் (விருப்பத்தேர்வு)" : "Notes (Optional)"}
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Received in market"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isOnline}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs shadow-lg shadow-emerald-600/30 tap-active disabled:opacity-50"
                >
                  {language === "ta" ? "தொடரவும் (உறுதிப்படுத்தல்)" : "Proceed to Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {collectingItem && (
        <ConfirmationModal
          isOpen={showConfirm}
          title={language === "ta" ? "வசூலை உறுதிப்படுத்தவும்" : "Confirm Collection Payment"}
          customerName={collectingItem.customerName}
          amount={collectionAmount}
          loanNo={collectingItem.loanNo}
          installmentNo={collectingItem.installmentNumber}
          collectionDate={formatDateDMY(actualDate)}
          paymentMethod={paymentMethod}
          onConfirm={handleExecutePayment}
          onCancel={() => setShowConfirm(false)}
          isLoading={submitting}
        />
      )}

      {/* Payment Receipt Modal */}
      <ReceiptModal
        isOpen={!!receiptPayment}
        payment={receiptPayment}
        customerName={receiptCustomer.name}
        mobile={receiptCustomer.mobile}
        loanNo={receiptCustomer.loanNo}
        onClose={() => setReceiptPayment(null)}
      />
    </div>
  );
};
