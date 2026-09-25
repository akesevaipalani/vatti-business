import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  ChevronRight,
  RefreshCw,
  X,
  Calendar,
  DollarSign,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { LoanDetail } from "../types";

function formatDateDMY(dateStr?: string): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export const LoansScreen: React.FC = () => {
  const { language } = useAuth();
  const [loans, setLoans] = useState<LoanDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchLoans = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getLoans(statusFilter, search.trim() || undefined);
      setLoans(res.loans || []);
    } catch (err) {
      console.error("Failed to fetch loans:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const handleOpenLoanDetail = async (loanId: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.getLoan(loanId);
      const mergedLoan = {
        ...res.loan,
        installments: (res.loan.installments && res.loan.installments.length > 0)
          ? res.loan.installments
          : ((res as any).schedule && (res as any).schedule.length > 0)
          ? (res as any).schedule
          : (res.loan.installments || []),
      };
      setSelectedLoan(mergedLoan);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load loan details");
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-3 sticky top-0 z-30 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {language === "ta" ? "கடன்கள் பட்டியல்" : "Loans Directory"}
            </h1>
            <p className="text-xs text-slate-500">
              {language === "ta" ? "வாடிக்கையாளர் கடன் விவரங்கள்" : "Customer loan portfolios"}
            </p>
          </div>
          <button
            onClick={() => fetchLoans(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tap-active disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === "ta" ? "கடன் எண் / பெயர் / அலைபேசி..." : "Search loan # or customer..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
          />
        </div>

        {/* Filter Badges */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {["ALL", "ACTIVE", "OVERDUE", "CLOSED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition tap-active ${
                statusFilter === s
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>{language === "ta" ? "கடன்கள் ஏற்றப்படுகிறது..." : "Loading loans..."}</p>
          </div>
        ) : loans.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {language === "ta" ? "கடன்கள் எதுவும் கிடைக்கவில்லை" : "No loans found"}
            </p>
          </div>
        ) : (
          loans.map((loan) => (
            <div
              key={loan.id}
              onClick={() => handleOpenLoanDetail(loan.id)}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 cursor-pointer tap-active"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">
                      {loan.loanNo}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        loan.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : loan.status === "OVERDUE"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {loan.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-1.5">
                    {loan.customer?.name}
                  </h3>
                  <p className="text-xs text-slate-500">{loan.customer?.mobile}</p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-slate-400">
                    {language === "ta" ? "அசல்" : "Principal"}
                  </span>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    ₹{loan.principalAmount.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              {/* Outstanding breakdown */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">
                    {language === "ta" ? "நிலுவை அசல்" : "Outstanding Principal"}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{loan.principalOutstanding.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">
                    {language === "ta" ? "நிலுவை வட்டி" : "Interest Due"}
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    ₹{loan.interestOutstanding.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                <span>
                  {language === "ta" ? "கடைசி தவணை தேதி" : "Due Date"}: {formatDateDMY(loan.dueDate)}
                </span>
                <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                  {language === "ta" ? "விவரங்கள்" : "View"} <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Loan Details Modal Sheet */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {selectedLoan.loanNo}
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-base mt-1">
                  {selectedLoan.customer?.name}
                </h3>
                <p className="text-xs text-slate-500">{selectedLoan.customer?.mobile}</p>
              </div>
              <button
                onClick={() => setSelectedLoan(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Overview Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 text-[11px] block">{language === "ta" ? "அசல் தொகை" : "Principal Amount"}</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    ₹{selectedLoan.principalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">{language === "ta" ? "வட்டி விகிதம்" : "Interest Rate"}</span>
                  <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                    {selectedLoan.interestRate}% ({selectedLoan.interestType})
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400">{language === "ta" ? "நிலுவை அசல்" : "Outstanding Principal"}:</span>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    ₹{selectedLoan.principalOutstanding.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">{language === "ta" ? "நிலுவை வட்டி" : "Interest Due"}:</span>
                  <div className="font-bold text-amber-600 dark:text-amber-400">
                    ₹{selectedLoan.interestOutstanding.toLocaleString("en-IN")}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">{language === "ta" ? "செலுத்திய அசல்" : "Principal Paid"}:</span>
                  <div className="font-bold text-emerald-600">
                    ₹{selectedLoan.principalPaid.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-slate-400">{language === "ta" ? "செலுத்திய வட்டி" : "Interest Paid"}:</span>
                  <div className="font-bold text-emerald-600">
                    ₹{selectedLoan.interestPaid.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </div>

            {/* Installment Schedule */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {language === "ta" ? "தவணை அட்டவணை" : "Installment Schedule"} ({selectedLoan.installments?.length || 0})
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedLoan.installments?.map((inst) => (
                  <div
                    key={inst.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        #{inst.installmentNumber}
                      </span>
                      <span className="text-[11px] text-slate-500 ml-2">
                        {formatDateDMY(inst.dueDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        ₹{inst.installmentAmount}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          inst.status === "COLLECTED"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : inst.status === "OVERDUE"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        }`}
                      >
                        {inst.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment History */}
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {language === "ta" ? "வசூல் வரலாறு" : "Payment History"} ({selectedLoan.payments?.length || 0})
              </h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {selectedLoan.payments?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    {language === "ta" ? "இதுவரை வசூல் எதுவும் பதிவாகவில்லை" : "No payments recorded yet"}
                  </p>
                ) : (
                  selectedLoan.payments?.map((pmt) => (
                    <div
                      key={pmt.id}
                      className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {pmt.paymentNo}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {formatDateDMY(pmt.date)} • {pmt.paymentMethod}
                        </div>
                      </div>
                      <div className="font-black text-emerald-600 dark:text-emerald-400">
                        ₹{pmt.amount.toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
