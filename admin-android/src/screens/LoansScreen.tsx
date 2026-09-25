import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Banknote,
  Plus,
  Search,
  RefreshCw,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  X,
  User,
  Percent,
  ChevronRight,
  Calculator,
  ArrowRight,
  FileText,
  Share2,
  Printer,
  Download,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { LoanDetail, Customer, Installment } from "../types";
import { LoanDocumentModal } from "../components/LoanDocumentModal";

export const LoansScreen: React.FC = () => {
  const { language } = useAuth();
  const [loans, setLoans] = useState<LoanDetail[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "OVERDUE" | "CLOSED">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [documentLoan, setDocumentLoan] = useState<LoanDetail | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);

  // Form State
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("");
  const [interestType, setInterestType] = useState<"FIXED" | "PERCENTAGE">("PERCENTAGE");
  const [interestRate, setInterestRate] = useState("10"); // default 10%
  const [paymentFrequency, setPaymentFrequency] = useState("DAILY");
  const [totalInstallments, setTotalInstallments] = useState("100"); // default 100 days
  const [processingFee, setProcessingFee] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const fetchLoans = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getLoans(statusFilter === "ALL" ? undefined : statusFilter, searchQuery || undefined);
      setLoans(data.loans || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "கடன்களை ஏற்றுவதில் பிழை");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery]);

  const fetchCustomersList = useCallback(async () => {
    try {
      const res = await api.getCustomers();
      setCustomers(res.customers || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  useEffect(() => {
    if (showCreateModal && customers.length === 0) {
      fetchCustomersList();
    }
  }, [showCreateModal, customers.length, fetchCustomersList]);

  // Loan Calculation Preview
  const calculationPreview = useMemo(() => {
    const p = parseFloat(principalAmount) || 0;
    const rate = parseFloat(interestRate) || 0;
    const installments = parseInt(totalInstallments) || 1;

    let interest = 0;
    if (interestType === "PERCENTAGE") {
      interest = (p * rate) / 100;
    } else {
      interest = rate;
    }

    const totalPayable = p + interest;
    const installmentAmt = Math.round(totalPayable / installments);

    return {
      principal: p,
      interest,
      totalPayable,
      installmentAmount: installmentAmt,
    };
  }, [principalAmount, interestRate, interestType, totalInstallments]);

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setFormError("தயவுசெய்து வாடிக்கையாளரைத் தேர்ந்தெடுக்கவும்.");
      return;
    }

    const p = parseFloat(principalAmount);
    const r = parseFloat(interestRate);
    const inst = parseInt(totalInstallments);

    if (isNaN(p) || p <= 0) {
      setFormError("சரியான அசல் தொகையை உள்ளிடவும்.");
      return;
    }
    if (isNaN(r) || r < 0) {
      setFormError("சரியான வட்டி விகிதத்தை உள்ளிடவும்.");
      return;
    }
    if (isNaN(inst) || inst <= 0) {
      setFormError("சரியான தவணைகளின் எண்ணிக்கையை உள்ளிடவும்.");
      return;
    }

    setFormLoading(true);
    setFormError(null);

    try {
      const res = await api.createLoan({
        customerId: selectedCustomerId,
        principalAmount: p,
        interestType,
        interestRate: r,
        interestFrequency: "MONTHLY",
        paymentFrequency,
        totalInstallments: inst,
        processingFee: processingFee ? parseFloat(processingFee) : undefined,
        paymentMethod: "CASH",
        startDate,
        notes: notes.trim() || undefined,
      });

      setFormSuccess("கடன் வெற்றிகரமாக வழங்கப்பட்டது!");
      setShowCreateModal(false);
      setSelectedCustomerId("");
      setPrincipalAmount("");
      setInterestRate("10");
      setTotalInstallments("100");
      setProcessingFee("");
      setNotes("");
      fetchLoans(true);

      // Open Loan Sanction Document Modal immediately for PDF / Print / WhatsApp
      try {
        const full = await api.getLoan(res.loan.id);
        setDocumentLoan(full.loan || res.loan);
      } catch {
        setDocumentLoan(res.loan);
      }
      setShowDocModal(true);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "கடன் உருவாக்குவதில் தோல்வி");
    } finally {
      setFormLoading(false);
    }
  };

  const handleOpenLoanDetails = async (loan: LoanDetail) => {
    setSelectedLoan(loan);
    setLoadingSchedule(true);
    setScheduleError(null);
    try {
      const full = await api.getLoan(loan.id);
      if (full && full.loan) {
        const mergedLoan: LoanDetail = {
          ...full.loan,
          installments: (full.loan.installments && full.loan.installments.length > 0)
            ? full.loan.installments
            : ((full.schedule as any) && (full.schedule as any).length > 0)
            ? (full.schedule as any)
            : (full.loan.installments || []),
        };
        setSelectedLoan(mergedLoan);
      }
    } catch (err: unknown) {
      console.error("Failed to load loan details / schedule:", err);
      const msg = err instanceof Error ? err.message : "தவணை அட்டவணையை ஏற்றுவதில் பிழை / Failed to load installment schedule";
      setScheduleError(msg);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const scheduleItems = useMemo(() => {
    if (!selectedLoan) return [];
    const list: any[] = (selectedLoan.installments && selectedLoan.installments.length > 0)
      ? selectedLoan.installments
      : ((selectedLoan as any).schedule && (selectedLoan as any).schedule.length > 0)
      ? (selectedLoan as any).schedule
      : [];

    return list.map((inst: any, idx: number) => {
      const instNum = inst.installmentNumber ?? inst.installmentNo ?? (idx + 1);
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
        } catch {
          dueDateFormatted = String(rawDate);
        }
      }

      return {
        id: inst.id || `inst-${instNum}`,
        installmentNumber: instNum,
        dueDateFormatted,
        dueDate: rawDate,
        installmentAmount: expectedAmt,
        principalPortion: prin,
        interestPortion: intVal,
        paidAmount: paid,
        balanceAmount: bal,
        status: String(inst.status || (bal === 0 ? "COLLECTED" : "PENDING")),
      };
    });
  }, [selectedLoan]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold">
                {language === "ta" ? "கடன் மேலாண்மை" : "Loan Management"}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === "ta" ? "விநியோகம், தவணை & வசூல் அட்டவணை" : "Disbursals, Schedules & Tracking"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchLoans(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition tap-active disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition tap-active shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "ta" ? "புதிய கடன்" : "New Loan"}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="grid grid-cols-4 gap-1.5 mt-4 bg-white/10 p-1 rounded-2xl">
          {(["ACTIVE", "OVERDUE", "CLOSED", "ALL"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`py-1.5 text-center text-xs font-semibold rounded-xl transition tap-active ${
                statusFilter === tab
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {tab === "ACTIVE"
                ? language === "ta" ? "செயலில்" : "Active"
                : tab === "OVERDUE"
                ? language === "ta" ? "தாமதம்" : "Overdue"
                : tab === "CLOSED"
                ? language === "ta" ? "முடிந்தது" : "Closed"
                : language === "ta" ? "அனைத்தும்" : "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={language === "ta" ? "கடன் எண், வாடிக்கையாளர் பெயர்..." : "Search loan # or customer..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Loan List */}
      <div className="px-4 mt-4 space-y-3">
        {loading && loans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs">{language === "ta" ? "ஏற்றுகிறது..." : "Loading loans..."}</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : loans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Banknote className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {language === "ta" ? "கடன்கள் எதுவும் இல்லை" : "No loans found"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? "தேடலை மாற்றவும்" : "புதிய கடன் வழங்க '+' பொத்தானை அழுத்தவும்"}
            </p>
          </div>
        ) : (
          loans.map((loan) => (
            <div
              key={loan.id}
              onClick={() => handleOpenLoanDetails(loan)}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 cursor-pointer tap-active hover:border-indigo-200 dark:hover:border-indigo-900 transition space-y-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                      {loan.loanNo}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        loan.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : loan.status === "OVERDUE"
                          ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {loan.status}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                    {loan.customer?.name || "Customer"}
                  </h2>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              {/* Financial Progress Grid */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">அசல் (Principal)</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{loan.principalAmount?.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">தவணை (Daily)</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    ₹{loan.installmentAmount?.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">நிலுவை (Balance)</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    ₹{loan.principalOutstanding?.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Loan Details & Schedule */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                    {selectedLoan.loanNo}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedLoan.customer?.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedLoan.paymentFrequency} • {selectedLoan.totalInstallments} தவணைகள்
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLoan(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Financial Overview Card */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">மொத்த கடன் தொகை</span>
                  <span className="text-base font-extrabold text-white">
                    ₹{selectedLoan.totalPayable?.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">தவணை தொகை</span>
                  <span className="text-base font-extrabold text-emerald-400">
                    ₹{selectedLoan.installmentAmount?.toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">வசூலிக்கப்பட்டது</span>
                  <span className="text-sm font-bold text-indigo-300">
                    ₹{((selectedLoan.principalPaid || 0) + (selectedLoan.interestPaid || 0)).toLocaleString("en-IN")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">மீதமுள்ள நிலுவை</span>
                  <span className="text-sm font-bold text-amber-400">
                    ₹{((selectedLoan.principalOutstanding || 0) + (selectedLoan.interestOutstanding || 0)).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* Installment Schedule */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {language === "ta" ? "தவணை அட்டவணை" : "Installment Schedule"}
                </h4>
                {scheduleItems.length > 0 && (
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full">
                    {scheduleItems.length} {language === "ta" ? "தவணைகள்" : "installments"}
                  </span>
                )}
              </div>

              {loadingSchedule ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500" />
                  <p className="font-semibold">{language === "ta" ? "அட்டவணை ஏற்றுகிறது..." : "Loading installment schedule..."}</p>
                </div>
              ) : scheduleError ? (
                <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs space-y-2.5">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>{language === "ta" ? "தவணை அட்டவணையை ஏற்றுவதில் தோல்வி" : "Unable to load installment schedule"}</span>
                  </div>
                  <p className="text-[11px] text-red-600/80 dark:text-red-400 font-mono bg-red-100/50 dark:bg-red-900/30 p-2 rounded-lg">
                    {scheduleError}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenLoanDetails(selectedLoan)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm tap-active"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{language === "ta" ? "மீண்டும் முயற்சி செய்" : "Retry"}</span>
                  </button>
                </div>
              ) : scheduleItems.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {language === "ta" ? "அட்டவணை தகவல் இல்லை" : "Schedule information not loaded"}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="py-2.5 px-3 text-center">#</th>
                        <th className="py-2.5 px-3">{language === "ta" ? "தவணை தேதி" : "Due Date"}</th>
                        <th className="py-2.5 px-3 text-right">{language === "ta" ? "எதிர்பார்க்கப்படும் தொகை" : "Expected Amount"}</th>
                        <th className="py-2.5 px-3 text-right">{language === "ta" ? "அசல்" : "Principal"}</th>
                        <th className="py-2.5 px-3 text-right">{language === "ta" ? "வட்டி" : "Interest"}</th>
                        <th className="py-2.5 px-3 text-right">{language === "ta" ? "செலுத்தியது" : "Paid Amount"}</th>
                        <th className="py-2.5 px-3 text-right">{language === "ta" ? "மீதமுள்ள நிலுவை" : "Balance"}</th>
                        <th className="py-2.5 px-3 text-center">{language === "ta" ? "நிலை" : "Status"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {scheduleItems.map((inst) => {
                        const isPaid = inst.status === "PAID" || inst.status === "COLLECTED";
                        const isPartial = inst.status === "PARTIAL" || inst.status === "PARTIALLY_PAID";
                        const isOverdue = inst.status === "OVERDUE";

                        return (
                          <tr key={inst.id || inst.installmentNumber} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 text-center font-bold text-indigo-600">#{inst.installmentNumber}</td>
                            <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300 text-[11px]">{inst.dueDateFormatted}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">₹{inst.installmentAmount.toLocaleString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">₹{inst.principalPortion.toLocaleString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-right text-amber-600">₹{inst.interestPortion.toLocaleString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-600">₹{inst.paidAmount.toLocaleString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-200">₹{inst.balanceAmount.toLocaleString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isPaid
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : isPartial
                                    ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                                    : isOverdue
                                    ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                                }`}
                              >
                                {inst.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Document Action Buttons: Download PDF, Print, WhatsApp */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setDocumentLoan({
                    ...selectedLoan,
                    installments: scheduleItems.length > 0 ? (scheduleItems as any) : selectedLoan.installments,
                  });
                  setShowDocModal(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md tap-active"
              >
                <FileText className="w-4 h-4" />
                <span>{language === "ta" ? "கடன் அனுமதி ஆவணம் (PDF & WhatsApp)" : "Sanction Order (PDF & WhatsApp)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Loan */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === "ta" ? "புதிய கடன் வழங்குதல்" : "Issue New Loan"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateLoan} className="space-y-3">
              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "வாடிக்கையாளர் *" : "Select Customer *"}
                </label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                >
                  <option value="">-- {language === "ta" ? "தேர்ந்தெடுக்கவும்" : "Select"} --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.mobile})
                    </option>
                  ))}
                </select>
              </div>

              {/* Principal Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "அசல் கடன் தொகை (₹) *" : "Principal Amount (₹) *"}
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 10000"
                  value={principalAmount}
                  onChange={(e) => setPrincipalAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-bold text-slate-900 dark:text-white"
                />
              </div>

              {/* Interest Type & Rate */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === "ta" ? "வட்டி முறை" : "Interest Type"}
                  </label>
                  <select
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === "ta" ? "வட்டி விகிதம்" : "Interest Rate"}
                  </label>
                  <input
                    type="number"
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Tenure & Frequency */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === "ta" ? "தவணை முறை" : "Frequency"}
                  </label>
                  <select
                    value={paymentFrequency}
                    onChange={(e) => setPaymentFrequency(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                  >
                    <option value="DAILY">Daily (தினசரி)</option>
                    <option value="WEEKLY">Weekly (வாராந்திர)</option>
                    <option value="MONTHLY">Monthly (மாதாந்திர)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === "ta" ? "மொத்த தவணைகள்" : "Total Installments"}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="100"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "தொடங்கும் தேதி" : "Start Date"}
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
                />
              </div>

              {/* Calculation Preview Box */}
              <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <Calculator className="w-4 h-4" />
                  <span>{language === "ta" ? "கடன் மதிப்பீடு முன்காட்சி" : "Instant Calculation Preview"}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] pt-1 border-t border-indigo-200 dark:border-indigo-900">
                  <div>
                    <span className="text-slate-500 block">வட்டி (Interest)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      ₹{calculationPreview.interest.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">மொத்த தொகை</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      ₹{calculationPreview.totalPayable.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">தவணை (Daily)</span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                      ₹{calculationPreview.installmentAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 tap-active"
                >
                  {language === "ta" ? "ரத்து" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-500 tap-active disabled:opacity-50"
                >
                  {formLoading ? "வழங்குகிறது..." : language === "ta" ? "கடன் வழங்கு" : "Disburse Loan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Sanction Document Modal */}
      {showDocModal && documentLoan && (
        <LoanDocumentModal
          isOpen={showDocModal}
          loan={documentLoan}
          onClose={() => {
            setShowDocModal(false);
            setDocumentLoan(null);
          }}
        />
      )}
    </div>
  );
};
