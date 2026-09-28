import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText,
  Search,
  ChevronRight,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Plus,
  Banknote,
  Coins,
  Layers,
  Calculator,
  Calendar,
  Shield,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { LoanDetail, Customer } from "../types";
import { LoanDocumentModal } from "../components/LoanDocumentModal";
import { calculateLoan, LoanCalculationResult, ScheduleItem } from "../services/calculator";
import { getTodayIST, formatISTDisplay, parseISTDate } from "../utils/date";

// ─────────────────────────────────────────────────────────────
// Helpers (Authoritative calculation engine matching Desktop)
// ─────────────────────────────────────────────────────────────
type LoanCategory = "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL";
type StandardInterestType = "FLAT" | "REDUCING" | "SIMPLE" | "MANUAL";
type InterestMode = "RATE" | "AMOUNT";
type Frequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function formatDateDMY(dateStr?: string | Date): string {
  return formatISTDisplay(dateStr);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
export const LoansScreen: React.FC = () => {
  const { language } = useAuth();
  const ta = language === "ta";

  const [loans, setLoans] = useState<LoanDetail[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);

  // Create Loan Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [loanCategory, setLoanCategory] = useState<LoanCategory>("STANDARD");

  const [principalAmount, setPrincipalAmount] = useState("50000");
  const [processingFee, setProcessingFee] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [startDate, setStartDate] = useState(() => getTodayIST());
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

  // ── Fetch ──────────────────────────────────────────────────
  const fetchLoans = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await api.getLoans(statusFilter, search.trim() || undefined);
      setLoans(res.loans || []);
    } catch (err) { console.error("Failed to fetch loans:", err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [statusFilter, search]);

  const fetchCustomers = useCallback(async () => {
    try { const res = await api.getCustomers(); setCustomers(res.customers || []); }
    catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);
  useEffect(() => { if (showCreateModal && customers.length === 0) fetchCustomers(); }, [showCreateModal, customers.length, fetchCustomers]);

  // ── Category Defaults ──────────────────────────────────────
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
      setIpIntRate("2.0");
    } else {
      setPrincipalAmount("50000");
      setStdIntType("FLAT");
      setStdIntMode("RATE");
      setIntRate("2.0");
      setTotalInstallments("10");
      setPayFrequency("MONTHLY");
      setIntFrequency("MONTHLY");
      setCustomIntAmt("5000");
    }
  };

  const numPrincipal = Number(principalAmount) || 0;
  const numFee = Number(processingFee) || 0;

  const calcResult: LoanCalculationResult = useMemo(() => {
    const loanDate = startDate ? parseISTDate(startDate) : parseISTDate(getTodayIST());

    if (loanCategory === "ADVANCE_INTEREST") {
      const n = Math.max(1, Number(advInstCount) || 1);
      const amt = Number(advInstAmt) || (n > 0 ? Math.round(numPrincipal / n) : 0);
      return calculateLoan({
        principal: numPrincipal,
        loanCalculationType: "ADVANCE_INTEREST",
        advanceInterestAmount: Number(advInt) || 0,
        totalInstallments: n,
        customInstallmentAmount: amt,
        paymentFrequency: advFreq as "DAILY" | "WEEKLY" | "MONTHLY",
        processingFee: numFee,
        startDate: loanDate,
      });
    }

    if (loanCategory === "INTEREST_PRINCIPAL") {
      const n = Math.max(1, Number(ipInstCount) || 1);
      const pPerInst = Number(ipPrinPerInst) || Math.round(numPrincipal / n);
      let iPerInst = 0;
      if (ipIntMode === "AMOUNT") {
        iPerInst = Number(ipIntPerInst) || 0;
      } else {
        iPerInst = Math.round((numPrincipal * (Number(ipIntRate) || 0)) / 100);
      }
      return calculateLoan({
        principal: numPrincipal,
        loanCalculationType: "INTEREST_PRINCIPAL",
        totalInstallments: n,
        principalPerInstallment: pPerInst,
        interestPerInstallment: iPerInst,
        customInterestAmount: iPerInst * n,
        paymentFrequency: ipFreq as "DAILY" | "WEEKLY" | "MONTHLY",
        processingFee: numFee,
        startDate: loanDate,
      });
    }

    // STANDARD
    return calculateLoan({
      principal: numPrincipal,
      loanCalculationType: "STANDARD",
      interestType: stdIntType,
      interestRate: stdIntMode === "RATE" ? Number(intRate) || 0 : 0,
      customInterestAmount: stdIntMode === "AMOUNT" ? Number(customIntAmt) || 0 : undefined,
      interestFrequency: intFrequency,
      paymentFrequency: payFrequency as "DAILY" | "WEEKLY" | "MONTHLY",
      totalInstallments: Math.max(1, Number(totalInstallments) || 1),
      processingFee: numFee,
      startDate: loanDate,
    });
  }, [
    loanCategory, numPrincipal, numFee, startDate,
    advInt, advInstCount, advInstAmt, advFreq,
    ipInstCount, ipPrinPerInst, ipIntMode, ipIntPerInst, ipIntRate, ipFreq,
    stdIntType, stdIntMode, intRate, customIntAmt, intFrequency, payFrequency, totalInstallments,
  ]);

  // ── Disburse ───────────────────────────────────────────────
  const handleDisburseLoan = async () => {
    setFormLoading(true);
    setFormError(null);
    try {
      const payload: Parameters<typeof api.createLoan>[0] = {
        customerId: selectedCustomerId,
        principalAmount: calcResult.principal,
        processingFee: numFee || undefined,
        paymentMethod,
        startDate,
        date: startDate,
        disbursementDate: startDate,
        notes: notes.trim() || undefined,
        paymentFrequency: loanCategory === "ADVANCE_INTEREST" ? advFreq : loanCategory === "INTEREST_PRINCIPAL" ? ipFreq : payFrequency,
        totalInstallments: calcResult.totalInstallments,
      };
      if (loanCategory === "ADVANCE_INTEREST") {
        payload.loanCalculationType = "ADVANCE_INTEREST";
        payload.advanceInterestAmount = calcResult.advanceInterest;
        payload.customInstallmentAmount = calcResult.installmentAmount;
        payload.interestType = "MANUAL";
        payload.interestRate = 0;
        payload.interestFrequency = advFreq;
      } else if (loanCategory === "INTEREST_PRINCIPAL") {
        payload.loanCalculationType = "INTEREST_PRINCIPAL";
        payload.principalPerInstallment = calcResult.schedule[0]?.principalPortion || Math.round(numPrincipal / calcResult.totalInstallments);
        payload.interestPerInstallment = calcResult.schedule[0]?.interestPortion || 0;
        payload.customInterestAmount = calcResult.totalInterest;
        payload.customInstallmentAmount = calcResult.installmentAmount;
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
      payload.guarantorName = guarantorName.trim() || undefined;
      payload.guarantorMobile = guarantorMobile.trim() || undefined;
      payload.guarantorRelationship = guarantorRelationship.trim() || undefined;
      payload.collateralType = collateralType === "NONE" ? null : collateralType;
      payload.collateralDescription = collateralDescription.trim() || undefined;
      payload.collateralEstimatedValue = Number(collateralEstimatedValue) || 0;

      const res = await api.createLoan(payload);
      setShowConfirmModal(false);
      setShowCreateModal(false);
      fetchLoans(true);
      setSelectedLoan(res.loan);
      setShowDocModal(true);
    } catch (err: any) {
      console.error("[Partner LoansScreen] Loan disbursement error:", err);
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
    if (!selectedCustomerId) { setFormError(ta ? "வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்." : "Please select a customer."); return; }
    if (calcResult.principal <= 0) { setFormError(ta ? "அசல் தொகை பூஜ்யத்தை விட அதிகமாக இருக்க வேண்டும்." : "Principal must be greater than zero."); return; }
    if (calcResult.customerReceives <= 0) { setFormError(ta ? "வட்டி / கட்டணம் கடன் தொகையை மீறக்கூடாது." : "Interest/fee cannot exceed principal."); return; }
    setFormError(null);
    setShowConfirmModal(true);
  };

  // ── Loan Detail ────────────────────────────────────────────
  const handleOpenLoanDetail = async (loanId: string) => {
    setLoadingDetail(true);
    try {
      const res = await api.getLoan(loanId);
      setSelectedLoan({
        ...res.loan,
        installments: ((res.loan.installments?.length ?? 0) > 0) ? res.loan.installments : ((res as any).schedule?.length > 0 ? (res as any).schedule : res.loan.installments || []),
      });
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to load loan details"); }
    finally { setLoadingDetail(false); }
  };

  const scheduleItems = useMemo(() => {
    if (!selectedLoan) return [];
    const list: any[] = (selectedLoan.installments?.length ?? 0) > 0
      ? [...selectedLoan.installments!].sort((a, b) => (Number((a as any).installmentNumber ?? (a as any).installmentNo ?? 0) - Number((b as any).installmentNumber ?? (b as any).installmentNo ?? 0)))
      : ((selectedLoan as any).schedule?.length > 0 ? [...(selectedLoan as any).schedule].sort((a: any, b: any) => (Number(a.installmentNumber ?? a.installmentNo ?? 0) - Number(b.installmentNumber ?? b.installmentNo ?? 0))) : []);

    const isAdvInt = selectedLoan.loanCalculationType === "ADVANCE_INTEREST" || Boolean((selectedLoan as any).advanceInterest && (selectedLoan as any).advanceInterest > 0);
    const loanPrincipal = Number(selectedLoan.principalAmount || 0);

    let cumulativeScheduledPrincipal = 0;

    return list.map((inst: any, idx: number) => {
      const instNum = inst.installmentNumber ?? inst.installmentNo ?? idx + 1;
      const expectedAmt = Number(inst.installmentAmount ?? inst.amount ?? selectedLoan.installmentAmount ?? 0);
      const prin = Number(inst.principalPortion ?? inst.principal ?? (isAdvInt ? expectedAmt : (loanPrincipal / (selectedLoan.totalInstallments || 1))));
      const intVal = Number(inst.interestPortion ?? inst.interest ?? 0);
      const paid = Number(inst.paidAmount ?? (inst.status === "PAID" || inst.status === "COLLECTED" ? expectedAmt : 0));
      const instBal = Number(inst.installmentBalance !== undefined ? inst.installmentBalance : Math.max(0, expectedAmt - paid));

      cumulativeScheduledPrincipal += prin;

      // Authoritative per-installment cumulative scheduled loan principal projection:
      // "PROJECTED PRINCIPAL OUTSTANDING AFTER THIS INSTALLMENT IS PAID"
      // MAX(0, loanPrincipal - cumulativeScheduledPrincipalThroughThisInstallment)
      const projectedBalance = (inst.projectedBalance !== undefined && inst.projectedBalance !== null)
        ? Number(inst.projectedBalance)
        : Math.max(0, Math.round((loanPrincipal - cumulativeScheduledPrincipal) * 100) / 100);

      const rawDate = inst.dueDate;
      let dueDateFormatted = "-";
      if (rawDate) {
        try {
          const str = String(rawDate).trim().slice(0, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            const [y, m, day] = str.split("-");
            dueDateFormatted = `${day}/${m}/${y}`;
          } else {
            const d = new Date(rawDate);
            dueDateFormatted = !isNaN(d.getTime())
              ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "2-digit", year: "numeric" }).format(d)
              : String(rawDate);
          }
        } catch { dueDateFormatted = String(rawDate); }
      }
      return {
        id: inst.id || `i-${instNum}`,
        installmentNumber: instNum,
        dueDate: rawDate,
        dueDateFormatted,
        installmentAmount: expectedAmt,
        principalPortion: prin,
        interestPortion: intVal,
        paidAmount: paid,
        installmentBalance: instBal,
        projectedBalance,
        loanOutstandingAfterInstallment: projectedBalance,
        cumulativePrincipalOutstanding: projectedBalance,
        balanceAmount: projectedBalance,
        loanOutstanding: projectedBalance,
        status: String(inst.status || (paid >= expectedAmt ? "COLLECTED" : (paid > 0 ? "PARTIALLY_PAID" : "PENDING"))),
      };
    });
  }, [selectedLoan]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-3 sticky top-0 z-30 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{ta ? "கடன்கள் பட்டியல்" : "Loans Directory"}</h1>
            <p className="text-xs text-slate-500">{ta ? "வாடிக்கையாளர் கடன் விவரங்கள்" : "Customer loan portfolios"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => fetchLoans(true)} disabled={refreshing} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tap-active disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            {/* Partner CAN create loans */}
            <button type="button" onClick={() => { setShowCreateModal(true); setFormError(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition tap-active shadow-md">
              <Plus className="w-4 h-4" />
              <span>{ta ? "புதிய கடன்" : "New Loan"}</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder={ta ? "கடன் எண் / பெயர்..." : "Search loan # or customer..."}
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {["ALL", "ACTIVE", "OVERDUE", "CLOSED"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition tap-active ${statusFilter === s ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}>
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
            <p>{ta ? "கடன்கள் ஏற்றப்படுகிறது..." : "Loading loans..."}</p>
          </div>
        ) : loans.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{ta ? "கடன்கள் எதுவும் கிடைக்கவில்லை" : "No loans found"}</p>
          </div>
        ) : (
          loans.map((loan) => (
            <div key={loan.id} onClick={() => handleOpenLoanDetail(loan.id)}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-3 cursor-pointer tap-active">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded">{loan.loanNo}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${loan.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : loan.status === "OVERDUE" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-800"}`}>{loan.status}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm mt-1.5">{loan.customer?.name}</h3>
                  <p className="text-xs text-slate-500">{loan.customer?.mobile}</p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">{ta ? "அசல்" : "Principal"}</span>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">₹{loan.principalAmount.toLocaleString("en-IN")}</div>
                </div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">{ta ? "நிலுவை அசல்" : "Outstanding"}</span>
                  <span className="font-bold text-slate-900 dark:text-white">₹{loan.principalOutstanding.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">{ta ? "நிலுவை வட்டி" : "Interest Due"}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">₹{loan.interestOutstanding.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                <span>{ta ? "கடைசி தவணை தேதி" : "Due Date"}: {formatDateDMY(loan.dueDate)}</span>
                <span className="text-indigo-600 font-semibold flex items-center gap-0.5">{ta ? "விவரங்கள்" : "View"}<ChevronRight className="w-3.5 h-3.5" /></span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Loan Details Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{selectedLoan.loanNo}</span>
                <h3 className="font-bold text-slate-900 dark:text-white text-base mt-1">{selectedLoan.customer?.name}</h3>
                <p className="text-xs text-slate-500">{selectedLoan.customer?.mobile}</p>
              </div>
              <button onClick={() => setSelectedLoan(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Details Grid */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 text-[11px] block">{ta ? "கடன் வழங்கப்பட்ட தேதி" : "Disbursement Date"}</span>
                  <span className="text-sm font-bold text-indigo-600">{formatDateDMY(selectedLoan.date || selectedLoan.createdAt)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">{ta ? "அசல் தொகை" : "Principal"}</span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">₹{selectedLoan.principalAmount.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 text-[11px] block">{ta ? "தவணை தொகை" : "Installment"}</span>
                  <span className="text-base font-bold text-indigo-600">₹{(selectedLoan.installmentAmount || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 text-[11px] block">{ta ? "மொத்த திரும்பச் செலுத்தல்" : "Total Payable"}</span>
                  <span className="text-base font-extrabold text-indigo-600">₹{(selectedLoan.totalPayable || 0).toLocaleString("en-IN")}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-slate-400">{ta ? "நிலுவை அசல்" : "Outstanding Principal"}:</span><div className="font-bold text-slate-800 dark:text-slate-200">₹{selectedLoan.principalOutstanding.toLocaleString("en-IN")}</div></div>
                <div className="text-right"><span className="text-slate-400">{ta ? "நிலுவை வட்டி" : "Interest Due"}:</span><div className="font-bold text-amber-600">₹{(selectedLoan.loanCalculationType === "ADVANCE_INTEREST" ? 0 : selectedLoan.interestOutstanding).toLocaleString("en-IN")}</div></div>
                <div><span className="text-slate-400">{ta ? "செலுத்திய அசல்" : "Principal Paid"}:</span><div className="font-bold text-emerald-600">₹{selectedLoan.principalPaid.toLocaleString("en-IN")}</div></div>
                <div className="text-right"><span className="text-slate-400">{ta ? "செலுத்திய வட்டி" : "Interest Paid"}:</span><div className="font-bold text-emerald-600">₹{selectedLoan.interestPaid.toLocaleString("en-IN")}</div></div>
                <div><span className="text-slate-400">{ta ? "தவணை தொகை" : "Installment"}:</span><div className="font-bold text-indigo-600">₹{(selectedLoan.installmentAmount || 0).toLocaleString("en-IN")}</div></div>
                <div className="text-right"><span className="text-slate-400">{ta ? "வட்டி முறை" : "Interest Type"}:</span><div className="font-bold text-slate-700 dark:text-slate-300">{selectedLoan.interestType || "-"}</div></div>
              </div>
            </div>

            {/* Installment Schedule */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{ta ? "தவணை அட்டவணை" : "Installment Schedule"}</h4>
                {scheduleItems.length > 0 && <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-full">{scheduleItems.length} {ta ? "தவணைகள்" : "installments"}</span>}
              </div>
              {loadingDetail ? (
                <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                  <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>{ta ? "ஏற்றுகிறது..." : "Loading..."}</p>
                </div>
              ) : scheduleItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">{ta ? "அட்டவணை இல்லை" : "No schedule loaded"}</div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-h-56">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
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
                            <td className="py-2 px-2 text-right font-bold text-indigo-700 dark:text-indigo-400">₹{fmt(inst.projectedBalance ?? inst.loanOutstandingAfterInstallment ?? inst.balanceAmount ?? inst.loanOutstanding ?? 0)}</td>
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

            {/* Payment History */}
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">{ta ? "வசூல் வரலாறு" : "Payment History"} ({selectedLoan.payments?.length || 0})</h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {selectedLoan.payments?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">{ta ? "இதுவரை வசூல் பதிவாகவில்லை" : "No payments recorded yet"}</p>
                ) : selectedLoan.payments?.map((pmt) => (
                  <div key={pmt.id} className="p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{pmt.paymentNo}</div>
                      <div className="text-[10px] text-slate-400">{formatDateDMY(pmt.date)} • {pmt.paymentMethod}</div>
                    </div>
                    <div className="font-black text-emerald-600 dark:text-emerald-400">₹{pmt.amount.toLocaleString("en-IN")}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setShowDocModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md tap-active">
                <FileText className="w-4 h-4" />
                <span>{ta ? "கடன் ஆவணம் / PDF அச்சிடு" : "Loan Document / Print PDF"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Loan Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-2">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[95vh] flex flex-col">
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
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                </div>
              )}

              {/* 1. Customer Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">{ta ? "வாடிக்கையாளர் *" : "Select Borrower *"}</label>
                <select required value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium">
                  <option value="">-- {ta ? "வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்" : "Select Borrower"} --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.mobile}) - {c.city || "Tamil Nadu"}
                    </option>
                  ))}
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

                  {/* Customer Receives Breakdown */}
                  <div className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {ta ? "வாடிக்கையாளர் பெறும் தொகை (நிகர வழங்கல்):" : "Customer Receives (Net Disbursed):"}
                      </span>
                      <span className="text-slate-500 block text-[10px]">
                        {ta ? "அசல் தொகை" : "Principal Amount"} (₹{fmt(numPrincipal)}) {numFee > 0 ? `- ${ta ? "கட்டணம்" : "Fee"} (₹${fmt(numFee)})` : ""}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ₹{fmt(calcResult.customerReceives)}
                    </span>
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
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-emerald-500 font-mono" />
                      <span className="text-[10px] text-slate-400 block mt-0.5">{ta ? "திரும்ப வசூலிக்க வேண்டிய முக மதிப்பு" : "Total face loan to be recovered back"}</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "முன்கூட்டி கழிக்கப்படும் வட்டி (₹) *" : "Advance Interest Deducted (₹) *"}</label>
                      <input type="number" required value={advInt} onChange={(e) => setAdvInt(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-sm font-bold text-amber-600 focus:ring-2 focus:ring-emerald-500 font-mono" />
                      <span className="text-[10px] text-slate-400 block mt-0.5">{ta ? "வழங்கும் போது பிடித்தம் செய்யப்படும் வட்டி" : "Interest retained upfront at disbursement"}</span>
                    </div>
                  </div>

                  {/* Advance Interest Dynamic Breakdown Card */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                        {ta ? "முன் வட்டி நிதி கட்டமைப்பு" : "Advance Interest Financial Structure"}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                        {ta ? "தானியங்கி கணக்கீடு" : "Dynamic Calculation"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 font-sans block">{ta ? "முக / கடன் தொகை" : "Face Amount"}</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">₹{fmt(calcResult.principal)}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 font-sans block">{ta ? "முன் வட்டி" : "Advance Interest"}</span>
                        <span className="font-bold text-amber-600">-₹{fmt(calcResult.advanceInterest)}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] text-slate-500 font-sans block">{ta ? "கட்டணம்" : "Charges"}</span>
                        <span className="font-bold text-slate-600 dark:text-slate-400">-₹{fmt(calcResult.processingFee)}</span>
                      </div>
                      <div className="bg-emerald-100/70 dark:bg-emerald-950/60 p-2 rounded-lg border border-emerald-300 dark:border-emerald-700">
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-sans block">{ta ? "வாடிக்கையாளர் பெறும்" : "Customer Receives"}</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">₹{fmt(calcResult.customerReceives)}</span>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-200 dark:border-indigo-800 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 font-sans block">{ta ? "மொத்த வசூல்" : "Customer Repays"}</span>
                        <span className="font-black text-indigo-700 dark:text-indigo-300 text-sm">₹{fmt(calcResult.totalPayable)}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                      <span className="font-bold text-amber-900 dark:text-amber-300">{ta ? "முன் வட்டி விதி: " : "Advance Interest Rule: "}</span>
                      {ta
                        ? `வாடிக்கையாளர் இன்று கையில் பெறுவது ₹${fmt(calcResult.customerReceives)}. ஆனால் திரும்ப வசூலிப்பது முழு முக மதிப்பிலான ₹${fmt(calcResult.principal)} தொகையை ${calcResult.totalInstallments} ${advFreq === "DAILY" ? "தினசரி" : advFreq === "WEEKLY" ? "வாராந்திர" : "மாதாந்திர"} தவணைகளில் தலா ₹${fmt(calcResult.installmentAmount)} வீதம்.`
                        : `Customer receives ₹${fmt(calcResult.customerReceives)} in-hand today. However, repayment collection is based on the full face loan amount of ₹${fmt(calcResult.principal)} across ${calcResult.totalInstallments} ${advFreq.toLowerCase()} dues of ₹${fmt(calcResult.installmentAmount)} each.`}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல் முறை *" : "Frequency *"}</label>
                      <select value={advFreq} onChange={(e) => setAdvFreq(e.target.value as Frequency)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs focus:ring-2 focus:ring-emerald-500 font-medium">
                        <option value="DAILY">Daily (தினசரி)</option>
                        <option value="WEEKLY">Weekly (வாராந்திர)</option>
                        <option value="MONTHLY">Monthly (மாதாந்திர)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல் தொகை (₹) *" : "Collection Amount (₹) *"}</label>
                      <input type="number" required value={advInstAmt} onChange={(e) => { setAdvInstAmt(e.target.value); const amt = Number(e.target.value) || 1; if (amt > 0) setAdvInstCount(String(Math.ceil(numPrincipal / amt))); }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs font-bold focus:ring-2 focus:ring-emerald-500 font-mono" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல்கள் எண்ணிக்கை *" : "No. of Collections *"}</label>
                      <input type="number" required value={advInstCount} onChange={(e) => { setAdvInstCount(e.target.value); const n = Math.max(1, Number(e.target.value) || 1); setAdvInstAmt(String(Math.round(numPrincipal / n))); }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 text-xs font-bold focus:ring-2 focus:ring-emerald-500 font-mono" />
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
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-sm font-bold text-indigo-600 focus:ring-2 focus:ring-amber-500 font-mono" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "வசூல் முறை *" : "Frequency *"}</label>
                      <select value={ipFreq} onChange={(e) => setIpFreq(e.target.value as Frequency)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-xs focus:ring-2 focus:ring-amber-500 font-medium">
                        <option value="DAILY">Daily (தினசரி)</option>
                        <option value="WEEKLY">Weekly (வாராந்திர)</option>
                        <option value="MONTHLY">Monthly (மாதாந்திர)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "தவணைகள் *" : "Installments *"}</label>
                      <input type="number" required value={ipInstCount} onChange={(e) => { setIpInstCount(e.target.value); const n = Math.max(1, Number(e.target.value) || 1); setIpPrinPerInst(String(Math.round(numPrincipal / n))); }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-xs font-bold focus:ring-2 focus:ring-amber-500 font-mono" />
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
                          className="w-full px-2 py-2 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 text-xs font-bold focus:ring-2 focus:ring-amber-500 font-mono" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">{ipIntMode === "AMOUNT" ? (ta ? "தவணைக்கு வட்டி (₹)" : "Interest / Due (₹)") : (ta ? "வட்டி விகிதம் (%)" : "Interest Rate (%)")}</label>
                        {ipIntMode === "AMOUNT" ? (
                          <input type="number" value={ipIntPerInst} onChange={(e) => setIpIntPerInst(e.target.value)}
                            className="w-full px-2 py-2 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 text-xs font-bold text-amber-600 focus:ring-2 focus:ring-amber-500 font-mono" />
                        ) : (
                          <input type="number" step="0.01" value={ipIntRate} onChange={(e) => { setIpIntRate(e.target.value); const r = Number(e.target.value) || 0; setIpIntPerInst(String(Math.round((numPrincipal * r) / 100))); }}
                            className="w-full px-2 py-2 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 text-xs font-bold text-amber-600 focus:ring-2 focus:ring-amber-500 font-mono" />
                        )}
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500">{ta ? "தவணை மொத்தம்" : "Total / Due"}</span>
                        <span className="text-sm font-black text-emerald-600 font-mono">₹{fmt(Number(ipPrinPerInst || 0) + (ipIntMode === "AMOUNT" ? Number(ipIntPerInst || 0) : Math.round((numPrincipal * (Number(ipIntRate) || 0)) / 100)))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Common Fields: Disbursement, Processing Fee, Loan Date */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">{ta ? "விநியோக முறை" : "Disbursement"}</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-indigo-500 font-medium">
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
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"><Calendar className="w-3 h-3" />{ta ? "வழங்கிய தேதி *" : "Disbursement Date *"}</label>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono focus:ring-2 focus:ring-indigo-500" />
                  <span className="block text-[9px] text-slate-400 mt-0.5">{ta ? "அட்டவணை இந்த தேதியிலிருந்து தொடங்கும்" : "Schedule starts from this date"}</span>
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

              {/* 5. Authoritative Calculation Preview */}
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3 font-mono">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 font-sans">
                  <Calculator className="w-4 h-4" />
                  <span>{ta ? "கடன் கணக்கீடு முன்காட்சி" : "Schedule Summary Preview"}</span>
                  <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold ${loanCategory === "ADVANCE_INTEREST" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : loanCategory === "INTEREST_PRINCIPAL" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"}`}>
                    {loanCategory === "ADVANCE_INTEREST" ? "Advance Interest" : loanCategory === "INTEREST_PRINCIPAL" ? "Interest + Principal" : "Standard"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs border-t border-indigo-200 dark:border-indigo-900 pt-3">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block text-[10px] font-sans">{loanCategory === "ADVANCE_INTEREST" ? (ta ? "முக கடன் தொகை" : "Face Loan Amount") : (ta ? "அசல் தொகை" : "Principal")}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">₹{fmt(calcResult.principal)}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block text-[10px] font-sans">{loanCategory === "ADVANCE_INTEREST" ? (ta ? "முன் வட்டி (முன்கூட்டியே)" : "Advance Interest (Upfront)") : (ta ? "மொத்த வட்டி" : "Total Scheduled Interest")}</span>
                    <span className="font-bold text-amber-600">{loanCategory === "ADVANCE_INTEREST" ? `-₹${fmt(calcResult.advanceInterest)}` : `+₹${fmt(calcResult.totalInterest)}`}</span>
                  </div>
                  {calcResult.processingFee > 0 && (
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 col-span-2">
                      <span className="text-slate-500 block text-[10px] font-sans">{ta ? "கட்டணம்" : "Processing Fee"}</span>
                      <span className="font-bold text-slate-600 dark:text-slate-400">-₹{fmt(calcResult.processingFee)}</span>
                    </div>
                  )}
                  <div className="bg-emerald-100/70 dark:bg-emerald-950/60 p-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-sans block">{ta ? "வாடிக்கையாளர் பெறும் தொகை" : "Customer Receives"}</span>
                    <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">₹{fmt(calcResult.customerReceives)}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                    <span className="text-slate-500 block text-[10px] font-sans">{loanCategory === "ADVANCE_INTEREST" ? (ta ? "மொத்த வசூல்" : "Total Collection") : (ta ? "மொத்த திரும்பச் செலுத்தல்" : "Total Payable")}</span>
                    <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm">₹{fmt(calcResult.totalPayable)}</span>
                  </div>
                  <div className="col-span-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div>
                      <span className="text-slate-500 block text-[10px] font-sans">{ta ? "தவணை தொகை" : "Installment Due"}</span>
                      <span className="font-black text-emerald-600 text-sm">₹{fmt(calcResult.installmentAmount)}</span>
                    </div>
                    <span className="text-[11px] text-indigo-600 font-bold font-sans">
                      {calcResult.totalInstallments} {
                        loanCategory === "ADVANCE_INTEREST" ? advFreq : loanCategory === "INTEREST_PRINCIPAL" ? ipFreq : payFrequency
                      } {ta ? "தவணைகள்" : "dues"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 6. Inline Installment Schedule Preview (First 5 Installments) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {ta ? "தவணை அட்டவணை முன்காட்சி" : "Due Schedule Preview"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline tap-active"
                  >
                    {ta ? `அனைத்தும் (${calcResult.schedule.length}) →` : `View All (${calcResult.schedule.length}) →`}
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {calcResult.schedule.slice(0, 5).map((s) => (
                    <div
                      key={s.installmentNumber}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 font-mono text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-800 dark:text-slate-200 font-sans font-bold">
                          #{s.installmentNumber} • {formatISTDisplay(s.dueDate)}
                        </span>
                        <span className="font-bold text-emerald-600 font-mono">
                          ₹{fmt(s.installmentAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-100 dark:border-slate-700/40">
                        <span>{ta ? "அசல்" : "P"}: ₹{fmt(s.principalPortion)} • {ta ? "வட்டி" : "I"}: ₹{fmt(s.interestPortion)}</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400">{ta ? "மீதி" : "Balance"}: ₹{fmt(s.remainingPrincipal)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
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
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "அசல் தொகை" : "Principal"}</span><span className="font-bold text-indigo-600">₹{fmt(calcResult.principal)}</span></div>
              {loanCategory === "ADVANCE_INTEREST" ? (
                <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "முன் வட்டி" : "Advance Interest"}</span><span className="font-bold text-amber-600">-₹{fmt(calcResult.advanceInterest)}</span></div>
              ) : (
                <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "மொத்த வட்டி" : "Total Interest"}</span><span className="font-bold text-amber-600">₹{fmt(calcResult.totalInterest)}</span></div>
              )}
              {calcResult.processingFee > 0 && (
                <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "கட்டணம்" : "Processing Fee"}</span><span className="font-bold text-slate-500">-₹{fmt(calcResult.processingFee)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "வாடிக்கையாளர் பெறும்" : "Customer Receives"}</span><span className="font-bold text-emerald-600">₹{fmt(calcResult.customerReceives)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "மொத்த திரும்பச் செலுத்தல்" : "Total Payable"}</span><span className="font-bold text-slate-800 dark:text-slate-200">₹{fmt(calcResult.totalPayable)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "தவணை" : "Installment"}</span><span className="font-bold text-indigo-600">₹{fmt(calcResult.installmentAmount)} × {calcResult.totalInstallments}</span></div>
              <div className="flex justify-between"><span className="text-slate-500 font-sans">{ta ? "வழங்கிய தேதி" : "Disbursement Date"}</span><span className="font-bold">{formatISTDisplay(startDate)}</span></div>
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

      {/* ── Complete Schedule Modal (View All Schedule) ── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {ta ? `முழு தவணை அட்டவணை முன்காட்சி (${calcResult.schedule.length} தவணைகள்)` : `Complete Due Schedule Preview (${calcResult.schedule.length} Installments)`}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {ta ? "அசல்" : "Principal"}: ₹{fmt(calcResult.principal)} • {ta ? "மொத்த வசூல்" : "Total Repayable"}: ₹{fmt(calcResult.totalPayable)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 flex-1">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-sans font-semibold">
                    <th className="py-2.5 px-2">#</th>
                    <th className="py-2.5 px-2">{ta ? "தேதி" : "Due Date"}</th>
                    <th className="py-2.5 px-2 text-right">{ta ? "எதிர்பார்க்கப்படும் தொகை" : "Expected Amount"}</th>
                    <th className="py-2.5 px-2 text-right">{ta ? "அசல்" : "Principal"}</th>
                    <th className="py-2.5 px-2 text-right">{ta ? "வட்டி" : "Interest"}</th>
                    <th className="py-2.5 px-2 text-right">{ta ? "செலுத்தியது" : "Paid"}</th>
                    <th className="py-2.5 px-2 text-right">{ta ? "கடன் நிலுவை" : "Loan Outstanding"}</th>
                    <th className="py-2.5 px-2 text-center">{ta ? "நிலை" : "Status"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {calcResult.schedule.map((s) => (
                    <tr key={s.installmentNumber} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-2 font-bold text-indigo-600">#{s.installmentNumber}</td>
                      <td className="py-2.5 px-2 font-sans text-slate-700 dark:text-slate-300">{formatISTDisplay(s.dueDate)}</td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900 dark:text-slate-100">₹{fmt(s.installmentAmount)}</td>
                      <td className="py-2.5 px-2 text-right text-slate-600 dark:text-slate-400">₹{fmt(s.principalPortion)}</td>
                      <td className="py-2.5 px-2 text-right text-amber-600">₹{fmt(s.interestPortion)}</td>
                      <td className="py-2.5 px-2 text-right text-slate-400">₹0</td>
                      <td className="py-2.5 px-2 text-right font-semibold text-slate-800 dark:text-slate-200">₹{fmt(s.remainingPrincipal)}</td>
                      <td className="py-2.5 px-2 text-center font-sans">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600">PENDING</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 transition"
              >
                {ta ? "மூடு" : "Close Preview"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Document Modal */}
      <LoanDocumentModal isOpen={showDocModal} loan={selectedLoan} onClose={() => setShowDocModal(false)} />
    </div>
  );
};
