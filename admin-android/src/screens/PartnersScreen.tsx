import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  RefreshCw,
  Search,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Wallet,
  Building,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Partner } from "../types";

export const PartnersScreen: React.FC = () => {
  const { language } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [actionType, setActionType] = useState<"INVEST" | "WITHDRAW" | "SETTLE" | "DETAILS" | null>(null);

  // Form States
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // New Partner Fields
  const [newName, setNewName] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newCapital, setNewCapital] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Action Form Fields (Invest/Withdraw/Settle)
  const [actionAmount, setActionAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [actionNotes, setActionNotes] = useState("");

  const fetchPartners = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getPartners();
      setPartners(data.partners || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "பங்குதாரர் விவரங்களை ஏற்றுவதில் பிழை");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const filteredPartners = partners.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.partnerNo?.toLowerCase().includes(q) ||
      p.mobile?.includes(q)
    );
  });

  const totalCapital = partners.reduce((sum, p) => sum + (p.currentCapital || 0), 0);

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newMobile.trim() || !newCapital.trim()) {
      setFormError("பெயர், தொலைபேசி மற்றும் மூலதனம் கட்டாயமாகும்.");
      return;
    }

    const capitalNum = parseFloat(newCapital);
    if (isNaN(capitalNum) || capitalNum <= 0) {
      setFormError("சரியான மூலதனத் தொகையை உள்ளிடவும்.");
      return;
    }

    setFormLoading(true);
    setFormError(null);
    try {
      await api.createPartner({
        name: newName.trim(),
        mobile: newMobile.trim(),
        initialCapital: capitalNum,
        email: newEmail.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });

      setFormSuccess("பங்குதாரர் வெற்றிகரமாக சேர்க்கப்பட்டார்!");
      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess(null);
        setNewName("");
        setNewMobile("");
        setNewCapital("");
        setNewEmail("");
        setNewNotes("");
        fetchPartners(true);
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "சேர்ப்பதில் தோல்வி");
    } finally {
      setFormLoading(false);
    }
  };

  const handlePartnerAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartner || !actionType) return;

    const amountNum = parseFloat(actionAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("சரியான தொகையை உள்ளிடவும்.");
      return;
    }

    setFormLoading(true);
    setFormError(null);
    try {
      if (actionType === "INVEST") {
        await api.investPartner(selectedPartner.id, {
          amount: amountNum,
          paymentMethod,
          notes: actionNotes.trim() || undefined,
        });
        setFormSuccess("முதலீடு வெற்றிகரமாக பதிவு செய்யப்பட்டது!");
      } else if (actionType === "WITHDRAW") {
        await api.withdrawPartner(selectedPartner.id, {
          amount: amountNum,
          paymentMethod,
          notes: actionNotes.trim() || undefined,
        });
        setFormSuccess("மூலதனத் திரும்பப்பெறுதல் வெற்றிகரமாக முடிந்தது!");
      } else if (actionType === "SETTLE") {
        await api.settlePartner(selectedPartner.id, {
          amount: amountNum,
          paymentMethod,
          notes: actionNotes.trim() || undefined,
        });
        setFormSuccess("பங்குதாரர் தீர்வு வெற்றிகரமாக முடிந்தது!");
      }

      setTimeout(() => {
        setActionType(null);
        setSelectedPartner(null);
        setFormSuccess(null);
        setActionAmount("");
        setActionNotes("");
        fetchPartners(true);
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "பரிவர்த்தனை தோல்வியடைந்தது");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold">
                {language === "ta" ? "பங்குதாரர்கள்" : "Partner Management"}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === "ta" ? "மூலதனம், முதலீடு & தீர்வுகள்" : "Capital, Investments & Settlements"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchPartners(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition tap-active disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition tap-active shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "ta" ? "புதிய பங்குதாரர்" : "Add Partner"}</span>
            </button>
          </div>
        </div>

        {/* Capital Summary */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] text-slate-300">
              {language === "ta" ? "மொத்த மூலதனம்" : "Total Partner Capital"}
            </span>
            <div className="text-lg font-bold text-white mt-0.5">
              ₹{totalCapital.toLocaleString("en-IN")}
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
            <span className="text-[11px] text-slate-300">
              {language === "ta" ? "செயலில் உள்ள பங்குதாரர்" : "Active Partners"}
            </span>
            <div className="text-lg font-bold text-white mt-0.5">
              {partners.filter((p) => p.status === "ACTIVE").length}
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={language === "ta" ? "பங்குதாரர் பெயர், எண் அல்லது மொபைல்..." : "Search by name, ID or mobile..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Main List */}
      <div className="px-4 mt-4 space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs">{language === "ta" ? "ஏற்றுகிறது..." : "Loading partners..."}</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredPartners.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {language === "ta" ? "பங்குதாரர்கள் இல்லை" : "No partners found"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? "தேடலை மாற்றவும்" : "புதிய பங்குதாரரைச் சேர்க்க '+' பொத்தானை அழுத்தவும்"}
            </p>
          </div>
        ) : (
          filteredPartners.map((partner) => (
            <div
              key={partner.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md">
                      {partner.partnerNo || "P"}
                    </span>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      {partner.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{partner.mobile}</span>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    partner.status === "ACTIVE"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {partner.status}
                </span>
              </div>

              {/* Financial Snapshot */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                <div>
                  <span className="text-[10px] text-slate-400">
                    {language === "ta" ? "தற்போதைய மூலதனம்" : "Current Capital"}
                  </span>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    ₹{(partner.currentCapital || 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400">
                    {language === "ta" ? "பங்கு விகிதம்" : "Profit Share"}
                  </span>
                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {partner.profitSharePercentage ? `${partner.profitSharePercentage}%` : "—"}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPartner(partner);
                    setActionType("INVEST");
                    setActionAmount("");
                    setPaymentMethod("CASH");
                    setActionNotes("");
                    setFormError(null);
                    setFormSuccess(null);
                  }}
                  className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-semibold tap-active"
                >
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{language === "ta" ? "முதலீடு" : "Invest"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPartner(partner);
                    setActionType("WITHDRAW");
                    setActionAmount("");
                    setPaymentMethod("CASH");
                    setActionNotes("");
                    setFormError(null);
                    setFormSuccess(null);
                  }}
                  className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-semibold tap-active"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-500" />
                  <span>{language === "ta" ? "திரும்பப் பெற" : "Withdraw"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedPartner(partner);
                    setActionType("SETTLE");
                    setActionAmount("");
                    setPaymentMethod("CASH");
                    setActionNotes("");
                    setFormError(null);
                    setFormSuccess(null);
                  }}
                  className="flex items-center justify-center gap-1 py-2 px-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold tap-active"
                >
                  <Scale className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{language === "ta" ? "தீர்வு" : "Settle"}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Add Partner */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === "ta" ? "புதிய பங்குதாரர் சேர்" : "Add New Partner"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddPartner} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "பங்குதாரர் பெயர் *" : "Partner Name *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "தொலைபேசி எண் *" : "Mobile Number *"}
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={newMobile}
                  onChange={(e) => setNewMobile(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "தொடக்க மூலதனம் (₹) *" : "Initial Capital (₹) *"}
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 100000"
                  value={newCapital}
                  onChange={(e) => setNewCapital(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "மின்னஞ்சல்" : "Email (Optional)"}
                </label>
                <input
                  type="email"
                  placeholder="e.g. partner@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "குறிப்புகள்" : "Notes"}
                </label>
                <input
                  type="text"
                  placeholder="Optional notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 tap-active"
                >
                  {language === "ta" ? "ரத்து" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-500 tap-active disabled:opacity-50"
                >
                  {formLoading ? "சேமிக்கிறது..." : language === "ta" ? "சேமி" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invest / Withdraw / Settle */}
      {actionType && selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {actionType === "INVEST"
                    ? language === "ta" ? "கூடுதல் முதலீடு" : "Record Investment"
                    : actionType === "WITHDRAW"
                    ? language === "ta" ? "மூலதனம் திரும்பப்பெறுதல்" : "Record Withdrawal"
                    : language === "ta" ? "பங்குதாரர் தீர்வு" : "Partner Settlement"}
                </h3>
                <p className="text-xs text-slate-500">{selectedPartner.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handlePartnerAction} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "தொகை (₹) *" : "Amount (₹) *"}
                </label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={actionAmount}
                  onChange={(e) => setActionAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "செலுத்தும் முறை" : "Payment Method"}
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="CASH">Cash (ரொக்கம்)</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="ONLINE">UPI / Online</option>
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
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 tap-active"
                >
                  {language === "ta" ? "ரத்து" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-500 tap-active disabled:opacity-50"
                >
                  {formLoading ? "செயலாக்குகிறது..." : language === "ta" ? "உறுதி செய்" : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
