"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  FileCheck,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PartnerInvestment {
  id: string;
  investmentCode: string;
  date: string;
  type: string;
  purpose: string | null;
  paymentMethod: string;
  amount: number;
}

interface PartnerWithdrawal {
  id: string;
  withdrawalCode: string;
  date: string;
  reason: string | null;
  paymentMethod: string;
  amount: number;
}

interface PartnerSettlement {
  id: string;
  settlementCode: string;
  date: string;
  notes: string | null;
  closingBalance: number;
}

interface PartnerDetail {
  id: string;
  partnerCode: string;
  name: string;
  mobile: string;
  email: string | null;
  status: string;
  joiningDate: string;
  initialCapital: number;
  currentCapital: number;
  profitSharePercent: number;
  lossSharePercent: number;
  investments: PartnerInvestment[];
  withdrawals: PartnerWithdrawal[];
  settlements: PartnerSettlement[];
}

interface PartnerLedgerItem {
  id: string;
  date: Date;
  type: "INVESTMENT" | "WITHDRAWAL";
  code: string;
  description: string;
  method: string;
  inflow: number;
  outflow: number;
  balance?: number;
}

export default function PartnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const { formatCurrency, formatDate } = useLanguage();
  const [partner, setPartner] = useState<PartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  const fetchPartner = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partners/${id}`);
      if (res.status === 401 || res.status === 403) {
        router.replace("/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPartner(data.partner);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated || data.user?.role !== "ADMIN") {
          router.replace("/dashboard");
        } else {
          fetchPartner();
        }
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [router, fetchPartner]);

  const handleGenerateSettlement = async () => {
    if (!confirm("Are you sure you want to generate an official settlement statement?")) return;
    setSettling(true);
    try {
      const res = await fetch(`/api/partners/${id}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Official Account Statement Settlement" }),
      });
      if (res.ok) {
        alert("Settlement statement generated successfully!");
        fetchPartner();
      }
    } catch (err: unknown) {
      console.error(err);
      alert("Failed to generate settlement");
    } finally {
      setSettling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Partner record not found.
      </div>
    );
  }

  // Combine investments, withdrawals, allocations into a single chronologically sorted ledger
  const ledgerEntries: PartnerLedgerItem[] = [];

  partner.investments?.forEach((inv: PartnerInvestment) => {
    ledgerEntries.push({
      id: inv.id,
      date: new Date(inv.date),
      type: "INVESTMENT",
      code: inv.investmentCode,
      description: `Capital Contribution (${inv.type}) - ${inv.purpose || ""}`,
      method: inv.paymentMethod,
      inflow: inv.amount,
      outflow: 0,
    });
  });

  partner.withdrawals?.forEach((wdl: PartnerWithdrawal) => {
    ledgerEntries.push({
      id: wdl.id,
      date: new Date(wdl.date),
      type: "WITHDRAWAL",
      code: wdl.withdrawalCode,
      description: `Partner Drawing / Withdrawal - ${wdl.reason || ""}`,
      method: wdl.paymentMethod,
      inflow: 0,
      outflow: wdl.amount,
    });
  });

  ledgerEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate running capital balance
  let running = partner.initialCapital;
  const ledgerWithBalance = ledgerEntries.map((e) => {
    running = running + e.inflow - e.outflow;
    return { ...e, balance: running };
  });

  const totalInflows = ledgerEntries.reduce((s, e) => s + e.inflow, 0);
  const totalOutflows = ledgerEntries.reduce((s, e) => s + e.outflow, 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top action bar */}
      <div className="flex items-center justify-between no-print">
        <Link
          href="/partners"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Partners</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold hover:bg-slate-50 transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Statement</span>
          </button>
          <button
            onClick={handleGenerateSettlement}
            disabled={settling}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            <FileCheck className="w-4 h-4" />
            <span>{settling ? "Generating..." : "Generate Settlement"}</span>
          </button>
        </div>
      </div>

      {/* Partner Statement Header (Print friendly) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {partner.partnerCode}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                {partner.status}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1">
              {partner.name}
            </h1>
            <p className="text-xs text-slate-500">
              Partner Capital Statement & Account Ledger
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold text-slate-500">Net Partner Capital</div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono mt-0.5">
              {formatCurrency(partner.currentCapital)}
            </div>
            <div className="text-xs text-indigo-600 font-bold mt-1">
              {partner.profitSharePercent}% Profit Share • {partner.lossSharePercent}% Loss Share
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">Contact Phone</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{partner.mobile}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Email Address</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{partner.email || "-"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Partner Since</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{formatDate(partner.joiningDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Initial Capital</span>
            <span className="font-semibold font-mono text-slate-800 dark:text-slate-200">
              {formatCurrency(partner.initialCapital)}
            </span>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">Total Capital Injected</div>
          <div className="text-lg font-bold text-emerald-600 mt-1 font-mono">
            {formatCurrency(totalInflows)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{partner.investments?.length || 0} investments</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">Total Drawings / Withdrawals</div>
          <div className="text-lg font-bold text-rose-600 mt-1 font-mono">
            {formatCurrency(totalOutflows)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{partner.withdrawals?.length || 0} drawings</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="text-xs font-medium text-slate-500">Settlements Generated</div>
          <div className="text-lg font-bold text-indigo-600 mt-1 font-mono">
            {partner.settlements?.length || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Formal statements issued</div>
        </div>
      </div>

      {/* DETAILED CAPITAL LEDGER TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Partner Capital Transaction Ledger
          </h2>
          <p className="text-xs text-slate-500">Chronological history of capital inflows and outflows</p>
        </div>

        {ledgerWithBalance.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No transactions recorded yet for this partner.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4 text-right">Inflow (Credit)</th>
                  <th className="py-3 px-4 text-right">Outflow (Debit)</th>
                  <th className="py-3 px-4 text-right">Running Capital</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {ledgerWithBalance.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-sans">
                      {formatDate(item.date)}
                    </td>
                    <td className="py-3 px-4 text-indigo-600 font-bold">
                      {item.code}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-800 dark:text-slate-200">
                      {item.description}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold">
                        {item.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-600">
                      {item.inflow > 0 ? formatCurrency(item.inflow) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-600">
                      {item.outflow > 0 ? formatCurrency(item.outflow) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-slate-100 text-sm">
                      {formatCurrency(item.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settlements History */}
      {partner.settlements && partner.settlements.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Historical Settlement Statements
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {partner.settlements.map((set: PartnerSettlement) => (
              <div key={set.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-mono font-bold text-indigo-600">{set.settlementCode}</div>
                  <div className="text-slate-500">{formatDate(set.date)} • {set.notes}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                    Closing: {formatCurrency(set.closingBalance)}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Settled</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
