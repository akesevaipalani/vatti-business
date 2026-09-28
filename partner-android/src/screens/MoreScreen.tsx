import React, { useState, useEffect, useCallback } from "react";
import {
  User,
  KeyRound,
  History,
  Languages,
  LogOut,
  ShieldCheck,
  Server,
  X,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, getServerUrl, setServerUrl, DEFAULT_PRODUCTION_URL } from "../services/api";
import { LoanPayment } from "../types";

function formatDateDMY(dateStr: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const MoreScreen: React.FC = () => {
  const { user, logout, language, setLanguage, isOnline } = useAuth();

  // Change Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Collection History State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<LoanPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyMethod, setHistoryMethod] = useState("ALL");

  // Server Settings State
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrlState] = useState(() => getServerUrl());

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.getCollectionHistory(historyMethod, historySearch.trim() || undefined);
      setHistoryList(res.payments || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyMethod, historySearch]);

  useEffect(() => {
    if (showHistoryModal) {
      fetchHistory();
    }
  }, [showHistoryModal, fetchHistory]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError(language === "ta" ? "அனைத்து புலங்களையும் நிரப்பவும்" : "All fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(language === "ta" ? "புதிய கடவுச்சொற்கள் பொருந்தவில்லை" : "New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError(language === "ta" ? "குறைந்தது 6 எழுத்துக்கள் இருக்க வேண்டும்" : "Password must be at least 6 characters");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword, confirmPassword);
      setPasswordSuccess(res.message || (language === "ta" ? "கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது!" : "Password changed successfully!"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : "கடவுச்சொல் மாற்றம் தோல்வியடைந்தது");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveServer = () => {
    if (serverUrl.trim()) {
      setServerUrl(serverUrl.trim());
      setShowServerModal(false);
      alert(language === "ta" ? "சர்வர் முகவரி சேமிக்கப்பட்டது!" : "Server URL updated successfully!");
    }
  };

  const handleResetServer = () => {
    setServerUrl(DEFAULT_PRODUCTION_URL);
    setServerUrlState(DEFAULT_PRODUCTION_URL);
    setShowServerModal(false);
    alert(language === "ta" ? "சர்வர் முகவரி மாற்றப்பட்டது!" : "Server URL reset to Railway Production default!");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-3 sticky top-0 z-30">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {language === "ta" ? "கூடுதல் விருப்பங்கள்" : "More Options"}
        </h1>
        <p className="text-xs text-slate-500">
          {language === "ta" ? "சுயவிவரம், பாதுகாப்பு மற்றும் வசூல் வரலாறு" : "Profile, security & collection history"}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* Partner Profile Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
            {user?.name ? user.name[0].toUpperCase() : "P"}
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white text-base">
              {user?.name || "Partner"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500">@{user?.username}</span>
              <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                {user?.role || "PARTNER"}
              </span>
            </div>
          </div>
        </div>

        {/* Security & RBAC Status Badge */}
        <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-3.5 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <h4 className="font-bold text-indigo-950 dark:text-indigo-200">
              {language === "ta" ? "பங்குதாரர் பாதுகாப்பு நிலை" : "Partner RBAC Authority Active"}
            </h4>
            <p className="text-slate-600 dark:text-slate-400 mt-0.5">
              {language === "ta"
                ? "மைய சேவையக அங்கீகாரம் செயலில் உள்ளது. முதலீடு, திரும்பப்பெறுதல் மற்றும் நிர்வாக மாற்றங்கள் முடக்கப்பட்டுள்ளன."
                : "Central server RBAC enforced. Partner privileges strictly bounded to collections and customer care."}
            </p>
          </div>
        </div>

        {/* Menu Options */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {/* Collection History */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition tap-active text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <History className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  {language === "ta" ? "வசூல் வரலாறு" : "Collection History"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {language === "ta" ? "கடந்த கால வசூல் மற்றும் ரசீது விபரம்" : "Payment audit log & receipts"}
                </div>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          {/* Change Password */}
          <button
            onClick={() => setShowPasswordModal(true)}
            disabled={!isOnline}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition tap-active text-left disabled:opacity-50"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  {language === "ta" ? "கடவுச்சொல் மாற்றுதல்" : "Change Password"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {language === "ta" ? "உங்கள் சொந்த கணக்கின் கடவுச்சொல்" : "Self-password change API"}
                </div>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          {/* Language Switch */}
          <div className="w-full flex items-center justify-between p-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                <Languages className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-200">
                  {language === "ta" ? "மொழி (Language)" : "Language"}
                </div>
                <div className="text-[11px] text-slate-400">
                  {language === "ta" ? "தமிழ் / English" : "English / Tamil"}
                </div>
              </div>
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-bold">
              <button
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 rounded-md transition ${
                  language === "en" ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage("ta")}
                className={`px-2.5 py-1 rounded-md transition ${
                  language === "ta" ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500"
                }`}
              >
                தமிழ்
              </button>
            </div>
          </div>

          {/* Server Config (Developer Only) */}
          {import.meta.env.DEV && (
            <button
              onClick={() => setShowServerModal(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition tap-active text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {language === "ta" ? "சேவையக இணைப்பு" : "Server Connection"}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                    {getServerUrl()}
                  </div>
                </div>
              </div>
              <span className="text-slate-400">›</span>
            </button>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="w-full py-3.5 px-4 rounded-2xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 border border-rose-200 dark:border-rose-900/40 transition tap-active"
        >
          <LogOut className="w-4 h-4" />
          <span>{language === "ta" ? "வெளியேறு (Logout)" : "Sign Out"}</span>
        </button>

        <div className="text-center text-[11px] text-slate-400 pt-2">
          Vatti Business Private Cloud • Partner Mobile v1.2.1 (Build 4)
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {language === "ta" ? "கடவுச்சொல் மாற்றுதல்" : "Change Password"}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "ta" ? "பாதுகாப்பான POST /api/auth/change-password வழிமுறை" : "Secured endpoint (Self-user only)"}
                </p>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {passwordError && (
              <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="bg-emerald-50 text-emerald-700 text-xs p-3 rounded-xl border border-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {language === "ta" ? "தற்போதைய கடவுச்சொல் *" : "Current Password *"}
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pr-9 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {language === "ta" ? "புதிய கடவுச்சொல் (குறைந்தது 6 எழுத்துக்கள்) *" : "New Password (Min 6 characters) *"}
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pr-9 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {language === "ta" ? "புதிய கடவுச்சொல் உறுதி *" : "Confirm New Password *"}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-lg shadow-indigo-600/30 tap-active disabled:opacity-50"
                >
                  {savingPassword ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    <span>{language === "ta" ? "கடவுச்சொல்லை மாற்று" : "Update Password"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collection History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {language === "ta" ? "வசூல் வரலாறு" : "Collection History"}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "ta" ? "அனைத்து பெறப்பட்ட கொடுப்பனவுகள்" : "All received payment transactions"}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter & Search */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                placeholder={language === "ta" ? "ரசீது / வாடிக்கையாளர்..." : "Search receipt / customer..."}
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-slate-200"
              />
              <select
                value={historyMethod}
                onChange={(e) => setHistoryMethod(e.target.value)}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-slate-800 dark:text-slate-200 font-semibold"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">CASH</option>
                <option value="UPI">UPI</option>
                <option value="BANK">BANK</option>
              </select>
            </div>

            {/* List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {historyLoading ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  Loading history...
                </div>
              ) : historyList.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  {language === "ta" ? "வசூல் பதிவுகள் எதுவும் கிடைக்கவில்லை" : "No collection records found"}
                </p>
              ) : (
                historyList.map((pmt) => (
                  <div
                    key={pmt.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center text-xs"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {pmt.customer?.name || "Customer"}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {pmt.paymentNo} • {formatDateDMY(pmt.date)} • {pmt.paymentMethod}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-600 text-sm">
                        ₹{pmt.amount.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {pmt.loan?.loanNo || "Loan"}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Server Configuration Modal (Developer Only) */}
      {import.meta.env.DEV && showServerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Server URL
                </h3>
                <p className="text-xs text-slate-500">
                  Railway or development backend host
                </p>
              </div>
              <button
                onClick={() => setShowServerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Connection Endpoint:</span>
                <button
                  type="button"
                  onClick={handleResetServer}
                  className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Reset to Railway Default
                </button>
              </div>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrlState(e.target.value)}
                placeholder="https://vatti-business-production.up.railway.app"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-400">
                Default: https://vatti-business-production.up.railway.app
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowServerModal(false)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs tap-active"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveServer}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 text-white font-semibold text-xs tap-active"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
