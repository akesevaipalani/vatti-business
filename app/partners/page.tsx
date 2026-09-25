"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  TrendingUp,
  ArrowDownRight,
  Phone,
  FileText,
  Search,
  X,
  Printer,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface PartnerInvestmentRecord {
  id: string;
  amount: number;
  date: string;
  type: string;
}

interface PartnerWithdrawalRecord {
  id: string;
  amount: number;
  date: string;
  reason: string | null;
}

interface PartnerListItem {
  id: string;
  partnerCode: string;
  name: string;
  mobile: string;
  email: string | null;
  address: string | null;
  initialCapital: number;
  currentCapital: number;
  profitSharePercent: number;
  lossSharePercent: number;
  status: string;
  investments?: PartnerInvestmentRecord[];
  withdrawals?: PartnerWithdrawalRecord[];
}

export default function PartnersPage() {
  const router = useRouter();
  const { t, formatCurrency } = useLanguage();
  const [partners, setPartners] = useState<PartnerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [newPartnerModal, setNewPartnerModal] = useState(false);
  const [investModal, setInvestModal] = useState<PartnerListItem | null>(null);
  const [withdrawModal, setWithdrawModal] = useState<PartnerListItem | null>(null);

  // Form states
  const [newPartnerForm, setNewPartnerForm] = useState({
    name: "",
    mobile: "",
    email: "",
    address: "",
    initialCapital: "",
    profitSharePercent: "50",
    lossSharePercent: "50",
    paymentMethod: "BANK",
    notes: "",
  });

  const [investForm, setInvestForm] = useState({
    amount: "",
    type: "ADDITIONAL",
    paymentMethod: "BANK",
    purpose: "",
    referenceNo: "",
    notes: "",
  });

  const [withdrawForm, setWithdrawForm] = useState({
    amount: "",
    reason: "",
    paymentMethod: "BANK",
    referenceNo: "",
    notes: "",
    allowOverdraft: false,
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchPartners = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partners");
      if (res.status === 401 || res.status === 403) {
        router.replace("/dashboard");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setPartners(data.partners || []);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated || data.user?.role !== "ADMIN") {
          router.replace("/dashboard");
        } else {
          fetchPartners();
        }
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [router, fetchPartners]);

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPartnerForm),
      });
      if (res.ok) {
        setNewPartnerModal(false);
        setNewPartnerForm({
          name: "",
          mobile: "",
          email: "",
          address: "",
          initialCapital: "",
          profitSharePercent: "50",
          lossSharePercent: "50",
          paymentMethod: "BANK",
          notes: "",
        });
        fetchPartners();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to create partner");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!investModal) return;
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/partners/${investModal.id}/invest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(investForm),
      });
      if (res.ok) {
        setInvestModal(null);
        setInvestForm({
          amount: "",
          type: "ADDITIONAL",
          paymentMethod: "BANK",
          purpose: "",
          referenceNo: "",
          notes: "",
        });
        fetchPartners();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Investment failed");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawModal) return;
    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/api/partners/${withdrawModal.id}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withdrawForm),
      });
      if (res.ok) {
        setWithdrawModal(null);
        setWithdrawForm({
          amount: "",
          reason: "",
          paymentMethod: "BANK",
          referenceNo: "",
          notes: "",
          allowOverdraft: false,
        });
        fetchPartners();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Withdrawal failed");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredPartners = partners.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.mobile.includes(searchTerm) ||
      p.partnerCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPartnerCapital = partners.reduce((sum, p) => sum + p.currentCapital, 0);
  const totalInvestments = partners.reduce(
    (sum, p) => sum + (p.investments?.reduce((isum: number, i: PartnerInvestmentRecord) => isum + i.amount, 0) || 0),
    0
  );
  const totalWithdrawals = partners.reduce(
    (sum, p) => sum + (p.withdrawals?.reduce((wsum: number, w: PartnerWithdrawalRecord) => wsum + w.amount, 0) || 0),
    0
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>{t.partners}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Partner capital, investments, withdrawals, and profit-sharing management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{t.print}</span>
          </button>
          <button
            onClick={() => setNewPartnerModal(true)}
            className="flex items-center gap-1.5 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newPartner}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Partner Capital</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-2 font-mono">
            {formatCurrency(totalPartnerCapital)}
          </div>
          <div className="text-xs text-slate-400 mt-1">Across {partners.length} registered partners</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Capital Inflow</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600 mt-2 font-mono">
            {formatCurrency(totalInvestments)}
          </div>
          <div className="text-xs text-slate-400 mt-1">All partner contributions to date</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Withdrawn / Drawings</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-rose-600 mt-2 font-mono">
            {formatCurrency(totalWithdrawals)}
          </div>
          <div className="text-xs text-slate-400 mt-1">All partner withdrawals to date</div>
        </div>
      </div>

      {/* Partners List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search partner by name, code, mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Showing {filteredPartners.length} of {partners.length} partners
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading partners...</div>
        ) : filteredPartners.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No partners found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Partner Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Profit Share %</th>
                  <th className="py-3 px-4 text-right">Initial Capital</th>
                  <th className="py-3 px-4 text-right">Current Capital</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      {partner.partnerCode}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                      <Link href={`/partners/${partner.id}`} className="hover:underline">
                        {partner.name}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{partner.mobile}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-indigo-600">
                      {partner.profitSharePercent}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600 dark:text-slate-400">
                      {formatCurrency(partner.initialCapital)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 dark:text-slate-100 text-sm">
                      {formatCurrency(partner.currentCapital)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        {partner.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1.5">
                      <button
                        onClick={() => setInvestModal(partner)}
                        className="py-1 px-2 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-[11px] font-bold transition"
                      >
                        + Invest
                      </button>
                      <button
                        onClick={() => setWithdrawModal(partner)}
                        className="py-1 px-2 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 text-[11px] font-bold transition"
                      >
                        - Withdraw
                      </button>
                      <Link
                        href={`/partners/${partner.id}`}
                        className="py-1 px-2 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold transition inline-flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Ledger</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADD PARTNER */}
      {newPartnerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t.newPartner}
              </h3>
              <button onClick={() => setNewPartnerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePartner} className="p-6 space-y-3.5">
              {errorMsg && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-600 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Partner Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., P. Karthikeyan"
                  value={newPartnerForm.name}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Mobile *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="98421 11223"
                    value={newPartnerForm.mobile}
                    onChange={(e) => setNewPartnerForm({ ...newPartnerForm, mobile: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Profit Share %
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={newPartnerForm.profitSharePercent}
                    onChange={(e) => setNewPartnerForm({ ...newPartnerForm, profitSharePercent: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Initial Capital Investment (₹)
                </label>
                <input
                  type="number"
                  placeholder="100000"
                  value={newPartnerForm.initialCapital}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, initialCapital: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode for Initial Capital
                </label>
                <select
                  value={newPartnerForm.paymentMethod}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="BANK">Bank Transfer / Cheque</option>
                  <option value="CASH">Cash-in-Hand</option>
                  <option value="UPI">UPI / Digital</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  placeholder="Madurai"
                  value={newPartnerForm.address}
                  onChange={(e) => setNewPartnerForm({ ...newPartnerForm, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNewPartnerModal(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "Saving..." : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD INVESTMENT */}
      {investModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Record Partner Investment
                </h3>
                <p className="text-xs text-indigo-600 font-semibold">{investModal.name}</p>
              </div>
              <button onClick={() => setInvestModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvest} className="p-6 space-y-3.5">
              {errorMsg && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-600 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Investment Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  autoFocus
                  placeholder="50000"
                  value={investForm.amount}
                  onChange={(e) => setInvestForm({ ...investForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Investment Type
                </label>
                <select
                  value={investForm.type}
                  onChange={(e) => setInvestForm({ ...investForm, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ADDITIONAL">Additional Capital</option>
                  <option value="EMERGENCY">Emergency Investment</option>
                  <option value="EXPANSION">Business Expansion</option>
                  <option value="WORKING_CAPITAL">Working Capital</option>
                  <option value="ASSET_PURCHASE">Asset Purchase</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <select
                  value={investForm.paymentMethod}
                  onChange={(e) => setInvestForm({ ...investForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="BANK">Bank Transfer / Cheque</option>
                  <option value="CASH">Cash-in-Hand</option>
                  <option value="UPI">UPI / Digital</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reference / Transaction No
                </label>
                <input
                  type="text"
                  placeholder="NEFT/UPI Ref"
                  value={investForm.referenceNo}
                  onChange={(e) => setInvestForm({ ...investForm, referenceNo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Purpose / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g., Festival season loan lending"
                  value={investForm.purpose}
                  onChange={(e) => setInvestForm({ ...investForm, purpose: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInvestModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Add Investment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: RECORD WITHDRAWAL */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Record Partner Withdrawal
                </h3>
                <p className="text-xs text-rose-600 font-semibold">
                  {withdrawModal.name} • Available: {formatCurrency(withdrawModal.currentCapital)}
                </p>
              </div>
              <button onClick={() => setWithdrawModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdraw} className="p-6 space-y-3.5">
              {errorMsg && (
                <div className="p-2.5 rounded bg-rose-50 text-rose-600 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Withdrawal Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  autoFocus
                  placeholder="20000"
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Drawing
                </label>
                <input
                  type="text"
                  placeholder="Personal drawing, emergency, etc."
                  value={withdrawForm.reason}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Disbursed Via
                </label>
                <select
                  value={withdrawForm.paymentMethod}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="BANK">Bank Transfer / Cheque</option>
                  <option value="CASH">Cash-in-Hand</option>
                  <option value="UPI">UPI / Digital</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowOverdraft"
                  checked={withdrawForm.allowOverdraft}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, allowOverdraft: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                <label htmlFor="allowOverdraft" className="text-xs text-slate-600 dark:text-slate-400">
                  Allow overdraft beyond partner capital
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWithdrawModal(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow transition disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Confirm Withdrawal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
