"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  Wallet,
  Building2,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Users,
  Calendar,
  Clock,
  Plus,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface ChartPoint {
  name: string;
  collections: number;
  interest: number;
  expenses: number;
  profit: number;
}

interface ReminderItem {
  id: string;
  title: string;
  message?: string;
  dueDate: string | Date;
  severity?: string;
  notes?: string | null;
  priority?: string;
  isCompleted?: boolean;
}

interface DashboardKPIs {
  totalCapital: number;
  totalPartnerInvestment: number;
  totalPartnerCapital: number;
  totalPartnerWithdrawal: number;
  totalMoneyGiven: number;
  totalPrincipalOutstanding: number;
  totalInterestReceivable: number;
  totalAmountReceivable: number;
  totalMoneyReceived: number;
  totalInterestReceived: number;
  totalExpenses: number;
  totalBusinessProfit: number;
  totalPartnerProfit: number;
  totalBusinessAssets: number;
  totalLiabilities: number;
  availableCash: number;
  bankBalance: number;
}

interface DashboardToday {
  collection: number;
  expense: number;
  investment: number;
  withdrawal: number;
  profit: number;
  pendingCollections: number;
  overdueAmounts: number;
  overdueCount: number;
}

interface DashboardStatsData {
  kpis: DashboardKPIs;
  today: DashboardToday;
  charts: {
    monthly: ChartPoint[];
  };
  reminders: ReminderItem[];
}

export default function DashboardPage() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [stats, setStats] = useState<DashboardStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err: unknown) {
      console.error("Dashboard stats error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 mx-auto border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading Vatti Business Dashboard...</p>
        </div>
      </div>
    );
  }

  const k = stats.kpis;
  const today = stats.today;
  const chartData = stats.charts.monthly || [];

  const mainKpiCards = [
    {
      title: t.totalCapital,
      amount: k.totalCapital,
      icon: DollarSign,
      color: "text-indigo-600",
      bg: "bg-indigo-50 dark:bg-indigo-950/40",
      sub: "Owner + Partner Equity",
      href: "/partners",
    },
    {
      title: t.totalPartnerInvestment,
      amount: k.totalPartnerInvestment,
      icon: Users,
      color: "text-teal-600",
      bg: "bg-teal-50 dark:bg-teal-950/40",
      sub: `Current Cap: ${formatCurrency(k.totalPartnerCapital)}`,
      href: "/partners",
    },
    {
      title: t.totalMoneyGiven,
      amount: k.totalMoneyGiven,
      icon: CreditCard,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      sub: "Total Loans Disbursed",
      href: "/loans",
    },
    {
      title: t.totalPrincipalOutstanding,
      amount: k.totalPrincipalOutstanding,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950/40",
      sub: `Interest Rec: ${formatCurrency(k.totalInterestReceivable)}`,
      href: "/loans?status=ACTIVE",
    },
    {
      title: t.totalAmountReceivable,
      amount: k.totalAmountReceivable,
      icon: ArrowUpRight,
      color: "text-cyan-600",
      bg: "bg-cyan-50 dark:bg-cyan-950/40",
      sub: "Principal + Interest Due",
      href: "/loans?status=ACTIVE",
    },
    {
      title: t.totalMoneyReceived,
      amount: k.totalMoneyReceived,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      sub: `Interest: ${formatCurrency(k.totalInterestReceived)}`,
      href: "/collections",
    },
    {
      title: t.totalExpenses,
      amount: k.totalExpenses,
      icon: Receipt,
      color: "text-rose-600",
      bg: "bg-rose-50 dark:bg-rose-950/40",
      sub: "Business Operating Costs",
      href: "/expenses",
    },
    {
      title: t.totalBusinessProfit,
      amount: k.totalBusinessProfit,
      icon: TrendingUp,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      sub: "Net Revenue - Expenses",
      href: "/reports?type=PL",
    },
    {
      title: t.totalPartnerProfit,
      amount: k.totalPartnerProfit,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-950/40",
      sub: "Allocated to Partners",
      href: "/partners",
    },
    {
      title: t.totalBusinessAssets,
      amount: k.totalBusinessAssets,
      icon: Building2,
      color: "text-slate-700 dark:text-slate-200",
      bg: "bg-slate-100 dark:bg-slate-800",
      sub: "Cash + Bank + Loans + Equipment",
      href: "/reports?type=BALANCE_SHEET",
    },
    {
      title: t.totalLiabilities,
      amount: k.totalLiabilities,
      icon: AlertTriangle,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/40",
      sub: "Borrowed Loans & Payables",
      href: "/loans-taken",
    },
    {
      title: t.availableCash,
      amount: k.availableCash,
      icon: Wallet,
      color: "text-emerald-700",
      bg: "bg-emerald-100 dark:bg-emerald-950/50",
      sub: "Cash-in-Hand at Counter",
      href: "/cash-book",
    },
    {
      title: t.bankBalance,
      amount: k.bankBalance,
      icon: Building2,
      color: "text-blue-700",
      bg: "bg-blue-100 dark:bg-blue-950/50",
      sub: "All Bank Accounts Total",
      href: "/bank-accounts",
    },
  ];

  const maxChartVal = Math.max(...chartData.map((d: ChartPoint) => Math.max(d.collections, d.expenses)), 1000);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header / Quick Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {t.dashboard}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              LIVE LOCAL DB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time financial status of Vatti Business
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/daily-collections"
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.dailyCollections}</span>
          </Link>
          <Link
            href="/loans/new"
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newLoan}</span>
          </Link>
        </div>
      </div>

      {/* TODAY'S FLASH METRICS BANNER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">{t.todayCollection}</div>
          <div className="text-base font-bold text-emerald-600 mt-1 font-mono">
            {formatCurrency(today.collection)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">{t.todayExpense}</div>
          <div className="text-base font-bold text-rose-600 mt-1 font-mono">
            {formatCurrency(today.expense)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">{t.todayProfit}</div>
          <div className="text-base font-bold text-indigo-600 mt-1 font-mono">
            {formatCurrency(today.profit)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">{t.todayInvestment}</div>
          <div className="text-base font-bold text-teal-600 mt-1 font-mono">
            {formatCurrency(today.investment)}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">{t.overdueAmounts}</div>
          <div className="text-base font-bold text-amber-600 mt-1 font-mono">
            {formatCurrency(today.overdueAmounts)}
          </div>
          <div className="text-[10px] text-amber-500 font-medium">
            {today.overdueCount} {today.overdueCount === 1 ? "loan" : "loans"} overdue
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-[11px] font-medium text-slate-500">{t.pendingCollections}</div>
          <div className="text-base font-bold text-blue-600 mt-1 font-mono">
            {formatCurrency(today.pendingCollections)}
          </div>
        </div>
      </div>

      {/* 13 DETAILED FINANCIAL KPI CARDS GRID */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Overall Business Balance & Capital Status
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {mainKpiCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Link
                key={i}
                href={card.href}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-between cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                    {card.title}
                  </span>
                  <div className={`p-2 rounded-lg ${card.bg} group-hover:scale-105 transition-transform`}>
                    <Icon className={`w-4 h-4 ${card.color}`} />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {formatCurrency(card.amount)}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate flex items-center justify-between">
                    <span>{card.sub}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-500 font-semibold font-sans">
                      View →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* CHARTS & REMINDERS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Collections vs Expenses Bar Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Monthly Performance (Last 6 Months)
              </h3>
              <p className="text-xs text-slate-500">Collections (Green) vs Expenses (Rose)</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-slate-600 dark:text-slate-400 font-medium">Collections</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span className="text-slate-600 dark:text-slate-400 font-medium">Expenses</span>
              </div>
            </div>
          </div>

          {/* Simple Clean Responsive SVG / Bar Visualization */}
          <div className="h-56 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-100 dark:border-slate-800">
            {chartData.map((d: ChartPoint, idx: number) => {
              const colHeight = Math.max(4, Math.round((d.collections / maxChartVal) * 180));
              const expHeight = Math.max(4, Math.round((d.expenses / maxChartVal) * 180));

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                  <div className="w-full flex items-end justify-center gap-1.5 h-44">
                    {/* Collection bar */}
                    <div
                      style={{ height: `${colHeight}px` }}
                      className="w-1/2 max-w-[28px] bg-emerald-500/90 rounded-t-md hover:bg-emerald-600 transition relative group/bar"
                    >
                      <div className="opacity-0 group-hover/bar:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap pointer-events-none z-10 font-mono">
                        {formatCurrency(d.collections)}
                      </div>
                    </div>

                    {/* Expense bar */}
                    <div
                      style={{ height: `${expHeight}px` }}
                      className="w-1/2 max-w-[28px] bg-rose-500/90 rounded-t-md hover:bg-rose-600 transition relative group/bar2"
                    >
                      <div className="opacity-0 group-hover/bar2:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow whitespace-nowrap pointer-events-none z-10 font-mono">
                        {formatCurrency(d.expenses)}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {d.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Due Reminders / Alerts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>Due Reminders</span>
            </h3>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {stats?.reminders?.length || 0} Pending
            </span>
          </div>

          <div className="space-y-2.5">
            {(!stats?.reminders || stats.reminders.length === 0) && (
              <p className="text-xs text-slate-400 py-6 text-center">
                No immediate reminders due.
              </p>
            )}

            {stats?.reminders?.map((rem: ReminderItem) => (
              <div
                key={rem.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-start gap-3"
              >
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {rem.title}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Due: {formatDate(rem.dueDate)}
                  </div>
                  {rem.notes && (
                    <div className="text-[11px] text-slate-400 italic mt-0.5">
                      {rem.notes}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/loans"
            className="block text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-2"
          >
            View all loan due dates →
          </Link>
        </div>
      </div>
    </div>
  );
}
