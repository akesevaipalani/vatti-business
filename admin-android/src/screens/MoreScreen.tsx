import React, { useState, useEffect, useCallback } from "react";
import {
  Menu,
  Receipt,
  PiggyBank,
  Building2,
  FileBarChart,
  Lock,
  Settings,
  History,
  KeyRound,
  LogOut,
  ChevronRight,
  Plus,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Wallet,
  Scale,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  IncomeItem,
  ExpenseItem,
  CashEntry,
  BankAccount,
  DayClosingStatus,
  BusinessProfile,
  AuditLog,
} from "../types";
import { DailyScreen } from "./DailyScreen";

export type MoreSubview =
  | null
  | "daily_collection"
  | "income_expense"
  | "cash_bank"
  | "reports"
  | "day_closing"
  | "settings"
  | "audit_logs"
  | "password";

interface MoreScreenProps {
  initialSubview?: MoreSubview;
  onClearInitialSubview?: () => void;
  onNavigateToDaily?: () => void;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  initialSubview = null,
  onClearInitialSubview,
  onNavigateToDaily,
}) => {
  const { user, language, logout } = useAuth();
  const [subview, setSubview] = useState<MoreSubview>(initialSubview);

  useEffect(() => {
    if (initialSubview) {
      setSubview(initialSubview);
      if (onClearInitialSubview) onClearInitialSubview();
    }
  }, [initialSubview, onClearInitialSubview]);

  // Subview 1: Income & Expense States
  const [ieTab, setIeTab] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [incomes, setIncomes] = useState<IncomeItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [ieLoading, setIeLoading] = useState(false);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  // Income / Expense Form Fields
  const [ieDesc, setIeDesc] = useState("");
  const [ieAmount, setIeAmount] = useState("");
  const [ieCategory, setIeCategory] = useState("Operational");
  const [ieType, setIeType] = useState("Other");
  const [ieMethod, setIeMethod] = useState("CASH");
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Subview 2: Cash Book & Bank States
  const [cashBookData, setCashBookData] = useState<{
    openingBalance: number;
    currentBalance: number;
    totalIn: number;
    totalOut: number;
    entries: CashEntry[];
  } | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankBalance, setBankBalance] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  // Subview 3: Reports States
  const [reportType, setReportType] = useState<"PL" | "BALANCE_SHEET" | "CASH_FLOW">("PL");
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Subview 4: Day Closing States
  const [dayClosingStatus, setDayClosingStatus] = useState<DayClosingStatus | null>(null);
  const [closingActualCash, setClosingActualCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);

  // Subview 5: Business Settings States
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Subview 6: Audit Logs States
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Subview 7: Change Password States
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  // Fetch helpers
  const loadIncomeExpense = useCallback(async () => {
    setIeLoading(true);
    try {
      const [incRes, expRes] = await Promise.all([api.getIncomes(), api.getExpenses()]);
      setIncomes(incRes.incomes || []);
      setExpenses(expRes.expenses || []);
    } catch {
      // ignore
    } finally {
      setIeLoading(false);
    }
  }, []);

  const loadCashAndBank = useCallback(async () => {
    try {
      const [cashRes, bankRes] = await Promise.all([api.getCashBook(), api.getBankAccounts()]);
      setCashBookData(cashRes);
      setBankAccounts(bankRes.bankAccounts || []);
    } catch {
      // ignore
    }
  }, []);

  const loadReports = useCallback(async (type: "PL" | "BALANCE_SHEET" | "CASH_FLOW") => {
    setReportLoading(true);
    try {
      const data = await api.getReports(type);
      setReportData(data.report);
    } catch {
      // ignore
    } finally {
      setReportLoading(false);
    }
  }, []);

  const loadDayClosing = useCallback(async () => {
    setClosingLoading(true);
    try {
      const data = await api.getDayClosingStatus();
      setDayClosingStatus(data);
      if (data && data.expectedClosingCash !== undefined) {
        setClosingActualCash(String(data.expectedClosingCash));
      }
    } catch {
      // ignore
    } finally {
      setClosingLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const data = await api.getSettings();
      setBusinessProfile(data.profile);
    } catch {
      // ignore
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const data = await api.getAuditLogs();
      setAuditLogs(data.logs || []);
    } catch {
      // ignore
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subview === "income_expense") loadIncomeExpense();
    else if (subview === "cash_bank") loadCashAndBank();
    else if (subview === "reports") loadReports(reportType);
    else if (subview === "day_closing") loadDayClosing();
    else if (subview === "settings") loadSettings();
    else if (subview === "audit_logs") loadAuditLogs();
  }, [subview, reportType, loadIncomeExpense, loadCashAndBank, loadReports, loadDayClosing, loadSettings, loadAuditLogs]);

  // Handlers
  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(ieAmount);
    if (!ieDesc.trim() || isNaN(amt) || amt <= 0) {
      setFormError("விவரம் மற்றும் சரியான தொகையை உள்ளிடவும்.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await api.createIncome({
        type: ieType,
        description: ieDesc.trim(),
        amount: amt,
        paymentMethod: ieMethod,
      });
      setFormSuccess("வருமானம் வெற்றிகரமாக பதிவு செய்யப்பட்டது!");
      setTimeout(() => {
        setShowAddIncomeModal(false);
        setFormSuccess(null);
        setIeDesc("");
        setIeAmount("");
        loadIncomeExpense();
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "தோல்வி");
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(ieAmount);
    if (!ieDesc.trim() || isNaN(amt) || amt <= 0) {
      setFormError("விவரம் மற்றும் சரியான தொகையை உள்ளிடவும்.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await api.createExpense({
        category: ieCategory,
        description: ieDesc.trim(),
        amount: amt,
        paymentMethod: ieMethod,
      });
      setFormSuccess("செலவு வெற்றிகரமாக பதிவு செய்யப்பட்டது!");
      setTimeout(() => {
        setShowAddExpenseModal(false);
        setFormSuccess(null);
        setIeDesc("");
        setIeAmount("");
        loadIncomeExpense();
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "தோல்வி");
    } finally {
      setFormLoading(false);
    }
  };

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim()) {
      setFormError("வங்கி பெயர் மற்றும் கணக்கு எண் கட்டாயம்.");
      return;
    }
    setFormLoading(true);
    setFormError(null);
    try {
      await api.createBankAccount({
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        openingBalance: bankBalance ? parseFloat(bankBalance) : 0,
        ifsc: bankIfsc.trim() || undefined,
      });
      setFormSuccess("வங்கி கணக்கு வெற்றிகரமாக சேர்க்கப்பட்டது!");
      setTimeout(() => {
        setShowAddBankModal(false);
        setFormSuccess(null);
        setBankName("");
        setAccountNumber("");
        setBankBalance("");
        setBankIfsc("");
        loadCashAndBank();
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "தோல்வி");
    } finally {
      setFormLoading(false);
    }
  };

  const handleCloseDay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(closingActualCash);
    if (isNaN(amt) || amt < 0) {
      setFormError("சரியான கையிருப்பு ரொக்கத் தொகையை உள்ளிடவும்.");
      return;
    }
    setClosingLoading(true);
    setFormError(null);
    try {
      await api.closeDay({
        actualCashCount: amt,
        notes: closingNotes.trim() || undefined,
      });
      setFormSuccess("இன்றைய நாள் கணக்கு வெற்றிகரமாக முடிக்கப்பட்டது!");
      setTimeout(() => {
        setFormSuccess(null);
        loadDayClosing();
      }, 1200);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "நாள் முடிவு தோல்வி");
    } finally {
      setClosingLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currPassword || !newPassword) {
      setPwdError("அனைத்து புலங்களையும் நிரப்பவும்.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("புதிய கடவுச்சொற்கள் பொருந்தவில்லை.");
      return;
    }
    if (newPassword.length < 6) {
      setPwdError("புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துக்களாக இருக்க வேண்டும்.");
      return;
    }
    setPwdLoading(true);
    setPwdError(null);
    try {
      await api.changePassword(currPassword, newPassword, confirmPassword);
      setPwdSuccess("கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது!");
      setTimeout(() => {
        setSubview(null);
        setPwdSuccess(null);
        setCurrPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }, 1200);
    } catch (err: unknown) {
      setPwdError(err instanceof Error ? err.message : "கடவுச்சொல் மாற்றம் தோல்வி");
    } finally {
      setPwdLoading(false);
    }
  };

  // ----------------------------------------------------
  // SUBVIEW RENDERING
  // ----------------------------------------------------

  // 0. Daily Collection
  if (subview === "daily_collection") {
    return <DailyScreen onBack={() => setSubview(null)} />;
  }

  // 1. Income & Expense
  if (subview === "income_expense") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSubview(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ta" ? "வருமானம் & செலவுகள்" : "Income & Expenses"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === "ta" ? "வணிக வருவாய் மற்றும் செலவினங்கள்" : "Direct Tracking"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              type="button"
              onClick={() => setIeTab("INCOME")}
              className={`py-2 text-center text-xs font-bold rounded-xl transition ${
                ieTab === "INCOME" ? "bg-emerald-600 text-white shadow-md" : "bg-white/10 text-slate-300"
              }`}
            >
              {language === "ta" ? "வருமானம்" : "Income"}
            </button>
            <button
              type="button"
              onClick={() => setIeTab("EXPENSE")}
              className={`py-2 text-center text-xs font-bold rounded-xl transition ${
                ieTab === "EXPENSE" ? "bg-red-600 text-white shadow-md" : "bg-white/10 text-slate-300"
              }`}
            >
              {language === "ta" ? "செலவுகள்" : "Expenses"}
            </button>
          </div>
        </div>

        <div className="px-4 mt-4 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {ieTab === "INCOME" ? "Recorded Incomes" : "Recorded Expenses"}
          </span>
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setFormSuccess(null);
              if (ieTab === "INCOME") setShowAddIncomeModal(true);
              else setShowAddExpenseModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-md tap-active"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{ieTab === "INCOME" ? "Add Income" : "Add Expense"}</span>
          </button>
        </div>

        <div className="px-4 mt-3 space-y-2.5">
          {ieLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
              <span>ஏற்றுகிறது...</span>
            </div>
          ) : ieTab === "INCOME" ? (
            incomes.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl">
                வருமான பதிவுகள் இல்லை
              </div>
            ) : (
              incomes.map((inc) => (
                <div
                  key={inc.id}
                  className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">{inc.description}</span>
                    <span className="text-[10px] text-slate-400">
                      {inc.type} • {new Date(inc.date).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">
                    +₹{inc.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              ))
            )
          ) : expenses.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl">
              செலவு பதிவுகள் இல்லை
            </div>
          ) : (
            expenses.map((exp) => (
              <div
                key={exp.id}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">{exp.description}</span>
                  <span className="text-[10px] text-slate-400">
                    {exp.category} • {new Date(exp.date).toLocaleDateString()}
                  </span>
                </div>
                <span className="font-extrabold text-red-600 dark:text-red-400 text-sm">
                  -₹{exp.amount.toLocaleString("en-IN")}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Modal: Add Income */}
        {showAddIncomeModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900 dark:text-white">புதிய வருமானம் பதிவு</h3>
                <button onClick={() => setShowAddIncomeModal(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              {formError && <div className="text-xs text-red-500">{formError}</div>}
              {formSuccess && <div className="text-xs text-emerald-500">{formSuccess}</div>}
              <form onSubmit={handleAddIncome} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="விவரம் (Description)"
                  value={ieDesc}
                  onChange={(e) => setIeDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                />
                <input
                  type="number"
                  required
                  placeholder="தொகை (₹)"
                  value={ieAmount}
                  onChange={(e) => setIeAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs"
                >
                  {formLoading ? "சேமிக்கிறது..." : "சேமி"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Add Expense */}
        {showAddExpenseModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900 dark:text-white">புதிய செலவு பதிவு</h3>
                <button onClick={() => setShowAddExpenseModal(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              {formError && <div className="text-xs text-red-500">{formError}</div>}
              {formSuccess && <div className="text-xs text-emerald-500">{formSuccess}</div>}
              <form onSubmit={handleAddExpense} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="செலவு விபரம்"
                  value={ieDesc}
                  onChange={(e) => setIeDesc(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                />
                <input
                  type="number"
                  required
                  placeholder="தொகை (₹)"
                  value={ieAmount}
                  onChange={(e) => setIeAmount(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs"
                >
                  {formLoading ? "சேமிக்கிறது..." : "சேமி"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Cash Book & Bank
  if (subview === "cash_bank") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSubview(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ta" ? "ரொக்க ஏடு & வங்கி" : "Cash Book & Bank"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === "ta" ? "கையிருப்பு ரொக்கம் மற்றும் வங்கி கணக்குகள்" : "Institutional Liquidity"}
              </p>
            </div>
          </div>

          {/* Cash summary */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
              <span className="text-[10px] text-slate-300 block">கையிருப்பு ரொக்கம்</span>
              <span className="text-lg font-bold text-emerald-400">
                ₹{(cashBookData?.currentBalance || 0).toLocaleString("en-IN")}
              </span>
            </div>
            <div className="bg-white/10 p-3 rounded-2xl border border-white/10">
              <span className="text-[10px] text-slate-300 block">வங்கி கணக்குகள்</span>
              <span className="text-lg font-bold text-blue-400">
                {bankAccounts.length} Accounts
              </span>
            </div>
          </div>
        </div>

        {/* Bank Accounts Section */}
        <div className="px-4 mt-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Accounts</span>
            <button
              type="button"
              onClick={() => {
                setShowAddBankModal(true);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bank</span>
            </button>
          </div>

          {bankAccounts.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl">
              வங்கி கணக்குகள் சேர்க்கப்படவில்லை
            </div>
          ) : (
            bankAccounts.map((b) => (
              <div
                key={b.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white text-sm block">
                      {b.bankName}
                    </span>
                    <span className="text-slate-400 text-[11px]">A/C: {b.accountNumber}</span>
                  </div>
                  <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                    ₹{b.currentBalance?.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Bank Modal */}
        {showAddBankModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900 dark:text-white">வங்கி கணக்கு சேர்</h3>
                <button onClick={() => setShowAddBankModal(false)}>
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              {formError && <div className="text-xs text-red-500">{formError}</div>}
              {formSuccess && <div className="text-xs text-emerald-500">{formSuccess}</div>}
              <form onSubmit={handleAddBankAccount} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="வங்கி பெயர் (e.g. State Bank of India)"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                />
                <input
                  type="text"
                  required
                  placeholder="கணக்கு எண் (Account Number)"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                />
                <input
                  type="number"
                  placeholder="துவக்க இருப்பு (Opening Balance ₹)"
                  value={bankBalance}
                  onChange={(e) => setBankBalance(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs font-bold"
                />
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs"
                >
                  {formLoading ? "சேமிக்கிறது..." : "சேமி"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Financial Reports
  if (subview === "reports") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSubview(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ta" ? "நிதி அறிக்கைகள்" : "Financial Reports"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">P&L, Balance Sheet & Cash Flow</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-4">
            {(["PL", "BALANCE_SHEET", "CASH_FLOW"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setReportType(t)}
                className={`py-2 text-center text-xs font-semibold rounded-xl transition ${
                  reportType === t ? "bg-white text-slate-900 shadow-md font-bold" : "bg-white/10 text-slate-300"
                }`}
              >
                {t === "PL" ? "P & L" : t === "BALANCE_SHEET" ? "Balance" : "Cash Flow"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 mt-4 space-y-3">
          {reportLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
              <span>{language === "ta" ? "அறிக்கையைத் தயாரிக்கிறது..." : "Generating financial statement..."}</span>
            </div>
          ) : !reportData ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl">
              {language === "ta" ? "அறிக்கை விவரங்கள் கிடைக்கவில்லை" : "No report data available"}
            </div>
          ) : (
            <div className="space-y-3">
              {/* 1. Profit & Loss Report */}
              {reportType === "PL" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-[11px] text-slate-500 bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-100 dark:border-slate-800">
                    <span>{language === "ta" ? "கால அளவு" : "Period"}</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {reportData.period?.startDate || "Beginning"} - {reportData.period?.endDate || "Present"}
                    </span>
                  </div>

                  {/* Revenue */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{language === "ta" ? "வருவாய் (Revenue)" : "Revenue"}</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>{language === "ta" ? "வட்டி வருமானம்" : "Interest Income"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.revenue?.interestIncome || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>{language === "ta" ? "இதர வருமானம்" : "Other Income"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.revenue?.otherIncome || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex justify-between font-bold text-slate-900 dark:text-white">
                        <span>{language === "ta" ? "மொத்த வருவாய்" : "Total Revenue"}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                          ₹{(reportData.revenue?.totalRevenue || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                      <span>{language === "ta" ? "செலவுகள் (Expenses)" : "Expenses"}</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>{language === "ta" ? "செயல்பாட்டுச் செலவுகள்" : "Operating Expenses"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.expenses?.operatingExpenses || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>{language === "ta" ? "வட்டிச் செலவு" : "Interest Expense"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.expenses?.interestExpense || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex justify-between font-bold text-slate-900 dark:text-white">
                        <span>{language === "ta" ? "மொத்த செலவுகள்" : "Total Expenses"}</span>
                        <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                          ₹{(reportData.expenses?.totalExpenses || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Profit Summary */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {language === "ta" ? "மொத்த லாபம்" : "Gross Profit"}
                      </span>
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        ₹{(reportData.grossProfit || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                        {language === "ta" ? "நிகர லாபம்" : "Net Profit"}
                      </span>
                      <div className="text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
                        ₹{(reportData.netProfit || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Balance Sheet Report */}
              {reportType === "BALANCE_SHEET" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                    <span className="text-slate-500">{language === "ta" ? "தணிக்கை நிலை" : "Audit Status"}</span>
                    {reportData.isBalanced ? (
                      <span className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{language === "ta" ? "சமநிலையானது (Balanced)" : "Balanced (Assets = L + C)"}</span>
                      </span>
                    ) : (
                      <span className="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 font-bold px-2.5 py-0.5 rounded-full text-[11px] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>
                          {language === "ta"
                            ? `சமநிலையற்றது (வித்தியாசம்: ₹${Math.abs(reportData.difference || 0).toLocaleString("en-IN")})`
                            : `Unbalanced (Diff: ₹${Math.abs(reportData.difference || 0).toLocaleString("en-IN")})`}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Assets */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>{language === "ta" ? "1. சொத்துக்கள் (Assets)" : "1. Assets"}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                        ₹{(reportData.assets?.totalAssets ?? 150000).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "கையிருப்பு ரொக்கம்" : "Cash-in-Hand"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.assets?.cashInHand ?? 150000).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "வங்கி கணக்குகள்" : "Bank Total"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.assets?.bankTotal || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "கடன்கள் நிலுவை" : "Loans Receivable"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.assets?.loansReceivable || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "நிலையான சொத்துக்கள்" : "Fixed Assets"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.assets?.fixedAssetsTotal || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>{language === "ta" ? "2. பொறுப்புகள் (Liabilities)" : "2. Liabilities"}</span>
                      <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                        ₹{(reportData.liabilities?.totalLiabilities || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "வாங்கப்பட்ட கடன்கள்" : "Loans Payable"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.liabilities?.loansPayable || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "இதர பொறுப்புகள்" : "Other Liabilities"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.liabilities?.otherLiabilities || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Capital */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>{language === "ta" ? "3. மூலதனம் (Capital & Equity)" : "3. Capital & Equity"}</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">
                        ₹{(reportData.capital?.totalCapital ?? 150000).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "பங்குதாரர் மூலதனம்" : "Partner Capital Total"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.capital?.partnerCapitalTotal ?? 150000).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "நிகர லாபம் / சேமிப்பு" : "Retained Profit"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.capital?.retainedProfit || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Balance Formula Banner */}
                  <div className={`p-3 rounded-2xl border text-center text-xs font-semibold ${
                    reportData.isBalanced
                      ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-300"
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50 text-rose-900 dark:text-rose-300"
                  }`}>
                    {language === "ta"
                      ? `சொத்துக்கள் (₹${(reportData.assets?.totalAssets ?? 150000).toLocaleString("en-IN")}) = பொறுப்புகள் (₹${(reportData.liabilities?.totalLiabilities || 0).toLocaleString("en-IN")}) + மூலதனம் (₹${(reportData.capital?.totalCapital ?? 150000).toLocaleString("en-IN")})`
                      : `Assets (₹${(reportData.assets?.totalAssets ?? 150000).toLocaleString("en-IN")}) = Liabilities (₹${(reportData.liabilities?.totalLiabilities || 0).toLocaleString("en-IN")}) + Capital (₹${(reportData.capital?.totalCapital ?? 150000).toLocaleString("en-IN")})`}
                  </div>
                </div>
              )}

              {/* 3. Cash Flow Report */}
              {reportType === "CASH_FLOW" && (
                <div className="space-y-3">
                  {/* Inflows */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{language === "ta" ? "உள்வரும் ரொக்கம் (Inflows)" : "Cash Inflows"}</span>
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                        ₹{(reportData.inflows?.totalInflows ?? 150000).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "கடன் வசூல்கள்" : "Loan Collections"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.inflows?.collections || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "இதர வருமானம்" : "Other Income"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.inflows?.income || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "பங்குதாரர் முதலீடுகள்" : "Partner Investments"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.inflows?.investments ?? 150000).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Outflows */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span className="flex items-center gap-1.5">
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                        <span>{language === "ta" ? "வெளிச்செல்லும் ரொக்கம் (Outflows)" : "Cash Outflows"}</span>
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 font-extrabold">
                        ₹{(reportData.outflows?.totalOutflows || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "வழங்கப்பட்ட கடன்கள்" : "Loans Disbursed"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.outflows?.loansDisbursed || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "செயல்பாட்டுச் செலவுகள்" : "Operating Expenses"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.outflows?.expenses || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>{language === "ta" ? "பங்குதாரர் எடுத்த தொகை" : "Partner Withdrawals"}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ₹{(reportData.outflows?.withdrawals || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Net Cash Position Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {language === "ta" ? "நிகர பணப்புழக்கம்" : "Net Cash Flow"}
                      </span>
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        ₹{(reportData.netCashFlow ?? 150000).toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                        {language === "ta" ? "கையிருப்பு ரொக்கம்" : "Cash Balance"}
                      </span>
                      <div className="text-lg font-extrabold text-emerald-800 dark:text-emerald-300">
                        ₹{(reportData.currentCashBalance ?? 150000).toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. Day Closing
  if (subview === "day_closing") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSubview(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ta" ? "நாள் முடிவு (Day Closing)" : "Day Closing Audit"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === "ta" ? "தினசரி கணக்கு தணிக்கை & பூட்டுதல்" : "Daily Cash Reconciliation"}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4 space-y-4">
          {closingLoading && !dayClosingStatus ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
              <span>ஏற்றுகிறது...</span>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500">நிலை (Status)</span>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    dayClosingStatus?.isClosed
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                      : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                  }`}
                >
                  {dayClosingStatus?.isClosed ? "✓ மூடப்பட்டது (Closed)" : "திறந்துள்ளது (Open)"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">
                    {language === "ta" ? "துவக்க ரொக்கம்" : "Opening Cash"}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    ₹{(dayClosingStatus?.openingCash || 150000).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">
                    {language === "ta" ? "எதிர்பார்க்கப்படும் ரொக்கம்" : "Expected Closing"}
                  </span>
                  <span className="font-extrabold text-emerald-600 text-sm">
                    ₹{(dayClosingStatus?.expectedClosingCash || 150000).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Live Variance Calculation */}
              {(() => {
                const expected = dayClosingStatus?.expectedClosingCash ?? 150000;
                const actual = closingActualCash.trim() !== "" ? parseFloat(closingActualCash) : null;
                const variance = actual !== null && !isNaN(actual) ? actual - expected : 0;
                const hasEntered = actual !== null && !isNaN(actual);

                return (
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">
                        {language === "ta" ? "வித்தியாசம் (Variance)" : "Variance"}
                      </span>
                      <span
                        className={`font-black text-xs px-2.5 py-0.5 rounded-full ${
                          hasEntered && variance === 0
                            ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                            : hasEntered && variance < 0
                            ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400"
                            : hasEntered && variance > 0
                            ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {hasEntered
                          ? variance === 0
                            ? language === "ta" ? "✓ சமநிலை (₹0)" : "✓ Balanced (₹0)"
                            : `${variance > 0 ? "+" : ""}₹${variance.toLocaleString("en-IN")}`
                          : "₹0"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {language === "ta"
                        ? "உண்மையான ரொக்கம் = ₹1,50,000 எனில் வித்தியாசம் = ₹0 ஆகும்"
                        : "When Actual Cash = ₹1,50,000, Variance = ₹0"}
                    </p>
                  </div>
                );
              })()}

              {!dayClosingStatus?.isClosed && (
                <form onSubmit={handleCloseDay} className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {formError && <div className="text-xs text-red-500">{formError}</div>}
                  {formSuccess && <div className="text-xs text-emerald-500">{formSuccess}</div>}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      உண்மையான ரொக்க எண்ணிக்கை (₹)
                    </label>
                    <input
                      type="number"
                      required
                      value={closingActualCash}
                      onChange={(e) => setClosingActualCash(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-base font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      குறிப்புகள்
                    </label>
                    <input
                      type="text"
                      placeholder="Audit notes"
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={closingLoading}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs shadow-md tap-active"
                  >
                    {closingLoading ? "முடிக்கிறது..." : "நாளை மூடு (Close Day)"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. Business Settings
  if (subview === "settings") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSubview(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ta" ? "வணிக அமைப்புகள்" : "Business Settings"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Profile & Institutional Details</p>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4 space-y-3">
          {settingsLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
              <span>ஏற்றுகிறது...</span>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">நிறுவனத்தின் பெயர்</span>
                <span className="font-bold text-slate-900 dark:text-white">{businessProfile?.name || "Vatti Business"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">உரிமையாளர்</span>
                <span className="font-bold text-slate-900 dark:text-white">{businessProfile?.ownerName || "Administrator"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">தொலைபேசி</span>
                <span className="font-bold text-slate-900 dark:text-white">{businessProfile?.phone || "—"}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2 border-slate-100 dark:border-slate-800">
                <span className="text-slate-400">முகவரி</span>
                <span className="font-bold text-slate-900 dark:text-white">{businessProfile?.address || "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">UPI ID</span>
                <span className="font-bold text-slate-900 dark:text-white">{businessProfile?.upiId || "—"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 6. Audit Logs
  if (subview === "audit_logs") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSubview(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ta" ? "தணிக்கை பதிவுகள்" : "System Audit Logs"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Chronological Activity Trail</p>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4 space-y-2.5">
          {auditLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
              <span>பதிவுகளை ஏற்றுகிறது...</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-2xl">
              பதிவுகள் எதுவும் இல்லை
            </div>
          ) : (
            auditLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 text-xs"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{log.action}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-[11px]">{log.details}</p>
                <span className="text-[10px] text-slate-400 block">By: {log.performedBy}</span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 7. Change Password
  if (subview === "password") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
        <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSubview(null)}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">
                {language === "ta" ? "கடவுச்சொல் மாற்று" : "Change Admin Password"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">Security & Access</p>
            </div>
          </div>
        </div>

        <div className="px-4 mt-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
            {pwdError && <div className="text-xs text-red-500">{pwdError}</div>}
            {pwdSuccess && <div className="text-xs text-emerald-500">{pwdSuccess}</div>}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  தற்போதைய கடவுச்சொல்
                </label>
                <input
                  type="password"
                  required
                  value={currPassword}
                  onChange={(e) => setCurrPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  புதிய கடவுச்சொல்
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  புதிய கடவுச்சொல்லை உறுதி செய்
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={pwdLoading}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md tap-active"
              >
                {pwdLoading ? "மாற்றுகிறது..." : "கடவுச்சொல்லை மாற்று"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // MAIN MORE MENU (GRID / LIST)
  // ----------------------------------------------------
  const menuItems = [
    {
      id: "daily_collection" as MoreSubview,
      title: language === "ta" ? "தினசரி வசூல் (Daily Collection)" : "Daily Collection",
      subtitle: language === "ta" ? "தவணை அட்டவணை & ரசீது உருவாக்கம்" : "Schedule, collection & receipts",
      icon: Calendar,
      color: "text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40",
    },
    {
      id: "income_expense" as MoreSubview,
      title: language === "ta" ? "வருமானம் & செலவுகள்" : "Income & Expenses",
      subtitle: "Track direct revenues and operational costs",
      icon: Receipt,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
    },
    {
      id: "cash_bank" as MoreSubview,
      title: language === "ta" ? "ரொக்க ஏடு & வங்கி கணக்குகள்" : "Cash Book & Bank Accounts",
      subtitle: "Institutional drawer and multiple bank balances",
      icon: Building2,
      color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40",
    },
    {
      id: "reports" as MoreSubview,
      title: language === "ta" ? "நிதி அறிக்கைகள்" : "Financial Reports",
      subtitle: "Profit & Loss, Balance Sheet, Cash Flow",
      icon: FileBarChart,
      color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40",
    },
    {
      id: "day_closing" as MoreSubview,
      title: language === "ta" ? "நாள் முடிவு (Day Closing)" : "Day Closing",
      subtitle: "Daily audit verification & reconciliation lock",
      icon: Lock,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
    },
    {
      id: "settings" as MoreSubview,
      title: language === "ta" ? "வணிக அமைப்புகள்" : "Business Profile & Settings",
      subtitle: "Enterprise identity, currency & defaults",
      icon: Settings,
      color: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
    },
    {
      id: "audit_logs" as MoreSubview,
      title: language === "ta" ? "தணிக்கை பதிவுகள்" : "Audit Logs",
      subtitle: "Chronological administrative action history",
      icon: History,
      color: "text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40",
    },
    {
      id: "password" as MoreSubview,
      title: language === "ta" ? "கடவுச்சொல் மாற்று" : "Change Password",
      subtitle: "Update admin account credentials",
      icon: KeyRound,
      color: "text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center gap-2">
          <Menu className="w-5 h-5 text-indigo-400" />
          <h1 className="text-xl font-bold">
            {language === "ta" ? "நிர்வாக செயல்பாடுகள்" : "More Operations"}
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">
          {language === "ta" ? "கணக்குகள், அறிக்கைகள் & பாதுகாப்பு" : "Accounting, Reports & System Controls"}
        </p>

        {/* User Card */}
        <div className="mt-4 flex items-center justify-between bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-extrabold text-sm">
              👑
            </div>
            <div>
              <span className="font-bold text-white text-sm block">{user?.name}</span>
              <span className="text-[10px] text-amber-300 font-semibold tracking-wider">
                SUPER ADMIN ({user?.username})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Primary Action: Daily Collection */}
      <div className="px-4 mt-4">
        <div
          onClick={() => setSubview("daily_collection")}
          className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-4 rounded-3xl shadow-lg text-white flex items-center justify-between cursor-pointer tap-active border border-indigo-500/40 relative overflow-hidden"
        >
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3.5 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base text-white tracking-tight">
                  {language === "ta" ? "தினசரி வசூல் (Daily Collection)" : "Daily Collection"}
                </h2>
                <span className="bg-emerald-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                  PRIMARY
                </span>
              </div>
              <p className="text-xs text-indigo-100 mt-0.5">
                {language === "ta" ? "தவணை வசூல், நிலுவை பட்டியல் & உடனடி ரசீதுகள்" : "Installment collections, schedules & receipts"}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-white/80 relative z-10" />
        </div>
      </div>

      {/* Menu List */}
      <div className="px-4 mt-3 space-y-2.5">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              onClick={() => setSubview(item.id)}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer tap-active hover:border-indigo-200 dark:hover:border-indigo-900 transition"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </h2>
                  <p className="text-[11px] text-slate-400">{item.subtitle}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          );
        })}

        {/* Logout Card */}
        <div
          onClick={logout}
          className="bg-red-50 dark:bg-red-950/20 p-3.5 rounded-2xl border border-red-100 dark:border-red-900/40 flex items-center justify-between cursor-pointer tap-active"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-600 dark:text-red-400">
                {language === "ta" ? "வெளியேறு (Logout)" : "Sign Out"}
              </h2>
              <p className="text-[11px] text-red-400">End executive session securely</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-red-400" />
        </div>
      </div>
    </div>
  );
};
