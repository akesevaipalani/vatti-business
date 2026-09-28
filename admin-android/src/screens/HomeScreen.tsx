import React, { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  Wallet,
  Building2,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Coins,
  Receipt,
  Scale,
  CreditCard,
  PiggyBank,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { AdminStatsResponse } from "../types";

interface HomeScreenProps {
  onNavigateToPartners: () => void;
  onNavigateToCustomers: () => void;
  onNavigateToLoans: () => void;
  onNavigateToMore: (subview?: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToPartners,
  onNavigateToCustomers,
  onNavigateToLoans,
  onNavigateToMore,
}) => {
  const { user, language } = useAuth();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "புள்ளிவிவரங்களை ஏற்றுவதில் பிழை");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const kpis = stats?.kpis;
  const today = stats?.today;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Executive Admin Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 pt-4 pb-8 rounded-b-3xl shadow-xl border-b border-indigo-500/20">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                👑 ADMIN
              </span>
              <span className="text-slate-400 text-xs font-medium">VATTI CLOUD v1.5.1</span>
            </div>
            <h1 className="text-xl font-extrabold mt-1 text-white tracking-tight">
              {user?.name || "Admin"}
            </h1>
            <p className="text-xs text-slate-400">
              {language === "ta" ? "நிர்வாக நிதி நிலை கண்ணோட்டம்" : "Executive Financial Control Center"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition tap-active disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>

        {/* Primary Cash & Capital Strip */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>{language === "ta" ? "கையிருப்பு ரொக்கம்" : "Available Cash"}</span>
              <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              ₹{kpis ? kpis.availableCash.toLocaleString("en-IN") : "0"}
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/15 space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>{language === "ta" ? "வங்கி இருப்பு" : "Bank Balance"}</span>
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-black text-white tracking-tight">
              ₹{kpis ? kpis.bankBalance.toLocaleString("en-IN") : "0"}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-5">
        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs p-3 rounded-2xl border border-rose-200 dark:border-rose-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Today's Metrics Ribbon */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
            <span>{language === "ta" ? "இன்றைய நிலை" : "Today's Performance"}</span>
            <span className="text-[10px] text-indigo-500 font-semibold">{new Date().toLocaleDateString("en-IN")}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block">
                {language === "ta" ? "வசூல்" : "Collection"}
              </span>
              <span className="text-base font-black text-emerald-800 dark:text-emerald-300 mt-0.5 block">
                ₹{today ? today.collection.toLocaleString("en-IN") : "0"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
              <span className="text-[10px] text-rose-700 dark:text-rose-400 font-semibold block">
                {language === "ta" ? "செலவுகள்" : "Expense"}
              </span>
              <span className="text-base font-black text-rose-800 dark:text-rose-300 mt-0.5 block">
                ₹{today ? today.expense.toLocaleString("en-IN") : "0"}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-semibold block">
                {language === "ta" ? "லாபம்" : "Net Profit"}
              </span>
              <span className="text-base font-black text-indigo-800 dark:text-indigo-300 mt-0.5 block">
                ₹{today ? today.profit.toLocaleString("en-IN") : "0"}
              </span>
            </div>
          </div>
        </div>

        {/* 13 Business KPI Grid */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            {language === "ta" ? "வணிக முக்கிய குறியீடுகள் (13 KPIs)" : "Core Financial KPIs (13 KPIs)"}
          </h2>

          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. Total Capital */}
            <div
              onClick={onNavigateToPartners}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase">1. Total Capital</span>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                ₹{kpis ? kpis.totalCapital.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">
                {language === "ta" ? "பங்கு மூலதனம் + லாபம்" : "Partner Capital + Business Profit"}
              </span>
            </div>

            {/* 2. Partner Investment */}
            <div
              onClick={onNavigateToPartners}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-indigo-500 uppercase">2. Partner Investment</span>
              <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                ₹{kpis ? kpis.totalPartnerCapital.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Active partner equity</span>
            </div>

            {/* 3. Total Money Given */}
            <div
              onClick={onNavigateToLoans}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-purple-500 uppercase">3. Total Money Given</span>
              <div className="text-lg font-extrabold text-purple-600 dark:text-purple-400">
                ₹{kpis ? kpis.totalMoneyGiven.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Total loans disbursed</span>
            </div>

            {/* 4. Principal Outstanding */}
            <div
              onClick={onNavigateToLoans}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-amber-500 uppercase">4. Principal Outstanding</span>
              <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                ₹{kpis ? kpis.totalPrincipalOutstanding.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Active balance in market</span>
            </div>

            {/* 5. Total Receivable */}
            <div
              onClick={onNavigateToLoans}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase">5. Total Receivable</span>
              <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                ₹{kpis ? kpis.totalAmountReceivable.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Principal + Interest pending</span>
            </div>

            {/* 6. Total Received */}
            <div
              onClick={() => onNavigateToMore("collections")}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-emerald-500 uppercase">6. Total Received</span>
              <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{kpis ? kpis.totalMoneyReceived.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Collections to date</span>
            </div>

            {/* 7. Total Expenses */}
            <div
              onClick={() => onNavigateToMore("expenses")}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-rose-500 uppercase">7. Total Expenses</span>
              <div className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                ₹{kpis ? kpis.totalExpenses.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Operating costs</span>
            </div>

            {/* 8. Business Profit */}
            <div
              onClick={() => onNavigateToMore("reports")}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-emerald-600 uppercase">8. Business Profit</span>
              <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{kpis ? kpis.totalBusinessProfit.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Interest + Income - Expenses</span>
            </div>

            {/* 9. Partner Profit Share */}
            <div
              onClick={onNavigateToPartners}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-indigo-500 uppercase">9. Partner Profit Share</span>
              <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                ₹{kpis ? kpis.totalPartnerProfit.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Allocable partner return</span>
            </div>

            {/* 10. Business Assets */}
            <div
              onClick={() => onNavigateToMore("reports")}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-cyan-600 uppercase">10. Business Assets</span>
              <div className="text-lg font-extrabold text-cyan-600 dark:text-cyan-400">
                ₹{kpis ? kpis.totalBusinessAssets.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Cash + Bank + Market Book</span>
            </div>

            {/* 11. Total Liabilities */}
            <div
              onClick={() => onNavigateToMore("reports")}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-amber-600 uppercase">11. Total Liabilities</span>
              <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                ₹{kpis ? kpis.totalLiabilities.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Active liabilities</span>
            </div>

            {/* 12. Available Cash */}
            <div
              onClick={() => onNavigateToMore("cashbook")}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active"
            >
              <span className="text-[10px] font-bold text-emerald-600 uppercase">12. Available Cash</span>
              <div className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{kpis ? kpis.availableCash.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Main cash drawer</span>
            </div>

            {/* 13. Bank Balance */}
            <div
              onClick={() => onNavigateToMore("bank")}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-1 cursor-pointer tap-active col-span-2"
            >
              <span className="text-[10px] font-bold text-blue-500 uppercase">13. Bank Balance</span>
              <div className="text-lg font-extrabold text-blue-600 dark:text-blue-400">
                ₹{kpis ? kpis.bankBalance.toLocaleString("en-IN") : "0"}
              </div>
              <span className="text-[10px] text-slate-500">Total in institutional bank accounts</span>
            </div>
          </div>
        </div>

        {/* Quick Operations Nav Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {language === "ta" ? "விரைவு செயல்பாடுகள்" : "Admin Operations"}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onNavigateToLoans}
              className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-semibold text-xs border border-purple-100 dark:border-purple-900/50 tap-active text-left"
            >
              <div className="font-bold">➕ {language === "ta" ? "புதிய கடன்" : "Create Loan"}</div>
              <div className="text-[10px] text-purple-500 font-normal mt-0.5">Disburse with schedule</div>
            </button>
            <button
              type="button"
              onClick={onNavigateToPartners}
              className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-100 dark:border-indigo-900/50 tap-active text-left"
            >
              <div className="font-bold">👥 {language === "ta" ? "பங்குதாரர் முதலீடு" : "Partner Capital"}</div>
              <div className="text-[10px] text-indigo-500 font-normal mt-0.5">Invest & settle</div>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToMore("collections")}
              className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-semibold text-xs border border-emerald-100 dark:border-emerald-900/50 tap-active text-left"
            >
              <div className="font-bold">📅 {language === "ta" ? "தினசரி வசூல் (Daily Collection)" : "Daily Collection"}</div>
              <div className="text-[10px] text-emerald-500 font-normal mt-0.5">Collect installments</div>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToMore("closing")}
              className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 font-semibold text-xs border border-amber-100 dark:border-amber-900/50 tap-active text-left"
            >
              <div className="font-bold">🔒 {language === "ta" ? "நாள் முடிவு" : "Day Closing"}</div>
              <div className="text-[10px] text-amber-500 font-normal mt-0.5">Cash audit & close</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
