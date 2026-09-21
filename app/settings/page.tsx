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
  RotateCcw,
  ShieldAlert,
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
  newPassword?: string;
}

export default function SettingsPage() {
  const { lang, setLang, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"business" | "banking" | "security" | "preferences" | "demo">("business");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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

  // Security Form
  const [securityData, setSecurityData] = useState({
    username: "admin",
    newPassword: "",
    confirmPassword: "",
    pinCode: "1234",
  });

  // Demo Reset Modal
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    if (securityData.newPassword && securityData.newPassword !== securityData.confirmPassword) {
      setErrorMsg(lang === "ta" ? "கடவுச்சொற்கள் பொருந்தவில்லை" : "New passwords do not match");
      setSaving(false);
      return;
    }

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
      if (securityData.newPassword) {
        payload.newPassword = securityData.newPassword;
      }

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
        setSecurityData((prev) => ({ ...prev, newPassword: "", confirmPassword: "" }));
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

  const handleResetDemo = async () => {
    setResettingDemo(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/settings/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESET_DEMO" }),
      });

      if (res.ok) {
        setDemoSuccess(true);
        setTimeout(() => {
          setShowDemoModal(false);
          setDemoSuccess(false);
          window.location.reload();
        }, 1500);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to reset demo data");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setErrorMsg(msg);
    } finally {
      setResettingDemo(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            {lang === "ta" ? "கணினி மற்றும் வணிக அமைப்புகள்" : "System & Business Settings"}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {lang === "ta"
              ? "வணிக முகவரி, வங்கி விவரங்கள், பாதுகாப்பு மற்றும் தனிப்பட்ட விருப்பங்கள்"
              : "Manage business identity, bank accounts, admin authentication, and system preferences"}
          </p>
        </div>

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
        <button
          onClick={() => setActiveTab("demo")}
          className={`px-4 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "demo"
              ? "border-amber-600 text-amber-600 dark:text-amber-400 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          {lang === "ta" ? "மாதிரி தரவு மீட்டமைப்பு" : "Demo Data Reset"}
        </button>
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

          {/* TAB 3: Security & PIN */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  {lang === "ta" ? "நிர்வாகி பாதுகாப்பு & விரைவுத் திரை பூட்டு" : "Admin Security & Screen Lock PIN"}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "ta"
                    ? "முக்கிய கணக்கு கடவுச்சொல் மற்றும் விரைவு 4-இலக்க PIN ஐ மாற்றவும்"
                    : "Update your login password and the 4-digit PIN used for desktop instant locking."}
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
                    onChange={(e) => setSecurityData({ ...formData, ...securityData, pinCode: e.target.value.replace(/\D/g, "") })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-mono tracking-widest text-center text-lg font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="1234"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Used to quickly unlock the screen with one touch
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "புதிய கடவுச்சொல் (மாற்ற வேண்டுமெனில்)" : "New Password (Optional)"}
                  </label>
                  <input
                    type="password"
                    value={securityData.newPassword}
                    onChange={(e) => setSecurityData({ ...securityData, newPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Leave blank to keep unchanged"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                    {lang === "ta" ? "புதிய கடவுச்சொல்லை உறுதிப்படுத்துக" : "Confirm New Password"}
                  </label>
                  <input
                    type="password"
                    value={securityData.confirmPassword}
                    onChange={(e) => setSecurityData({ ...securityData, confirmPassword: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="Re-enter new password"
                  />
                </div>
              </div>
            </div>
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

          {/* TAB 5: Demo Data Reset */}
          {activeTab === "demo" && (
            <div className="space-y-6">
              <div className="p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold text-base">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    {lang === "ta" ? "மாதிரி தரவு மீட்டமைப்பு (Demo Reset)" : "Reset to Sample Demo Dataset"}
                  </div>
                  <p className="text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed">
                    {lang === "ta"
                      ? "இது சோதனைக்காக 3 கூட்டாளிகள், 10 வாடிக்கையாளர்கள், 5 கடன்கள், ரொக்க மற்றும் வங்கி இருப்புக்களுடன் கூடிய மாதிரி வணிகத் தரவை மீண்டும் உருவாக்கும்."
                      : "This will re-seed realistic sample business records (3 Partners, 10 Customers, 5 Active Loans with schedules, cash/bank balances, income and expenses) for testing and demonstration."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all whitespace-nowrap flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {lang === "ta" ? "மீட்டமைக்கத் தொடங்கு" : "Re-Seed Demo Data"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Partners Created
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    S. Karuppasamy, M. Muthu, R. Selvaraj
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Sample Loan Types
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">
                    Flat Interest, Reducing EMI, Simple Interest
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Admin Account
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-white font-mono">
                    {securityData.username || "admin"} (PIN: {securityData.pinCode ? securityData.pinCode : "Configured"})
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Demo Data Reset */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/40 rounded-xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {lang === "ta" ? "மாதிரி தரவை மீட்டமைக்கவா?" : "Confirm Demo Data Reset?"}
                </h3>
                <p className="text-xs text-slate-500">Irreversible Action for Sample Demonstration</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === "ta"
                ? "நீங்கள் மாதிரித் தரவை மீட்டமைக்க விரும்புகிறீர்களா? இது முந்தைய தரவுகளை அழித்து புதிய மாதிரி கணக்குகளை உருவாக்கும்."
                : "Are you sure you want to reset the database to sample demo data? This will overwrite the current operational data with realistic sample business records."}
            </p>

            {demoSuccess ? (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Demo data reset complete! Reloading...
              </div>
            ) : (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={resettingDemo}
                  onClick={() => setShowDemoModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 rounded-xl transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={resettingDemo}
                  onClick={handleResetDemo}
                  className="px-5 py-2 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {resettingDemo && <RotateCcw className="w-4 h-4 animate-spin" />}
                  {resettingDemo ? "Resetting..." : lang === "ta" ? "ஆம், மீட்டமை" : "Yes, Reset Now"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
