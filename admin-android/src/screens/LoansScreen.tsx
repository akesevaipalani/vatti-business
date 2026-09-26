import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Banknote,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronRight,
  Calculator,
  FileText,
  Coins,
  Layers,
  Shield,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { LoanDetail, Customer } from "../types";
import { LoanDocumentModal } from "../components/LoanDocumentModal";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
type LoanCategory = "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL";
type StandardInterestType = "FLAT" | "REDUCING" | "SIMPLE" | "MANUAL";
type InterestMode = "RATE" | "AMOUNT";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function calcPreview(params: {
  category: LoanCategory;
  principal: number;
  fee: number;
  // Standard
  intType: StandardInterestType;
  intMode: InterestMode;
  intRate: number;
  customInt: number;
  payFreq: Frequency;
  totalInst: number;
  // Advance Interest
  advInt: number;
  advFreq: Frequency;
  advInstAmt: number;
  advInstCount: number;
  // Interest + Principal
  ipFreq: Frequency;
  ipInstCount: number;
  ipPrinPerInst: number;
  ipIntPerInst: number;
}) {
  const p = params.principal;
  const fee = params.fee;

  if (params.category === "ADVANCE_INTEREST") {
    const totalPayable = p;
    const instAmt = params.advInstAmt || (params.advInstCount > 0 ? Math.round(p / params.advInstCount) : 0);
    const customerReceives = Math.max(0, p - params.advInt - fee);
    return {
      principal: p,
      advanceInterest: params.advInt,
      processingFee: fee,
      customerReceives,
      totalInterest: params.advInt,
      totalPayable,
      installmentAmount: instAmt,
      totalInstallments: params.advInstCount,
    };
  }

  if (params.category === "INTEREST_PRINCIPAL") {
    const n = params.ipInstCount || 1;
    const pPerInst = params.ipPrinPerInst || Math.round(p / n);
    const iPerInst = params.ipIntPerInst || 0;
    const instAmt = pPerInst + iPerInst;
    const totalInterest = iPerInst * n;
    const totalPayable = p + totalInterest;
    const customerReceives = Math.max(0, p - fee);
    return {
      principal: p,
      advanceInterest: 0,
      processingFee: fee,
      customerReceives,
      totalInterest,
      totalPayable,
      installmentAmount: instAmt,
      totalInstallments: n,
    };
  }

  // STANDARD
  const n = Math.max(1, params.totalInst);
  let totalInterest = 0;
  if (params.intMode === "AMOUNT") {
    totalInterest = params.customInt;
  } else {
    const rate = params.intRate / 100;
    if (params.intType === "FLAT") {
      totalInterest = p * rate * n;
    } else if (params.intType === "REDUCING") {
      // approximate EMI
      if (rate === 0) {
        totalInterest = 0;
      } else {
        const emi = (p * rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1);
        totalInterest = Math.round(emi * n) - p;
      }
    } else if (params.intType === "SIMPLE") {
      totalInterest = p * rate * n;
    } else {
      // MANUAL — no auto calc
      totalInterest = params.customInt;
    }
  }
  totalInterest = Math.max(0, Math.round(totalInterest));
  const totalPayable = p + totalInterest;
  const instAmt = Math.round(totalPayable / n);
  const customerReceives = Math.max(0, p - fee);
  return {
    principal: p,
    advanceInterest: 0,
    processingFee: fee,
    customerReceives,
    totalInterest,
    totalPayable,
    installmentAmount: instAmt,
    totalInstallments: n,
  };
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export const LoansScreen: React.FC = () => {
  const { language } = useAuth();
  const [loans, setLoans] = useState<LoanDetail[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "OVERDUE" | "CLOSED">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [documentLoan, setDocumentLoan] = useState<LoanDetail | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ── Form State ─────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [loanCategory, setLoanCategory] = useState<LoanCategory>("STANDARD");

  // Common
  const [principalAmount, setPrincipalAmount] = useState("50000");
  const [processingFee, setProcessingFee] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [startDate, setStartDate] = useState(today);
  const [notes, setNotes] = useState("");

  // Guarantor & Collateral (optional — Desktop parity)
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorMobile, setGuarantorMobile] = useState("");
  const [guarantorRelationship, setGuarantorRelationship] = useState("");
  const [collateralType, setCollateralType] = useState("NONE");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralEstimatedValue, setCollateralEstimatedValue] = useState("");

  // Standard
  const [stdIntType, setStdIntType] = useState<StandardInterestType>("FLAT");
  const [stdIntMode, setStdIntMode] = useState<InterestMode>("RATE");
  const [intRate, setIntRate] = useState("2.0");
  const [customIntAmt, setCustomIntAmt] = useState("5000");
  const [intFrequency, setIntFrequency] = useState<Frequency>("MONTHLY");
  const [payFrequency, setPayFrequency] = useState<Frequency>("MONTHLY");
  const [totalInstallments, setTotalInstallments] = useState("10");

  // Advance Interest
  const [advInt, setAdvInt] = useState("15000");
  const [advFreq, setAdvFreq] = useState<Frequency>("DAILY");
  const [advInstAmt, setAdvInstAmt] = useState("1500");
  const [advInstCount, setAdvInstCount] = useState("100");

  // Interest + Principal
  const [ipFreq, setIpFreq] = useState<Frequency>("MONTHLY");
  const [ipInstCount, setIpInstCount] = useState("10");
  const [ipPrinPerInst, setIpPrinPerInst] = useState("10000");
  const [ipIntMode, setIpIntMode] = useState<"AMOUNT" | "RATE">("AMOUNT");
  const [ipIntPerInst, setIpIntPerInst] = useState("2000");
  const [ipIntRate, setIpIntRate] = useState("2.0");

  // ── Data Fetch ──────────────────────────────────────────────
  const fetchLoans = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await api.getLoans(statusFilter === "ALL" ? undefined : statusFilter, searchQuery || undefined);
      setLoans(data.loans || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "கடன்களை ஏற்றுவதில் பிழை");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.getCustomers();
      setCustomers(res.customers || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);
  useEffect(() => {
    if (showCreateModal && customers.length === 0) fetchCustomers();
  }, [showCreateModal, customers.length, fetchCustomers]);

  // ── Defaults on category change ─────────────────────────────
  const handleCategoryChange = (cat: LoanCategory) => {
    setLoanCategory(cat);
    if (cat === "ADVANCE_INTEREST") {
      setPrincipalAmount("150000");
      setAdvInt("15000");
      setAdvFreq("DAILY");
      setAdvInstCount("100");
      setAdvInstAmt("1500");
    } else if (cat === "INTEREST_PRINCIPAL") {
      setPrincipalAmount("100000");
      setIpInstCount("10");
      setIpPrinPerInst("10000");
      setIpIntMode("AMOUNT");
      setIpIntPerInst("2000");
      setIpFreq("MONTHLY");
    } else {
      setPrincipalAmount("50000");
      setStdIntType("FLAT");
      setStdIntMode("RATE");
      setIntRate("2.0");
      setTotalInstallments("10");
      setPayFrequency("MONTHLY");
      setIntFrequency("MONTHLY");
    }
  };

  // ── Live Calculation Preview ────────────────────────────────
  const numPrincipal = Number(principalAmount) || 0;
  const numFee = Number(processingFee) || 0;

  const preview = useMemo(() => calcPreview({
    category: loanCategory,
    principal: numPrincipal,
    fee: numFee,
    intType: stdIntType,
    intMode: stdIntMode,
    intRate: Number(intRate) || 0,
    customInt: Number(customIntAmt) || 0,
    payFreq: payFrequency,
    totalInst: Number(totalInstallments) || 1,
    advInt: Number(advInt) || 0,
    advFreq,
    advInstAmt: Number(advInstAmt) || 0,
    advInstCount: Number(advInstCount) || 1,
    ipFreq,
    ipInstCount: Number(ipInstCount) || 1,
    ipPrinPerInst: Number(ipPrinPerInst) || 0,
    ipIntPerInst: ipIntMode === "AMOUNT"
      ? Number(ipIntPerInst) || 0
      : Math.round((numPrincipal * (Number(ipIntRate) || 0)) / 100),
  }), [
    loanCategory, numPrincipal, numFee, stdIntType, stdIntMode, intRate, customIntAmt,
    payFrequency, totalInstallments, advInt, advFreq, advInstAmt, advInstCount,
    ipFreq, ipInstCount, ipPrinPerInst, ipIntMode, ipIntPerInst, ipIntRate,
  ]);

  // ── Submit ──────────────────────────────────────────────────
  const handleDisburseLoan = async () => {
    setFormLoading(true);
    setFormError(null);
    try {
      const payload: Parameters<typeof api.createLoan>[0] = {
        customerId: selectedCustomerId,
        principalAmount: preview.principal,
        processingFee: numFee || undefined,
        paymentMethod,
        startDate,
        ...( { date: startDate, disbursementDate: startDate } as any ),
        notes: notes.trim() || undefined,
        paymentFrequency: loanCategory === "ADVANCE_INTEREST" ? advFreq : loanCategory === "INTEREST_PRINCIPAL" ? ipFreq : payFrequency,
        totalInstallments: preview.totalInstallments,
      };

      if (loanCategory === "ADVANCE_INTEREST") {
        payload.loanCalculationType = "ADVANCE_INTEREST";
        payload.advanceInterestAmount = preview.advanceInterest;
        payload.customInstallmentAmount = preview.installmentAmount;
        payload.interestType = "MANUAL";
        payload.interestRate = 0;
        payload.interestFrequency = advFreq;
      } else if (loanCategory === "INTEREST_PRINCIPAL") {
        payload.loanCalculationType = "INTEREST_PRINCIPAL";
        payload.principalPerInstallment = Number(ipPrinPerInst) || Math.round(numPrincipal / preview.totalInstallments);
        payload.interestPerInstallment = ipIntMode === "AMOUNT"
          ? Number(ipIntPerInst) || 0
          : Math.round((numPrincipal * (Number(ipIntRate) || 0)) / 100);
        payload.customInterestAmount = preview.totalInterest;
        payload.customInstallmentAmount = preview.installmentAmount;
        payload.interestType = "MANUAL";
        payload.interestRate = ipIntMode === "RATE" ? Number(ipIntRate) : 0;
        payload.interestFrequency = ipFreq;
      } else {
        payload.loanCalculationType = "STANDARD";
        payload.interestType = stdIntType;
        payload.interestRate = stdIntMode === "RATE" ? Number(intRate) || 0 : 0;
        payload.customInterestAmount = stdIntMode === "AMOUNT" ? Number(customIntAmt) || 0 : undefined;
        payload.interestFrequency = intFrequency;
      }

      // Guarantor & Collateral (Desktop parity)
      (payload as any).guarantorName = guarantorName.trim() || undefined;
      (payload as any).guarantorMobile = guarantorMobile.trim() || undefined;
      (payload as any).guarantorRelationship = guarantorRelationship.trim() || undefined;
      (payload as any).collateralType = collateralType === "NONE" ? null : collateralType;
      (payload as any).collateralDescription = collateralDescription.trim() || undefined;
      (payload as any).collateralEstimatedValue = Number(collateralEstimatedValue) || 0;

      const res = await api.createLoan(payload);
      setShowConfirmModal(false);
      setShowCreateModal(false);
      fetchLoans(true);
      setDocumentLoan(res.loan);
      setShowDocModal(true);
    } catch (err: any) {
      console.error("[Admin LoansScreen] Loan disbursement error:", err);
      const isTimeout = err?.message?.includes("timed out") || err?.message?.includes("connect to server") || err?.name === "AbortError";
      const userMsg = isTimeout
        ? (ta ? "கடன் உருவாக்கம் தாமதமானது. மீண்டும் முயற்சிக்கும் முன் கடன் பட்டியலை சரிபார்க்கவும்." : "Loan creation timed out. Please check Loans before retrying.")
        : (err instanceof Error ? (ta ? `கடன் உருவாக்குவதில் தோல்வி: ${err.message}` : `Loan creation failed: ${err.message}`) : (ta ? "கடன் உருவாக்குவதில் தோல்வி" : "Loan creation failed"));
      setFormError(userMsg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) { setFormError("வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்."); return; }
    if (preview.principal <= 0) { setFormError("அசல் தொகை பூஜ்யத்தை விட அதிகமாக இருக்க வேண்டும்."); return; }
    if (preview.customerReceives <= 0) { setFormError("வட்டி / கட்டணம் கடன் தொகையை மீறக்கூடாது."); return; }
    setFormError(null);
    setShowConfirmModal(true);
  };

  // ── Loan Detail ─────────────────────────────────────────────
  const handleOpenLoanDetails = async (loan: LoanDetail) => {
    setSelectedLoan(loan);
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      const full = await api.getLoan(loan.id);
      if (full?.loan) {
        setSelectedLoan({
          ...full.loan,
          installments: ((full.loan.installments?.length ?? 0) > 0)
            ? full.loan.installments
            : ((full.schedule as any)?.length > 0 ? (full.schedule as any) : full.loan.installments || []),
        });
      }
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : "தவணை அட்டவணையை ஏற்றுவதில் பிழை");
    } finally {
      setLoadingSchedule(false);
    }
  };

  const scheduleItems = useMemo(() => {
    if (!selectedLoan) return [];
    const list: any[] = (selectedLoan.installments?.length ?? 0) > 0
      ? selectedLoan.installments!
      : ((selectedLoan as any).schedule?.length > 0 ? (selectedLoan as any).schedule : []);
    return list.map((inst: any, idx: number) => {
      const instNum = inst.installmentNumber ?? inst.installmentNo ?? idx + 1;
      const expectedAmt = Number(inst.installmentAmount ?? inst.amount ?? selectedLoan.installmentAmount ?? 0);
      const prin = Number(inst.principalPortion ?? inst.principal ?? 0);
      const intVal = Number(inst.interestPortion ?? inst.interest ?? 0);
      const paid = Number(inst.paidAmount ?? (inst.status === "PAID" || inst.status === "COLLECTED" ? expectedAmt : 0));
      const bal = Number(inst.balanceAmount ?? Math.max(0, expectedAmt - paid));
      const rawDate = inst.dueDate;
      let dueDateFormatted = "-";
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          dueDateFormatted = !isNaN(d.getTime()) ? d.toLocaleDateString("en-IN") : String(rawDate);
        } catch { dueDateFormatted = String(rawDate); }
      }
      return { id: inst.id || `i-${instNum}`, installmentNumber: instNum, dueDateFormatted, installmentAmount: expectedAmt, principalPortion: prin, interestPortion: intVal, paidAmount: paid, balanceAmount: bal, status: String(inst.status || (bal === 0 ? "COLLECTED" : "PENDING")) };
    });
  }, [selectedLoan]);

  const ta = language === "ta";

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold">{ta ? "கடன் மேலாண்மை" : "Loan Management"}</h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{ta ? "விநியோகம், தவணை & வசூல் அட்டவணை" : "Disbursals, Schedules & Tracking"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => fetchLoans(true)} disabled={refreshing} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition tap-active disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <button type="button" onClick={() => { setShowCreateModal(true); setFormError(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition tap-active shadow-md">
              <Plus className="w-4 h-4" />
              <span>{ta ? "புதிய கடன்" : "New Loan"}</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1.5 mt-4 bg-white/10 p-1 rounded-2xl">
          {(["ACTIVE", "OVERDUE", "CLOSED", "ALL"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setStatusFilter(tab)}
              className={`py-1.5 text-center text-xs font-semibold rounded-xl transition tap-active ${statusFilter === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-300 hover:text-white"}`}>
              {tab === "ACTIVE" ? (ta ? "செயலில்" : "Active") : tab === "OVERDUE" ? (ta ? "தாமதம்" : "Overdue") : tab === "CLOSED" ? (ta ? "முடிந்தது" : "Closed") : (ta ? "அனைத்தும்" : "All")}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder={ta ? "கடன் எண், வாடிக்கையாளர்..." : "Search loan # or customer..."}
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
      </div>

      {/* Loan List */}
      <div className="px-4 mt-4 space-y-3">
        {loading && loans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs">{ta ? "ஏற்றுகிறது..." : "Loading loans..."}</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
          </div>
        ) : loans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Banknote className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{ta ? "கடன்கள் எதுவும் இல்லை" : "No loans found"}</p>
          </div>
        ) : (
          loans.map((loan) => (
            <div key={loan.id} onClick={() => handleOpenLoanDetails(loan)}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 cursor-pointer tap-active hover:border-indigo-200 dark:hover:border-indigo-900 transition space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">{loan.loanNo}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${loan.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600" : loan.status === "OVERDUE" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-500"}`}>{loan.status}</span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{loan.customer?.name || "Customer"}</h2>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">அசல் (Principal)</span>
                  <span className="font-bold text-slate-900 dark:text-white">₹{loan.principalAmount?.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">தவணை</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">₹{loan.installmentAmount?.toLocaleString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">நிலுவை</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">₹{loan.principalOutstanding?.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Loan Details Modal ── */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{selectedLoan.loanNo}</span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedLoan.customer?.name}</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selectedLoan.paymentFrequency} • {selectedLoan.totalInstallments} {ta ? "தவணைகள்" : "installments"}</p>
              </div>
              <button type="button" onClick={() => setSelectedLoan(null)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loan Details Grid */}
            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: ta ? "அசல் தொகை" : "Principal", value: `₹${fmt(selectedLoan.principalAmount || 0)}`, bold: true },
                  { label: ta ? "மொத்த தொகை" : "Total Payable", value: `₹${fmt(selectedLoan.totalPayable || 0)}`, bold: true },
                  { label: ta ? "வாடிக்கையாளர் பெற்றது" : "Customer Received", value: `₹${fmt(selectedLoan.customerReceives || selectedLoan.principalAmount || 0)}` },
                  { label: ta ? "தவணை தொகை" : "Installment", value: `₹${fmt(selectedLoan.installmentAmount || 0)}`, color: "text-indigo-600" },
                  { label: ta ? "வட்டி முறை" : "Interest Method", value: `${selectedLoan.interestType || "-"} (${selectedLoan.loanCalculationType || "STANDARD"})` },
                  { label: ta ? "வட்டி விகிதம்" : "Interest Rate", value: selectedLoan.interestRate ? `${selectedLoan.interestRate}%` : "Custom" },
                  { label: ta ? "வசூலிக்கப்பட்டது" : "Collected", value: `₹${fmt((selectedLoan.principalPaid || 0) + (selectedLoan.interestPaid || 0))}`, color: "text-emerald-600" },
                  { label: ta ? "மீதமுள்ள நிலுவை" : "Outstanding", value: `₹${fmt((selectedLoan.principalOutstanding || 0) + (selectedLoan.interestOutstanding || 0))}`, color: "text-amber-600" },
                ].map((item) => (
                  <div key={item.label}>
                    <span className="text-slate-400 text-[11px] block">{item.label}</span>
                    <span className={`font-bold ${item.color || "text-slate-900 dark:text-white"} ${item.bold ? "text-base" : ""}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Installment Schedule */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{ta ? "தவணை அட்டவணை" : "Installment Schedule"}</h4>
                {scheduleItems.length > 0 && <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{scheduleItems.length} {ta ? "தவணைகள்" : "installments"}</span>}
              </div>
              {loadingSchedule ? (
                <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                  <p>{ta ? "ஏற்றுகிறது..." : "Loading schedule..."}</p>
                </div>
              ) : scheduleError ? (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-600 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold"><AlertCircle className="w-4 h-4" /><span>{scheduleError}</span></div>
                  <button type="button" onClick={() => handleOpenLoanDetails(selectedLoan)} className="px-3 py-1.5 bg-red-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 tap-active">
                    <RefreshCw className="w-3.5 h-3.5" /><span>{ta ? "மீண்டும் முயற்சி" : "Retry"}</span>
                  </button>
                </div>
              ) : scheduleItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">{ta ? "அட்டவணை இல்லை" : "No schedule loaded"}</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-2 text-center">#</th>
                        <th className="py-2.5 px-2">{ta ? "தேதி" : "Due Date"}</th>
                        <th className="py-2.5 px-2 text-right">{ta ? "தொகை" : "Amount"}</th>
                        <th className="py-2.5 px-2 text-right">{ta ? "அசல்" : "Principal"}</th>
                        <th className="py-2.5 px-2 text-right">{ta ? "வட்டி" : "Interest"}</th>
                        <th className="py-2.5 px-2 text-right">{ta ? "செலுத்தியது" : "Paid"}</th>
                        <th className="py-2.5 px-2 text-right">{ta ? "நிலுவை" : "Balance"}</th>
                        <th className="py-2.5 px-2 text-center">{ta ? "நிலை" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {scheduleItems.map((inst) => {
                        const isPaid = inst.status === "PAID" || inst.status === "COLLECTED";
                        const isPartial = inst.status === "PARTIAL" || inst.status === "PARTIALLY_PAID";
                        const isOverdue = inst.status === "OVERDUE";
                        return (
                          <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2 px-2 text-center font-bold text-indigo-600">#{inst.installmentNumber}</td>
                            <td className="py-2 px-2 font-sans text-slate-700 dark:text-slate-300 text-[11px]">{inst.dueDateFormatted}</td>
                            <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-white">₹{fmt(inst.installmentAmount)}</td>
                            <td className="py-2 px-2 text-right text-slate-600">₹{fmt(inst.principalPortion)}</td>
                            <td className="py-2 px-2 text-right text-amber-600">₹{fmt(inst.interestPortion)}</td>
                            <td className="py-2 px-2 text-right font-bold text-emerald-600">₹{fmt(inst.paidAmount)}</td>
                            <td className="py-2 px-2 text-right font-bold text-slate-800 dark:text-slate-200">₹{fmt(inst.balanceAmount)}</td>
                            <td className="py-2 px-2 text-center font-sans">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isPaid ? "bg-emerald-50 text-emerald-600" : isPartial ? "bg-blue-50 text-blue-600" : isOverdue ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>{inst.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Document Button */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => { setDocumentLoan({ ...selectedLoan, installments: scheduleItems.length > 0 ? (scheduleItems as any) : selectedLoan.installments }); setShowDocModal(true); }}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md tap-active">
                <FileText className="w-4 h-4" />
                <span>{ta ? "கடன் அனுமதி ஆவணம் (PDF & WhatsApp)" : "Sanction Order (PDF & WhatsApp)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Loan Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[95vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{ta ? "புதிய கடன் வழங்குதல்" : "Issue New Loan"}</h3>
                <p className="text-xs text-slate-400">{ta ? "முழு கடன் கணக்கீடு" : "Full Loan Creation Engine"}</p>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                </div>
              )}

              {/* 1. Customer Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{ta ? "வாடிக்கையாளர் *" : "Select Borrower *"}</label>
                <select required value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500">
                  <option value="">-- {ta ? "தேர்ந்தெடுக்கவும்" : "Select Customer"} --</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.mobile})</option>)}
                </select>
              </div>

              {/* 2. Loan Category */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{ta ? "கடன் வகை *" : "Loan Type *"}</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["STANDARD", "ADVANCE_INTEREST", "INTEREST_PRINCIPAL"] as LoanCategory[]).map((cat) => {
                    const labels: Record<LoanCategory, { en: string; ta: string; icon: React.ReactNode; color: string }> = {
                      STANDARD: { en: "Standard", ta: "நிலையான", icon: <Coins className="w-3.5 h-3.5" />, color: "indigo" },
                      ADVANCE_INTEREST: { en: "Advance Interest", ta: "முன் வட்டி", icon: <Banknote className="w-3.5 h-3.5" />, color: "emerald" },
                      INTEREST_PRINCIPAL: { en: "Interest + Principal", ta: "அசல் + வட்டி", icon: <Layers className="w-3.5 h-3.5" />, color: "amber" },
                    };
                    const l = labels[cat];
                    const active = loanCategory === cat;
                    const colorMap: Record<string, string> = {
                      indigo: active ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40" : "border-slate-200 dark:border-slate-700",
                      emerald: active ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40" : "border-slate-200 dark:border-slate-700",
                      amber: active ? "border-amber-600 bg-amber-50 dark:bg-amber-950/40" : "border-slate-200 dark:border-slate-700",
                    };
                    return (
                      <button key={cat} type="button" onClick={() => handleCategoryChange(cat)}
                        className={`p-2.5 rounded-xl border text-left transition tap-active ${colorMap[l.color]}`}>
                        <div className={`flex items-center gap-1 mb-0.5 font-bold text-[11px] ${active ? (l.color === "indigo" ? "text-indigo-700" : l.color === "emerald" ? "text-emerald-700" : "text-amber-700") : "text-slate-500"}`}>
                          {l.icon}<span>{ta ? l.ta : l.en}</span>
                        </div>
                        {active && <span className={`text-[9px] font-bold ${l.color === "indigo" ? "text-indigo-600" : l.color === "emerald" ? "text-emerald-600" : "text-amber-600"}`}>✓ {ta ? "தேர்ந்தெடுக்கப்பட்டது" : "Selected"}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3a. Standard Loan Fields */}
              {loanCategory === "STANDARD" && (
                <div className="space-y-4 p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "அசல் தொகை (₹) *" : "Principal Amount (₹) *"}</label>
                      <input type="number" required value={principalAmount} onChange={(e) => setPrincipalAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வட்டி கணக்கீடு முறை *" : "Interest Method *"}</label>
                      <select value={stdIntType} onChange={(e) => setStdIntType(e.target.value as StandardInterestType)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500">
                        <option value="FLAT">Flat (விகித வட்டி)</option>
                        <option value="REDUCING">Reducing / EMI</option>
                        <option value="SIMPLE">Simple (எளிய வட்டி)</option>
                        <option value="MANUAL">Manual (கையால்)</option>
                      </select>
                    </div>
                  </div>

                  {/* Interest Mode Toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{ta ? "வட்டி நிர்ணய முறை" : "Interest Mode"}</span>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-semibold">
                        {(["RATE", "AMOUNT"] as InterestMode[]).map((m) => (
                          <button key={m} type="button" onClick={() => setStdIntMode(m)}
                            className={`px-2.5 py-1 rounded-md transition ${stdIntMode === m ? "bg-indigo-600 text-white" : "text-slate-500"}`}>
                            {m === "RATE" ? "% Rate" : "₹ Amount"}
                          </button>
                        ))}
                      </div>
                    </div>
                    {stdIntMode === "RATE" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "வட்டி விகிதம் (%) *" : "Interest Rate (%) *"}</label>
                          <input type="number" step="0.01" value={intRate} onChange={(e) => setIntRate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "விகித காலம்" : "Rate Periodicity"}</label>
                          <select value={intFrequency} onChange={(e) => setIntFrequency(e.target.value as Frequency)}
                            className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500">
                            <option value="MONTHLY">Monthly (மாத %)</option>
                            <option value="DAILY">Daily (நாள் %)</option>
                            <option value="WEEKLY">Weekly (வார %)</option>
                            <option value="YEARLY">Yearly (ஆண்டு %)</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "மொத்த வட்டி தொகை (₹) *" : "Total Interest Amount (₹) *"}</label>
                        <input type="number" value={customIntAmt} onChange={(e) => setCustomIntAmt(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-amber-600 focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல் முறை *" : "Collection Frequency *"}</label>
                      <select value={payFrequency} onChange={(e) => setPayFrequency(e.target.value as Frequency)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500">
                        <option value="DAILY">Daily (தினசரி)</option>
                        <option value="WEEKLY">Weekly (வாராந்திர)</option>
                        <option value="MONTHLY">Monthly (மாதாந்திர)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "மொத்த தவணைகள் *" : "Total Installments *"}</label>
                      <input type="number" required value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* 3b. Advance Interest Fields */}
              {loanCategory === "ADVANCE_INTEREST" && (
                <div className="space-y-4 p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "கடன் தொகை / முக மதிப்பு (₹) *" : "Face / Loan Principal (₹) *"}</label>
                      <input type="number" required value={principalAmount} onChange={(e) => { setPrincipalAmount(e.target.value); const p = Number(e.target.value) || 0; const n = Math.max(1, Number(advInstCount) || 1); setAdvInstAmt(String(Math.round(p / n))); }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "முன்கூட்டி கழிக்கப்படும் வட்டி (₹) *" : "Advance Interest Deducted (₹) *"}</label>
                      <input type="number" required value={advInt} onChange={(e) => setAdvInt(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-sm font-bold text-amber-600 focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>

                  {/* Customer Receives Preview */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 grid grid-cols-3 gap-2 text-xs font-mono">
                    <div><span className="text-[10px] text-slate-500 block">முக தொகை</span><span className="font-bold">₹{fmt(numPrincipal)}</span></div>
                    <div><span className="text-[10px] text-slate-500 block">- முன் வட்டி</span><span className="font-bold text-amber-600">-₹{fmt(Number(advInt) || 0)}</span></div>
                    <div><span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block">வாடிக்கையாளர் பெறும்</span><span className="font-black text-emerald-600">₹{fmt(Math.max(0, numPrincipal - (Number(advInt) || 0) - numFee))}</span></div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல் முறை *" : "Frequency *"}</label>
                      <select value={advFreq} onChange={(e) => setAdvFreq(e.target.value as Frequency)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs focus:ring-2 focus:ring-emerald-500">
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல் தொகை (₹) *" : "Collection Amount (₹) *"}</label>
                      <input type="number" required value={advInstAmt} onChange={(e) => { setAdvInstAmt(e.target.value); const amt = Number(e.target.value) || 1; if (amt > 0) setAdvInstCount(String(Math.ceil(numPrincipal / amt))); }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs font-bold focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல்கள் எண்ணிக்கை *" : "No. of Collections *"}</label>
                      <input type="number" required value={advInstCount} onChange={(e) => { setAdvInstCount(e.target.value); const n = Math.max(1, Number(e.target.value) || 1); setAdvInstAmt(String(Math.round(numPrincipal / n))); }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs font-bold focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* 3c. Interest + Principal Fields */}
              {loanCategory === "INTEREST_PRINCIPAL" && (
                <div className="space-y-4 p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "அசல் தொகை (₹) *" : "Principal (₹) *"}</label>
                      <input type="number" required value={principalAmount} onChange={(e) => { setPrincipalAmount(e.target.value); const p = Number(e.target.value) || 0; const n = Math.max(1, Number(ipInstCount) || 1); setIpPrinPerInst(String(Math.round(p / n))); }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல் முறை *" : "Frequency *"}</label>
                      <select value={ipFreq} onChange={(e) => setIpFreq(e.target.value as Frequency)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-xs focus:ring-2 focus:ring-amber-500">
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "தவணைகள் *" : "Installments *"}</label>
                      <input type="number" required value={ipInstCount} onChange={(e) => { setIpInstCount(e.target.value); const n = Math.max(1, Number(e.target.value) || 1); setIpPrinPerInst(String(Math.round(numPrincipal / n))); }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-xs font-bold focus:ring-2 focus:ring-amber-500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300">{ta ? "தவணை விரிவு (அசல் + வட்டி)" : "Per Installment Breakup"}</span>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-amber-300 text-[10px]">
                        {(["AMOUNT", "RATE"] as const).map((m) => (
                          <button key={m} type="button" onClick={() => setIpIntMode(m)}
                            className={`px-2 py-0.5 rounded ${ipIntMode === m ? "bg-amber-600 text-white font-bold" : "text-slate-600"}`}>
                            {m === "AMOUNT" ? "₹ Fixed" : "% Rate"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "தவணைக்கு அசல் (₹)" : "Principal / Due (₹)"}</label>
                        <input type="number" value={ipPrinPerInst} onChange={(e) => setIpPrinPerInst(e.target.value)}
                          className="w-full px-2 py-2 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 text-xs font-bold focus:ring-2 focus:ring-amber-500" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ipIntMode === "AMOUNT" ? (ta ? "தவணைக்கு வட்டி (₹)" : "Interest / Due (₹)") : (ta ? "வட்டி விகிதம் (%)" : "Interest Rate (%)")}</label>
                        {ipIntMode === "AMOUNT" ? (
                          <input type="number" value={ipIntPerInst} onChange={(e) => setIpIntPerInst(e.target.value)}
                            className="w-full px-2 py-2 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 text-xs font-bold text-amber-600 focus:ring-2 focus:ring-amber-500" />
                        ) : (
                          <input type="number" step="0.01" value={ipIntRate} onChange={(e) => { setIpIntRate(e.target.value); const r = Number(e.target.value) || 0; setIpIntPerInst(String(Math.round((numPrincipal * r) / 100))); }}
                            className="w-full px-2 py-2 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 text-xs font-bold text-amber-600 focus:ring-2 focus:ring-amber-500" />
                        )}
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500">Total / Due</span>
                        <span className="text-sm font-black text-emerald-600">₹{fmt(Number(ipPrinPerInst || 0) + (ipIntMode === "AMOUNT" ? Number(ipIntPerInst || 0) : Math.round((numPrincipal * (Number(ipIntRate) || 0)) / 100)))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Common Fields */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "விநியோக முறை" : "Disbursement"}</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500">
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank / NEFT</option>
                    <option value="UPI">UPI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "கட்டண கட்டணம் (₹)" : "Processing Fee (₹)"}</label>
                  <input type="number" value={processingFee} onChange={(e) => setProcessingFee(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" />{ta ? "கடன் / வழங்கிய தேதி *" : "Loan / Disbursement Date *"}</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:ring-2 focus:ring-indigo-500" />
                  <span className="block text-[9px] text-slate-400 mt-0.5">{ta ? "தவணை அட்டவணை இந்த தேதியிலிருந்து தொடங்கும்" : "Schedule calculated from this date"}</span>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "குறிப்புகள் / விதிமுறைகள்" : "Notes / Terms (optional)"}</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder={ta ? "கடன் குறிப்பு..." : "e.g. Daily shop loan"}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500" />
              </div>

              {/* Guarantor & Collateral — Desktop Parity (optional) */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Shield className="w-4 h-4 text-amber-600" />
                  <span>{ta ? "ஜாமீன்தாரர் மற்றும் பிணையம் (விருப்பமானது)" : "Guarantor & Collateral (Optional)"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "ஜாமீன்தாரர் பெயர்" : "Guarantor Name"}</label>
                    <input type="text" value={guarantorName} onChange={(e) => setGuarantorName(e.target.value)}
                      placeholder="Name"
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "தொலைபேசி" : "Mobile"}</label>
                    <input type="text" value={guarantorMobile} onChange={(e) => setGuarantorMobile(e.target.value)}
                      placeholder="Mobile"
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "உறவு" : "Relationship"}</label>
                    <input type="text" value={guarantorRelationship} onChange={(e) => setGuarantorRelationship(e.target.value)}
                      placeholder="Brother"
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "பிணையம் வகை" : "Collateral Type"}</label>
                    <select value={collateralType} onChange={(e) => setCollateralType(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                      <option value="NONE">None (Unsecured)</option>
                      <option value="GOLD">Gold</option>
                      <option value="VEHICLE">Vehicle RC</option>
                      <option value="PROPERTY">Property Document</option>
                      <option value="DOCUMENTS">Cheques / Promissory Note</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  {collateralType !== "NONE" && (
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "பிணையம் விவரம்" : "Description"}</label>
                      <input type="text" value={collateralDescription} onChange={(e) => setCollateralDescription(e.target.value)}
                        placeholder="e.g. 24g Gold Chain"
                        className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs" />
                    </div>
                  )}
                </div>
                {collateralType !== "NONE" && (
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ta ? "மதிப்பீட்டு மதிப்பு (₹)" : "Estimated Value (₹)"}</label>
                    <input type="number" value={collateralEstimatedValue} onChange={(e) => setCollateralEstimatedValue(e.target.value)}
                      placeholder="120000"
                      className="w-full px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono" />
                  </div>
                )}
              </div>

              {/* 5. Calculation Preview */}
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <Calculator className="w-4 h-4" />
                  <span>{ta ? "கடன் கணக்கீடு முன்காட்சி" : "Instant Calculation Preview"}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded text-[10px] ${loanCategory === "ADVANCE_INTEREST" ? "bg-emerald-100 text-emerald-800" : loanCategory === "INTEREST_PRINCIPAL" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"}`}>
                    {loanCategory === "ADVANCE_INTEREST" ? "Advance Interest" : loanCategory === "INTEREST_PRINCIPAL" ? "Interest + Principal" : "Standard"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-indigo-200 dark:border-indigo-900 pt-3">
                  {[
                    { label: ta ? "அசல் தொகை" : "Principal", value: `₹${fmt(preview.principal)}` },
                    loanCategory === "ADVANCE_INTEREST"
                      ? { label: ta ? "முன் வட்டி" : "Advance Interest", value: `-₹${fmt(preview.advanceInterest)}`, color: "text-amber-600" }
                      : { label: ta ? "மொத்த வட்டி" : "Total Interest", value: `₹${fmt(preview.totalInterest)}`, color: "text-amber-600" },
                    { label: ta ? "கட்டண கட்டணம்" : "Processing Fee", value: preview.processingFee > 0 ? `-₹${fmt(preview.processingFee)}` : "Nil" },
                    { label: ta ? "வாடிக்கையாளர் பெறும்" : "Customer Receives", value: `₹${fmt(preview.customerReceives)}`, color: "text-emerald-600", bold: true },
                    { label: ta ? "மொத்த திரும்பச் செலுத்தல்" : "Total Payable", value: `₹${fmt(preview.totalPayable)}`, bold: true },
                    { label: ta ? "தவணை தொகை" : "Installment Due", value: `₹${fmt(preview.installmentAmount)}`, color: "text-indigo-600", bold: true },
                  ].map((item, i) => (
                    <div key={i} className={`${item.bold ? "bg-white dark:bg-slate-900 p-2 rounded-xl border border-indigo-200 dark:border-indigo-800" : ""}`}>
                      <span className="text-slate-500 block text-[10px]">{item.label}</span>
                      <span className={`font-bold ${item.color || "text-slate-800 dark:text-slate-200"} ${item.bold ? "text-sm" : ""}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-indigo-600 font-semibold text-right">
                  {preview.totalInstallments} {
                    loanCategory === "ADVANCE_INTEREST" ? advFreq : loanCategory === "INTEREST_PRINCIPAL" ? ipFreq : payFrequency
                  } {ta ? "தவணைகள்" : "installments"}
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2 pb-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="w-1/3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 tap-active">
                  {ta ? "ரத்து" : "Cancel"}
                </button>
                <button type="submit" disabled={formLoading}
                  className="w-2/3 py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-500 tap-active disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{formLoading ? (ta ? "வழங்குகிறது..." : "Processing...") : (ta ? "கடன் உறுதிப்படுத்து" : "Review & Confirm")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950 rounded-2xl">
                <Shield className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{ta ? "கடன் வழங்குதல் உறுதிப்படுத்தல்" : "Confirm Loan Disbursement"}</h3>
                <p className="text-xs text-slate-500">{ta ? "இந்த செயல் மாற்ற இயலாது" : "This action cannot be undone"}</p>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-2 text-xs font-mono">
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "வாடிக்கையாளர்" : "Customer"}</span><span className="font-bold text-slate-900 dark:text-white">{customers.find(c => c.id === selectedCustomerId)?.name || "-"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "கடன் வகை" : "Loan Type"}</span><span className="font-bold">{loanCategory}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "அசல் தொகை" : "Principal"}</span><span className="font-bold text-indigo-600">₹{fmt(preview.principal)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "வாடிக்கையாளர் பெறும்" : "Customer Receives"}</span><span className="font-bold text-emerald-600">₹{fmt(preview.customerReceives)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "மொத்த திரும்பச் செலுத்தல்" : "Total Payable"}</span><span className="font-bold text-slate-800 dark:text-slate-200">₹{fmt(preview.totalPayable)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "தவணை" : "Installment"}</span><span className="font-bold text-indigo-600">₹{fmt(preview.installmentAmount)} × {preview.totalInstallments}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "தொடக்க தேதி" : "Start Date"}</span><span className="font-bold">{startDate}</span></div>
            </div>
            {formError && <div className="p-3 rounded-xl bg-red-50 text-red-600 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4" /><span>{formError}</span></div>}
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowConfirmModal(false)}
                className="w-1/2 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 tap-active">
                {ta ? "திரும்பு" : "Go Back"}
              </button>
              <button type="button" onClick={handleDisburseLoan} disabled={formLoading}
                className="w-1/2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md tap-active disabled:opacity-50 flex items-center justify-center gap-2">
                <Banknote className="w-4 h-4" />
                <span>{formLoading ? (ta ? "வழங்குகிறது..." : "Disbursing Loan...") : (ta ? "கடன் வழங்கு" : "Disburse Now")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Sanction Document Modal */}
      {showDocModal && documentLoan && (
        <LoanDocumentModal isOpen={showDocModal} loan={documentLoan} onClose={() => { setShowDocModal(false); setDocumentLoan(null); }} />
      )}
    </div>
  );
};
