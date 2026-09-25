"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Lock,
  Globe,
  CreditCard,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface SettingsPayload {
  name: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  gstin: string;
  pan: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upiId: string;
  pinCode: string;
}

export default function SettingsPage() {
  const { lang, setLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"business" | "banking" | "security" | "preferences">("business");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Current session user
  const [currentUser, setCurrentUser] = useState<{
    userId: string;
    username: string;
    role: string;
    name: string;
    partnerId?: string | null;
  } | null>(null);

  // Partner self password change form
  const [partnerPasswordData, setPartnerPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPartnerPassword, setSavingPartnerPassword] = useState(false);

  // Business Profile Form
  const [formData, setFormData] = useState({
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    gstin: "",
    pan: "",
    bankName: "",
    accountNo: "",
    ifsc: "",
    upiId: "",
  });

  // Security Form (Admin)
  const [securityData, setSecurityData] = useState({
    username: "admin",
    pinCode: "1234",
  });

  // Admin password change form
  const [adminPasswordData, setAdminPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingAdminPassword, setSavingAdminPassword] = useState(false);
  const [adminPwdSuccessMsg, setAdminPwdSuccessMsg] = useState("");
  const [adminPwdErrorMsg, setAdminPwdErrorMsg] = useState("");



  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch current authenticated user session
      const authRes = await fetch("/api/auth/me");
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData && authData.authenticated && authData.user) {
          setCurrentUser(authData.user);
          // If non-admin (PARTNER), set tab to security and skip admin-only /api/settings
          if (authData.user.role !== "ADMIN") {
            setActiveTab("security");
            setLoading(false);
            return;
          }
        }
      }

      // 2. If ADMIN, fetch business profile and admin security
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setFormData({
            name: data.profile.name || "",
            ownerName: data.profile.ownerName || "",
            phone: data.profile.phone || "",
            email: data.profile.email || "",
            address: data.profile.address || "",
            city: data.profile.city || "",
            gstin: data.profile.gstin || "",
            pan: data.profile.pan || "",
            bankName: data.profile.bankName || "",
            accountNo: data.profile.accountNo || "",
            ifsc: data.profile.ifsc || "",
            upiId: data.profile.upiId || "",
          });
        }
        if (data.admin) {
          setSecurityData((prev) => ({
            ...prev,
            username: data.admin.username || "admin",
            pinCode: data.admin.pinCode || "1234",
          }));
        }
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handlePartnerPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPartnerPassword(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (
      !partnerPasswordData.currentPassword.trim() ||
      !partnerPasswordData.newPassword.trim() ||
      !partnerPasswordData.confirmPassword.trim()
    ) {
      setErrorMsg(
        lang === "ta"
          ? "அனைத்து கடவுச்சொல் புலங்களையும் நிரப்பவும்."
          : "Current password, new password, and confirmation are required."
      );
      setSavingPartnerPassword(false);
      return;
    }

    if (partnerPasswordData.newPassword !== partnerPasswordData.confirmPassword) {
      setErrorMsg(
        lang === "ta"
          ? "புதிய கடவுச்சொற்கள் பொருந்தவில்லை."
          : "New password and confirm password do not match."
      );
      setSavingPartnerPassword(false);
      return;
    }

    if (partnerPasswordData.newPassword.length < 6) {
      setErrorMsg(
        lang === "ta"
          ? "புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துக்களாக இருக்க வேண்டும்."
          : "New password must be at least 6 characters long."
      );
      setSavingPartnerPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          currentPassword: partnerPasswordData.currentPassword,
          newPassword: partnerPasswordData.newPassword,
          confirmPassword: partnerPasswordData.confirmPassword,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json") || res.status === 404) {
        setErrorMsg(
          lang === "ta"
            ? "சர்வர் தவறான பதிலை அளித்துள்ளது (404/HTML). சர்வர் இணைப்பை சரிபார்க்கவும்."
            : "Server returned an unexpected response (404/HTML). Please verify server connection."
        );
        return;
      }

      if (res.status === 401) {
        setErrorMsg(
          lang === "ta"
            ? "அங்கீகாரம் காலாவதியானது. தயவுசெய்து மீண்டும் உள்நுழையவும்."
            : "Session expired or unauthorized. Please log in again."
        );
        return;
      }

      let data: { success?: boolean; error?: string; message?: string } = {};
      try {
        data = await res.json();
      } catch {
        setErrorMsg(
          lang === "ta"
            ? "சர்வரிலிருந்து தவறான பதில் வந்தது."
            : "Server returned an invalid JSON response."
        );
        return;
      }

      if (res.ok && data.success) {
        setSuccessMsg(
          lang === "ta"
            ? "கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது!"
            : "Password changed successfully!"
        );
        // Clear passwords immediately
        setPartnerPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setTimeout(() => setSuccessMsg(""), 5000);
      } else {
        const errMsg = String(data?.error || data?.message || "");
        if (
          errMsg.includes("Current password is incorrect") ||
          errMsg.includes("Incorrect current password") ||
          errMsg.includes("தவறா")
        ) {
          setErrorMsg(
            lang === "ta"
              ? "தற்போதைய கடவுச்சொல் தவறாக உள்ளது."
              : "Current password is incorrect."
          );
        } else {
          setErrorMsg(
            data?.error ||
              (lang === "ta"
                ? "கடவுச்சொல் மாற்ற முடியவில்லை."
                : "Failed to change password.")
          );
        }
      }
    } catch {
      setErrorMsg(
        lang === "ta"
          ? "பிணையப் பிழை அல்லது சர்வர் கிடைக்கவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்."
          : "Network error or server unavailable. Please try again."
      );
    } finally {
      setSavingPartnerPassword(false);
    }
  };

  const handleAdminPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAdminPassword(true);
    setAdminPwdErrorMsg("");
    setAdminPwdSuccessMsg("");

    // 1. Validate required fields
    if (
      !adminPasswordData.currentPassword.trim() ||
      !adminPasswordData.newPassword.trim() ||
      !adminPasswordData.confirmPassword.trim()
    ) {
      setAdminPwdErrorMsg(
        lang === "ta"
          ? "அனைத்து கடவுச்சொல் புலங்களையும் நிரப்பவும்."
          : "Current password, new password, and confirmation are required."
      );
      setSavingAdminPassword(false);
      return;
    }

    // 2. Validate matching passwords
    if (adminPasswordData.newPassword !== adminPasswordData.confirmPassword) {
      setAdminPwdErrorMsg(
        lang === "ta"
          ? "புதிய கடவுச்சொற்கள் பொருந்தவில்லை."
          : "New password and confirm password do not match."
      );
      setSavingAdminPassword(false);
      return;
    }

    // 3. Enforce policy (min 6 characters)
    if (adminPasswordData.newPassword.length < 6) {
      setAdminPwdErrorMsg(
        lang === "ta"
          ? "புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துக்களாக இருக்க வேண்டும்."
          : "New password must be at least 6 characters long."
      );
      setSavingAdminPassword(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          currentPassword: adminPasswordData.currentPassword,
          newPassword: adminPasswordData.newPassword,
          confirmPassword: adminPasswordData.confirmPassword,
        }),
      });

      // Check for HTML / 404 responses
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json") || res.status === 404) {
        setAdminPwdErrorMsg(
          lang === "ta"
            ? "சர்வர் தவறான பதிலை அளித்துள்ளது (404/HTML). சர்வர் இணைப்பை சரிபார்க்கவும்."
            : "Server returned an unexpected response (404/HTML). Please verify server connection."
        );
        return;
      }

      // Check for expired session / unauthorized (401)
      if (res.status === 401) {
        setAdminPwdErrorMsg(
          lang === "ta"
            ? "அங்கீகாரம் காலாவதியானது. தயவுசெய்து மீண்டும் உள்நுழையவும்."
            : "Session expired or unauthorized. Please log in again."
        );
        return;
      }

      let data: { success?: boolean; error?: string; message?: string } = {};
      try {
        data = await res.json();
      } catch {
        setAdminPwdErrorMsg(
          lang === "ta"
            ? "சர்வரிலிருந்து தவறான பதில் வந்தது."
            : "Server returned an invalid JSON response."
        );
        return;
      }

      if (res.ok && data.success) {
        setAdminPwdSuccessMsg(
          lang === "ta"
            ? "கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது!"
            : "Password changed successfully!"
        );
        // Clear all password fields immediately
        setAdminPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        // Re-authenticate / refresh current user session in memory
        try {
          const authRes = await fetch("/api/auth/me");
          if (authRes.ok) {
            const authData = await authRes.json();
            if (authData?.user) setCurrentUser(authData.user);
          }
        } catch {}
        setTimeout(() => setAdminPwdSuccessMsg(""), 5000);
      } else {
        // Check for incorrect current password with exact bilingual message
        const errMsg = String(data?.error || data?.message || "");
        if (
          errMsg.includes("Current password is incorrect") ||
          errMsg.includes("Incorrect current password") ||
          errMsg.includes("தவறா")
        ) {
          setAdminPwdErrorMsg(
            lang === "ta"
              ? "தற்போதைய கடவுச்சொல் தவறாக உள்ளது."
              : "Current password is incorrect."
          );
        } else {
          setAdminPwdErrorMsg(
            data?.error ||
              (lang === "ta"
                ? "கடவுச்சொல் மாற்ற முடியவில்லை."
                : "Failed to change password.")
          );
        }
      }
    } catch {
      setAdminPwdErrorMsg(
        lang === "ta"
          ? "பிணையப் பிழை அல்லது சர்வர் கிடைக்கவில்லை. தயவுசெய்து மீண்டும் முயற்சிக்கவும்."
          : "Network error or server unavailable. Please try again."
      );
    } finally {
      setSavingAdminPassword(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (securityData.pinCode && securityData.pinCode.length !== 4) {
      setErrorMsg(lang === "ta" ? "PIN 4 இலக்கங்களாக இருக்க வேண்டும்" : "PIN must be exactly 4 digits");
      setSaving(false);
      return;
    }

    try {
      const payload: SettingsPayload = {
        ...formData,
        pinCode: securityData.pinCode,
      };

      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMsg(
          lang === "ta"
            ? "அமைப்புகள் வெற்றிகரமாக சேமிக்கப்பட்டன!"
            : "Settings saved successfully!"
        );
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to update settings");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred";
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            {currentUser?.role === "ADMIN" ? (
              <Building2 className="w-7 h-7 text-emerald-600" />
            ) : (
              <Lock className="w-7 h-7 text-emerald-600" />
            )}
            {currentUser?.role === "ADMIN"
              ? lang === "ta"
                ? "கணினி மற்றும் வணிக அமைப்புகள்"
                : "System & Business Settings"
              : lang === "ta"
              ? "சுயவிவரம் & பாதுகாப்பு அமைப்புகள்"
              : "Profile & Security Settings"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {currentUser?.role === "ADMIN"
              ? lang === "ta"
                ? "வணிக முகவரி, வங்கி விவரங்கள், பாதுகாப்பு மற்றும் தனிப்பட்ட விருப்பங்கள்"
                : "Manage business identity, bank accounts, admin authentication, and system preferences"
              : lang === "ta"
              ? "உங்கள் கணக்கு விவரங்களை சரிபார்த்து உள்நுழைவு கடவுச்சொல்லை மாற்றவும்"
              : "View your partner profile details and manage your login password securely"}
          </p>
        </div>

        {currentUser?.role === "ADMIN" && (
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving
              ? lang === "ta"
                ? "சேமிக்கிறது..."
                : "Saving..."
              : lang === "ta"
              ? "மாற்றங்களைச் சேமி"
              : "Save Changes"}
          </button>
        )}
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span className="font-medium text-sm">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-200">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto gap-2">
        {currentUser?.role === "ADMIN" ? (
          <>
            <button
              onClick={() => setActiveTab("business")}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === "business"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Building2 className="w-4 h-4" />
              {lang === "ta" ? "வணிக விவரங்கள்" : "Business Profile"}
            </button>
            <button
              onClick={() => setActiveTab("banking")}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === "banking"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              {lang === "ta" ? "வங்கி & UPI" : "Banking & UPI"}
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === "security"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Lock className="w-4 h-4" />
              {lang === "ta" ? "பாதுகாப்பு & PIN" : "Security & PIN"}
            </button>
            <button
              onClick={() => setActiveTab("preferences")}
              className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                activeTab === "preferences"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Globe className="w-4 h-4" />
              {lang === "ta" ? "விருப்பத்தேர்வுகள்" : "Preferences"}
            </button>

          </>
        ) : (
          <button
            onClick={() => setActiveTab("security")}
            className="px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold whitespace-nowrap"
          >
            <Lock className="w-4 h-4" />
            {lang === "ta" ? "சுயவிவரம் & கடவுச்சொல்" : "Profile & Security"}
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 font-medium">Loading settings...</div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8">
          {/* TAB 1: Business Profile */}
          {activeTab === "business" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {lang === "ta" ? "வணிகத்தின் பொதுவான தகவல்" : "Business General Information"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "ta"
                    ? "அனைத்து ரசீதுகள் மற்றும் அறிக்கைகளில் காட்டப்படும் தகவல்கள்"
                    : "Information appearing on receipts, loan agreements, vouchers, and statements."}
                </p>
              </div>

              {/* Company Logo Badge */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Company Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">
                    {lang === "ta" ? "நிறுவன லோகோ (Company Logo)" : "Company Logo"}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {lang === "ta"
                      ? "அனைத்து சாதனங்கள் மற்றும் ரசீதுகளில் அதிகாரப்பூர்வ லோகோ காட்டப்படுகிறது"
                      : "Official business emblem displayed across mobile devices, desktop, and receipts"}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "நிறுவனத்தின் பெயர் *" : "Company / Firm Name *"}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. VATTI BUSINESS"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "உரிமையாளர் பெயர் *" : "Owner / Proprietor Name *"}
                  </label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. K. Vattiswaran"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "தொடர்பு தொலைபேசி எண் *" : "Official Phone Number *"}
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="+91 94432 10987"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "மின்னஞ்சல் முகவரி" : "Email Address"}
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="owner@vattibusiness.com"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "அலுவலக முகவரி" : "Registered Office Address"}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Door No, Street Name, Landmark..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "நகரம் / மாவட்டம்" : "City / District"}
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Madurai / Chennai / Coimbatore"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "GSTIN (பொருந்தினால்)" : "GSTIN (If Applicable)"}
                  </label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    placeholder="33AAAAA0000A1Z5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "PAN எண்" : "PAN Card Number"}
                  </label>
                  <input
                    type="text"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    placeholder="ABCDE1234F"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Banking & UPI */}
          {activeTab === "banking" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {lang === "ta" ? "இயல்புநிலை வங்கி மற்றும் UPI கணக்கு" : "Default Settlement Bank & UPI Account"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "ta"
                    ? "கடன் வசூல் மற்றும் ரசீதுகளில் காட்டப்படும் வட்டி பிசினஸ் வங்கி விவரங்கள்"
                    : "Primary banking details printed on customer collection receipts and repayment notices."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "வங்கி பெயர்" : "Bank Name"}
                  </label>
                  <input
                    type="text"
                    value={formData.bankName}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g. State Bank of India / HDFC Bank"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "கணக்கு எண்" : "Account Number"}
                  </label>
                  <input
                    type="text"
                    value={formData.accountNo}
                    onChange={(e) => setFormData({ ...formData, accountNo: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    placeholder="e.g. 50100234567890"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "IFSC குறியீடு" : "IFSC Code"}
                  </label>
                  <input
                    type="text"
                    value={formData.ifsc}
                    onChange={(e) => setFormData({ ...formData, ifsc: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono"
                    placeholder="e.g. SBIN0001234"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "வணிக UPI ID" : "Business UPI VPA ID"}
                  </label>
                  <input
                    type="text"
                    value={formData.upiId}
                    onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none font-mono text-emerald-600 dark:text-emerald-400 font-semibold"
                    placeholder="vattibusiness@upi / 9443210987@okaxis"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Security & PIN / Partner Change Password */}
          {activeTab === "security" && (
            currentUser?.role !== "ADMIN" ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {lang === "ta" ? "பங்காளி சுயவிவரம் & பாதுகாப்பு" : "Partner Profile & Security"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === "ta"
                      ? "உங்கள் கணக்கு விவரங்களை சரிபார்த்து உள்நுழைவு கடவுச்சொல்லை மாற்றவும்."
                      : "Manage your credentials and change your login password securely."}
                  </p>
                </div>

                {/* Partner Identity Card */}
                {currentUser && (
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {lang === "ta" ? "பயனர் பெயர்" : "Username"}
                      </div>
                      <div className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {currentUser.username}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {lang === "ta" ? "பங்காளி பெயர்" : "Partner Name"}
                      </div>
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                        {currentUser.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                        {lang === "ta" ? "பொறுப்பு / பங்காளி எண்" : "Role / Partner ID"}
                      </div>
                      <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                        {currentUser.role} {currentUser.partnerId ? `(${currentUser.partnerId})` : ""}
                      </div>
                    </div>
                  </div>
                )}

                {/* Change Password Form */}
                <form onSubmit={handlePartnerPasswordChange} className="space-y-5 max-w-xl">
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">
                      {lang === "ta" ? "கடவுச்சொல் மாற்றுதல்" : "Change Password"}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      {lang === "ta"
                        ? "தற்போதைய கடவுச்சொல்லை உள்ளிட்ட பிறகு புதிய கடவுச்சொல்லை அமைக்கவும்."
                        : "Enter your current password to authenticate, then set your new password."}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      {lang === "ta" ? "தற்போதைய கடவுச்சொல் *" : "Current Password *"}
                    </label>
                    <input
                      type="password"
                      required
                      value={partnerPasswordData.currentPassword}
                      onChange={(e) =>
                        setPartnerPasswordData({ ...partnerPasswordData, currentPassword: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        {lang === "ta" ? "புதிய கடவுச்சொல் *" : "New Password *"}
                      </label>
                      <input
                        type="password"
                        required
                        value={partnerPasswordData.newPassword}
                        onChange={(e) =>
                          setPartnerPasswordData({ ...partnerPasswordData, newPassword: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Min. 6 characters"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        {lang === "ta" ? "புதிய கடவுச்சொல்லை உறுதிப்படுத்துக *" : "Confirm New Password *"}
                      </label>
                      <input
                        type="password"
                        required
                        value={partnerPasswordData.confirmPassword}
                        onChange={(e) =>
                          setPartnerPasswordData({ ...partnerPasswordData, confirmPassword: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Re-enter new password"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingPartnerPassword}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
                    >
                      <Lock className="w-4 h-4" />
                      {savingPartnerPassword
                        ? lang === "ta"
                          ? "மாற்றுகிறது..."
                          : "Updating Password..."
                        : lang === "ta"
                        ? "கடவுச்சொல்லை மாற்று"
                        : "Change Password"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-8">
                {/* 1. SEPARATE SCREEN LOCK PIN SETTING */}
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {lang === "ta" ? "விரைவுத் திரை பூட்டு PIN" : "Screen Lock PIN"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === "ta"
                      ? "டெஸ்க்டாப் விரைவுத் திரை பூட்டிற்கான 4-இலக்க PIN ஐ உள்ளமைக்கவும் (மாற்றங்களைச் சேமிக்க மேலே உள்ள பொத்தானை அழுத்தவும்)."
                      : "Configure the 4-digit PIN used for desktop instant locking. Click Save Changes above to save."}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      {lang === "ta" ? "நிர்வாகி பயனர் பெயர்" : "Administrator Username"}
                    </label>
                    <input
                      type="text"
                      value={securityData.username}
                      disabled
                      className="w-full px-3.5 py-2.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-500 cursor-not-allowed"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">Default admin account (fixed)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      {lang === "ta" ? "விரைவு பூட்டு 4-இலக்க PIN *" : "Screen Lock 4-Digit PIN *"}
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={securityData.pinCode}
                      onChange={(e) => setSecurityData((prev) => ({ ...prev, pinCode: e.target.value.replace(/\D/g, "") }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono tracking-widest text-center text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="1234"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      {lang === "ta"
                        ? "திரையை விரைவாகப் பூட்ட/திறக்கப் பயன்படுகிறது (சேமிக்க மேலே மாற்றங்களைச் சேமி அழுத்தவும்)."
                        : "Used to quickly unlock the screen with one touch (save via Save Changes above)."}
                    </span>
                  </div>
                </div>

                {/* 2. DEDICATED CHANGE ADMIN PASSWORD SECTION */}
                <div className="border-t border-slate-200 dark:border-slate-800 pt-6 space-y-5">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Lock className="w-5 h-5 text-emerald-600" />
                      {lang === "ta" ? "நிர்வாகி கடவுச்சொல் மாற்றுதல்" : "Change Admin Password"}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === "ta"
                        ? "தற்போதைய கடவுச்சொல்லை உள்ளிட்ட பிறகு புதிய கடவுச்சொல்லை அமைக்கவும்."
                        : "Enter your current password to authenticate, then set your new password."}
                    </p>
                  </div>

                  {/* Admin Password Change Messages */}
                  {adminPwdSuccessMsg && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-200">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                      <span className="font-medium text-sm">{adminPwdSuccessMsg}</span>
                    </div>
                  )}

                  {adminPwdErrorMsg && (
                    <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-200">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                      <span className="font-medium text-sm">{adminPwdErrorMsg}</span>
                    </div>
                  )}

                  {/* Change Admin Password Form */}
                  <form onSubmit={handleAdminPasswordChange} className="space-y-5 max-w-xl">

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                      {lang === "ta" ? "தற்போதைய கடவுச்சொல் *" : "Current Password *"}
                    </label>
                    <input
                      type="password"
                      required
                      value={adminPasswordData.currentPassword}
                      onChange={(e) =>
                        setAdminPasswordData({ ...adminPasswordData, currentPassword: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        {lang === "ta" ? "புதிய கடவுச்சொல் *" : "New Password *"}
                      </label>
                      <input
                        type="password"
                        required
                        value={adminPasswordData.newPassword}
                        onChange={(e) =>
                          setAdminPasswordData({ ...adminPasswordData, newPassword: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Min. 6 characters"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        {lang === "ta" ? "புதிய கடவுச்சொல்லை உறுதிப்படுத்துக *" : "Confirm New Password *"}
                      </label>
                      <input
                        type="password"
                        required
                        value={adminPasswordData.confirmPassword}
                        onChange={(e) =>
                          setAdminPasswordData({ ...adminPasswordData, confirmPassword: e.target.value })
                        }
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Re-enter new password"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingAdminPassword}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
                    >
                      <Lock className="w-4 h-4" />
                      {savingAdminPassword
                        ? lang === "ta"
                          ? "மாற்றுகிறது..."
                          : "Updating Password..."
                        : lang === "ta"
                        ? "கடவுச்சொல்லை மாற்று"
                        : "Change Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        )}

          {/* TAB 4: System & Preferences */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {lang === "ta" ? "பயனர் இடைமுகம் மற்றும் கணினி விருப்பங்கள்" : "UI & Localization Preferences"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "ta"
                    ? "மொழி, நாணயம் மற்றும் தேதி வடிவமைப்பு அமைப்புகள்"
                    : "Language, currency, and date/time standards configuration."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    {lang === "ta" ? "மொழித் தேர்வு" : "Application Language"}
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setLang("en")}
                      className={`flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        lang === "en"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      🇬🇧 English
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang("ta")}
                      className={`flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        lang === "ta"
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      🇮🇳 தமிழ் (Tamil)
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 block">
                    Changes apply instantly across all screens and reports.
                  </span>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    {lang === "ta" ? "நாணய வடிவம்" : "Currency Standards"}
                  </span>
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Indian Rupee</span>
                    <span className="text-base font-bold text-emerald-600 font-mono">₹ INR (e.g. ₹1,25,000.00)</span>
                  </div>
                  <span className="text-xs text-slate-400 block">
                    Formatted with Indian Lakhs and Crores numbering comma grouping.
                  </span>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    {lang === "ta" ? "தேதி வடிவம்" : "Date & Time Format"}
                  </span>
                  <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Indian Standard</span>
                    <span className="text-sm font-bold font-mono text-slate-800 dark:text-white">DD/MM/YYYY hh:mm AM/PM</span>
                  </div>
                  <span className="text-xs text-slate-400 block">
                    Aligned with standard Indian banking and accounting practices.
                  </span>
                </div>

                <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                    {lang === "ta" ? "கணினி பதிப்பு" : "System Build & Environment"}
                  </span>
                  <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Release:</span>
                      <span className="font-semibold font-mono">v1.0.0-PRO</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Database:</span>
                      <span className="font-semibold font-mono">SQLite Local (vatti.db)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Architecture:</span>
                      <span className="font-semibold font-mono">Offline-First Desktop App</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
