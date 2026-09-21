"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Printer,
  Download,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PLReport {
  revenue: {
    interestIncome: number;
    otherIncome: number;
    totalRevenue: number;
  };
  expenses: {
    operatingExpenses: number;
    interestExpense: number;
    totalExpenses: number;
  };
  netProfit: number;
}

interface BalanceSheetReport {
  asOfDate?: string;
  assets: {
    cashInHand: number;
    bankTotal: number;
    loansReceivable: number;
    fixedAssetsTotal: number;
    totalAssets: number;
  };
  liabilities: {
    loansPayable: number;
    otherLiabilities: number;
    totalLiabilities: number;
  };
  capital: {
    partnerCapitalTotal: number;
    retainedProfit: number;
    totalCapital: number;
  };
}

interface CashFlowReport {
  inflows: {
    collections: number;
    income: number;
    investments: number;
    totalInflows: number;
  };
  outflows: {
    expenses: number;
    withdrawals: number;
    totalOutflows: number;
  };
  netCashFlow: number;
}

type ReportData = Partial<PLReport & BalanceSheetReport & CashFlowReport>;

export default function ReportsPage() {
  const { t, formatCurrency, formatDate } = useLanguage();
  const [reportType, setReportType] = useState<"PL" | "BALANCE_SHEET" | "CASH_FLOW">("PL");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tParam = params.get("type");
      if (tParam === "BALANCE_SHEET" || tParam === "CASH_FLOW" || tParam === "PL") {
        setReportType(tParam);
      }
    }
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${reportType}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.report);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = () => {
    if (!data) return;
    let csvContent = "data:text/csv;charset=utf-8,";

    if (reportType === "PL") {
      csvContent += "Category,Description,Amount\n";
      csvContent += `Revenue,Interest Income,${data.revenue?.interestIncome || 0}\n`;
      csvContent += `Revenue,Other Income,${data.revenue?.otherIncome || 0}\n`;
      csvContent += `Revenue,Total Revenue,${data.revenue?.totalRevenue || 0}\n`;
      csvContent += `Expense,Operating Expenses,${data.expenses?.operatingExpenses || 0}\n`;
      csvContent += `Expense,Interest Paid,${data.expenses?.interestExpense || 0}\n`;
      csvContent += `Expense,Total Expenses,${data.expenses?.totalExpenses || 0}\n`;
      csvContent += `Profit,Net Profit,${data.netProfit || 0}\n`;
    } else if (reportType === "BALANCE_SHEET") {
      csvContent += "Classification,Account,Amount\n";
      csvContent += `Asset,Cash in Hand,${data.assets?.cashInHand || 0}\n`;
      csvContent += `Asset,Bank Accounts,${data.assets?.bankTotal || 0}\n`;
      csvContent += `Asset,Loans Receivable,${data.assets?.loansReceivable || 0}\n`;
      csvContent += `Asset,Fixed Assets,${data.assets?.fixedAssetsTotal || 0}\n`;
      csvContent += `Asset,Total Assets,${data.assets?.totalAssets || 0}\n`;
      csvContent += `Liability,Loans Payable,${data.liabilities?.loansPayable || 0}\n`;
      csvContent += `Liability,Other Liabilities,${data.liabilities?.otherLiabilities || 0}\n`;
      csvContent += `Liability,Total Liabilities,${data.liabilities?.totalLiabilities || 0}\n`;
      csvContent += `Capital,Partner Capital,${data.capital?.partnerCapitalTotal || 0}\n`;
      csvContent += `Capital,Retained Profit,${data.capital?.retainedProfit || 0}\n`;
      csvContent += `Capital,Total Capital,${data.capital?.totalCapital || 0}\n`;
    } else {
      csvContent += "Type,Item,Amount\n";
      csvContent += `Inflow,Collections,${data.inflows?.collections || 0}\n`;
      csvContent += `Inflow,Income,${data.inflows?.income || 0}\n`;
      csvContent += `Inflow,Investments,${data.inflows?.investments || 0}\n`;
      csvContent += `Outflow,Expenses,${data.outflows?.expenses || 0}\n`;
      csvContent += `Outflow,Withdrawals,${data.outflows?.withdrawals || 0}\n`;
      csvContent += `Summary,Net Cash Flow,${data.netCashFlow || 0}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Vatti_${reportType}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span>{t.reports}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready Profit & Loss Statement, Balance Sheet, and Cash Flow
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Download className="w-4 h-4" />
            <span>{t.exportCsv}</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Printer className="w-4 h-4" />
            <span>{t.print}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-xs font-bold no-print">
        <button
          onClick={() => setReportType("PL")}
          className={`pb-2.5 transition border-b-2 ${
            reportType === "PL"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Profit & Loss Statement (P&L)
        </button>
        <button
          onClick={() => setReportType("BALANCE_SHEET")}
          className={`pb-2.5 transition border-b-2 ${
            reportType === "BALANCE_SHEET"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Balance Sheet
        </button>
        <button
          onClick={() => setReportType("CASH_FLOW")}
          className={`pb-2.5 transition border-b-2 ${
            reportType === "CASH_FLOW"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Cash Flow Statement
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500">Generating report...</div>
      ) : (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          {/* 1. PROFIT & LOSS STATEMENT */}
          {reportType === "PL" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Statement of Profit and Loss
                  </h2>
                  <p className="text-xs text-slate-500">Period: Cumulative to Date</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Net Business Profit</span>
                  <div className="text-xl font-black text-emerald-600 font-mono">
                    {formatCurrency(data?.netProfit)}
                  </div>
                </div>
              </div>

              {/* Revenue */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  I. Business Revenue
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                  <div className="py-2.5 flex justify-between">
                    <span className="font-sans text-slate-700 dark:text-slate-300">
                      Interest Income (From Customer Loans)
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(data?.revenue?.interestIncome)}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="font-sans text-slate-700 dark:text-slate-300">
                      Other Business Revenue & Commissions
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(data?.revenue?.otherIncome)}
                    </span>
                  </div>
                  <div className="py-3 flex justify-between text-sm font-black bg-emerald-50/50 dark:bg-emerald-950/20 px-2 rounded-lg">
                    <span className="font-sans text-emerald-800 dark:text-emerald-300">
                      Total Business Revenue (A)
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(data?.revenue?.totalRevenue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expenses */}
              <div className="space-y-2 pt-4">
                <h3 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                  II. Operating Expenses
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                  <div className="py-2.5 flex justify-between">
                    <span className="font-sans text-slate-700 dark:text-slate-300">
                      Operating Expenses (Rent, Salary, Fuel, Office)
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(data?.expenses?.operatingExpenses)}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="font-sans text-slate-700 dark:text-slate-300">
                      Interest Expense Paid to Lenders
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(data?.expenses?.interestExpense)}
                    </span>
                  </div>
                  <div className="py-3 flex justify-between text-sm font-black bg-rose-50/50 dark:bg-rose-950/20 px-2 rounded-lg">
                    <span className="font-sans text-rose-800 dark:text-rose-300">
                      Total Business Expenses (B)
                    </span>
                    <span className="text-rose-700 dark:text-rose-400">
                      {formatCurrency(data?.expenses?.totalExpenses)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Profit Summary */}
              <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between text-base font-black">
                <span className="text-slate-900 dark:text-slate-100">
                  Net Business Profit (A - B)
                </span>
                <span className="text-emerald-600 font-mono text-xl">
                  {formatCurrency(data?.netProfit)}
                </span>
              </div>
            </div>
          )}

          {/* 2. BALANCE SHEET */}
          {reportType === "BALANCE_SHEET" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Balance Sheet Statement
                  </h2>
                  <p className="text-xs text-slate-500">As of: {formatDate(data?.asOfDate)}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Total Asset Value</span>
                  <div className="text-xl font-black text-indigo-600 font-mono">
                    {formatCurrency(data?.assets?.totalAssets)}
                  </div>
                </div>
              </div>

              {/* Assets vs Liabilities Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Assets (சொத்துக்கள்)
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                    <div className="py-2.5 flex justify-between">
                      <span className="font-sans text-slate-700 dark:text-slate-300">
                        Cash-in-Hand at Counter
                      </span>
                      <span className="font-bold">{formatCurrency(data?.assets?.cashInHand)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="font-sans text-slate-700 dark:text-slate-300">
                        Bank Accounts Total
                      </span>
                      <span className="font-bold">{formatCurrency(data?.assets?.bankTotal)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="font-sans text-slate-700 dark:text-slate-300">
                        Loans Receivable (Principal)
                      </span>
                      <span className="font-bold">{formatCurrency(data?.assets?.loansReceivable)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="font-sans text-slate-700 dark:text-slate-300">
                        Fixed Business Assets
                      </span>
                      <span className="font-bold">{formatCurrency(data?.assets?.fixedAssetsTotal)}</span>
                    </div>
                    <div className="py-3 flex justify-between font-black text-sm bg-blue-50/50 dark:bg-blue-950/20 px-2 rounded-lg">
                      <span className="font-sans text-blue-800 dark:text-blue-300">
                        Total Assets
                      </span>
                      <span className="text-blue-700 dark:text-blue-400 font-mono">
                        {formatCurrency(data?.assets?.totalAssets)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                    Liabilities & Capital (பொறுப்புகள் & மூலதனம்)
                  </h3>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                    <div className="py-2.5 flex justify-between">
                      <span className="font-sans text-slate-700 dark:text-slate-300">
                        Borrowed Loans (Financiers)
                      </span>
                      <span className="font-bold">{formatCurrency(data?.liabilities?.loansPayable)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="font-sans text-slate-700 dark:text-slate-300">
                        Other Liabilities
                      </span>
                      <span className="font-bold">{formatCurrency(data?.liabilities?.otherLiabilities)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="font-sans text-slate-700 dark:text-slate-300">
                        Total Partner Capital
                      </span>
                      <span className="font-bold">{formatCurrency(data?.capital?.partnerCapitalTotal)}</span>
                    </div>
                    <div className="py-2.5 flex justify-between">
                      <span className="font-sans text-slate-700 dark:text-slate-300">
                        Retained Period Earnings
                      </span>
                      <span className="font-bold">{formatCurrency(data?.capital?.retainedProfit)}</span>
                    </div>
                    <div className="py-3 flex justify-between font-black text-sm bg-orange-50/50 dark:bg-orange-950/20 px-2 rounded-lg">
                      <span className="font-sans text-orange-800 dark:text-orange-300">
                        Total Liabilities & Equity
                      </span>
                      <span className="text-orange-700 dark:text-orange-400 font-mono">
                        {formatCurrency((data?.liabilities?.totalLiabilities || 0) + (data?.capital?.totalCapital || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. CASH FLOW STATEMENT */}
          {reportType === "CASH_FLOW" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Cash Flow Statement
                  </h2>
                  <p className="text-xs text-slate-500">Inflows vs Outflows</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Net Cash Flow</span>
                  <div className="text-xl font-black text-emerald-600 font-mono">
                    {formatCurrency(data?.netCashFlow)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                  Cash Inflows (பணம் வரவு)
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                  <div className="py-2 flex justify-between">
                    <span className="font-sans">Loan Collections</span>
                    <span className="font-bold">{formatCurrency(data?.inflows?.collections)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-sans">Other Incomes</span>
                    <span className="font-bold">{formatCurrency(data?.inflows?.income)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-sans">Partner Capital Additions</span>
                    <span className="font-bold">{formatCurrency(data?.inflows?.investments)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between font-bold bg-emerald-50 px-2 rounded">
                    <span className="font-sans">Total Cash Inflow</span>
                    <span className="text-emerald-700">{formatCurrency(data?.inflows?.totalInflows)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3">
                <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider">
                  Cash Outflows (பணம் செலவு / வெளியேற்றம்)
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                  <div className="py-2 flex justify-between">
                    <span className="font-sans">Operating Expenses</span>
                    <span className="font-bold">{formatCurrency(data?.outflows?.expenses)}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-sans">Partner Capital Drawings</span>
                    <span className="font-bold">{formatCurrency(data?.outflows?.withdrawals)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between font-bold bg-rose-50 px-2 rounded">
                    <span className="font-sans">Total Cash Outflow</span>
                    <span className="text-rose-700">{formatCurrency(data?.outflows?.totalOutflows)}</span>
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
