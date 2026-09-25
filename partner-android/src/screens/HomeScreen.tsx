import React, { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  Clock,
  CheckCircle,
  Users,
  FileText,
  Calendar,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { syncManager } from "../services/sync";
import { PartnerStatsResponse } from "../types";

interface HomeScreenProps {
  onNavigateToDaily: () => void;
  onNavigateToCustomers: () => void;
  onNavigateToLoans: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToDaily,
  onNavigateToCustomers,
  onNavigateToLoans,
}) => {
  const { user, language } = useAuth();
  const [data, setData] = useState<PartnerStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.getPartnerStats();
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "புள்ளிவிவரங்களை ஏற்றுவதில் பிழை");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Subscribe to real-time events to auto-refresh metrics
    const unsubscribe = syncManager.subscribe((event) => {
      if (
        event.type === "COLLECTION_RECORDED" ||
        event.type === "CUSTOMER_CREATED" ||
        event.type === "LOAN_CREATED"
      ) {
        fetchStats(true);
      }
    });

    return () => unsubscribe();
  }, [fetchStats]);

  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 text-white px-5 pt-4 pb-8 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-sm">
                {data?.partner.code || "PARTNER"}
              </span>
              <span className="text-indigo-200 text-xs font-medium">Cloud Client</span>
            </div>
            <h1 className="text-xl font-extrabold mt-1 text-white">
              {data?.partner.name || user?.name || "Partner"}
            </h1>
            <p className="text-indigo-200 text-xs">
              {language === "ta" ? "வணக்கம்! இன்றைய வசூல் நிலவரம்" : "Welcome! Today's Collection Overview"}
            </p>
          </div>

          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition tap-active disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Hero Today Collection Card */}
        <div className="mt-5 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
          <div className="flex justify-between items-center text-xs text-indigo-100 mb-1">
            <span>{language === "ta" ? "இன்றைய வசூல் தொகை" : "Today's Collection"}</span>
            <span className="text-[11px] bg-emerald-500/30 text-emerald-200 font-bold px-2 py-0.5 rounded-md">
              {new Date().toLocaleDateString("en-IN")}
            </span>
          </div>
          <div className="text-3xl font-black text-white tracking-tight">
            ₹{stats ? stats.todayCollectionAmount.toLocaleString("en-IN") : "0"}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-indigo-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {stats?.todayCollectionsCount || 0} {language === "ta" ? "வசூல் பதிவாகியுள்ளது" : "payments recorded today"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {error && (
          <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-xl border border-rose-200">
            {error}
          </div>
        )}

        {/* Quick KPI Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Pending Collections Amount & Count */}
          <div
            onClick={onNavigateToDaily}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-2 cursor-pointer tap-active"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {language === "ta" ? "நிலுவை வசூல்" : "Pending Today"}
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
              ₹{stats ? stats.pendingCollectionsAmount.toLocaleString("en-IN") : "0"}
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              {stats?.pendingCollectionsCount || 0} {language === "ta" ? "வாடிக்கையாளர்கள்" : "installments pending"}
            </p>
          </div>

          {/* Total Collections to Date */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {language === "ta" ? "மொத்த வசூல்" : "Total Collections"}
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
              ₹{stats ? stats.totalCollectionsAmount.toLocaleString("en-IN") : "0"}
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
              {language === "ta" ? "இதுவரை பெற்ற தொகை" : "Cumulative collections"}
            </p>
          </div>

          {/* Active Customers */}
          <div
            onClick={onNavigateToCustomers}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-2 cursor-pointer tap-active"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {language === "ta" ? "வாடிக்கையாளர்கள்" : "Active Customers"}
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
              {stats?.activeCustomerCount || 0}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              {stats?.totalCustomers || 0} {language === "ta" ? "மொத்தம்" : "registered"}
            </p>
          </div>

          {/* Active Loans */}
          <div
            onClick={onNavigateToLoans}
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-2 cursor-pointer tap-active"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {language === "ta" ? "செயலில் உள்ள கடன்கள்" : "Active Loans"}
              </span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">
              {stats?.activeLoanCount || 0}
            </div>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
              {language === "ta" ? "கடன் விவரங்கள்" : "View loan book"}
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            {language === "ta" ? "விரைவு நடவடிக்கைகள்" : "Quick Actions"}
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onNavigateToDaily}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 font-semibold text-xs border border-indigo-100 dark:border-indigo-900/50 tap-active"
            >
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>{language === "ta" ? "இன்றைய வசூல்" : "Today's Schedule"}</span>
            </button>
            <button
              onClick={onNavigateToCustomers}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs border border-slate-200 dark:border-slate-700 tap-active"
            >
              <UserPlus className="w-4 h-4 text-slate-600" />
              <span>{language === "ta" ? "வாடிக்கையாளர்" : "Customers"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
