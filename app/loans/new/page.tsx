"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CreditCard,
  Calculator,
  UserPlus,
  Shield,
  CheckCircle2,
  Layers,
  Banknote,
  Coins,
  X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { calculateLoan, LoanCalculationResult } from "@/lib/loans/calculator";

interface CustomerOption {
  id: string;
  name: string;
  customerCode: string;
  mobile: string;
  city?: string | null;
}

export default function NewLoanPage() {
  const router = useRouter();
  const { t, formatCurrency, formatDate } = useLanguage();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Customer Selection
  const [customerId, setCustomerId] = useState("");

  // 1. Primary Loan Concept Category: STANDARD | ADVANCE_INTEREST | INTEREST_PRINCIPAL
  const [loanCategory, setLoanCategory] = useState<"STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL">("STANDARD");

  // Common Financial Fields
  const [principalAmount, setPrincipalAmount] = useState("50000");
  const [processingFee, setProcessingFee] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Standard Loan Fields (Flat / Reducing / Simple / Manual)
  const [standardInterestType, setStandardInterestType] = useState<"FLAT" | "REDUCING" | "SIMPLE" | "MANUAL">("FLAT");
  const [standardInterestMode, setStandardInterestMode] = useState<"RATE" | "AMOUNT">("RATE");
  const [interestRate, setInterestRate] = useState("2.0");
  const [customInterestAmount, setCustomInterestAmount] = useState("5000");
  const [interestFrequency, setInterestFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [paymentFrequency, setPaymentFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  const [totalInstallments, setTotalInstallments] = useState("10");

  // Advance Interest Fields (முன் வட்டி)
  const [advanceInterestAmount, setAdvanceInterestAmount] = useState("15000");
  const [advFrequency, setAdvFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  const [advInstallments, setAdvInstallments] = useState("100");
  const [advInstallmentAmount, setAdvInstallmentAmount] = useState("1500");

  // Interest + Principal Fields (அசல் + வட்டி தனித்தனி முறை)
  const [ipFrequency, setIpFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  const [ipInstallments, setIpInstallments] = useState("10");
  const [ipPrincipalPerInst, setIpPrincipalPerInst] = useState("10000");
  const [ipInterestMode, setIpInterestMode] = useState<"AMOUNT" | "RATE">("AMOUNT");
  const [ipInterestPerInst, setIpInterestPerInst] = useState("2000");
  const [ipInterestRate, setIpInterestRate] = useState("2.0");

  // Optional Guarantor & Collateral
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorMobile, setGuarantorMobile] = useState("");
  const [guarantorRelationship, setGuarantorRelationship] = useState("");
  const [collateralType, setCollateralType] = useState("NONE");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralEstimatedValue, setCollateralEstimatedValue] = useState("");

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        const list = data.customers || (Array.isArray(data) ? data : []);
        setCustomers(list);
        if (list.length > 0) {
          setCustomerId(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Handle switching category with sensible defaults
  const handleCategoryChange = (newCat: "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL") => {
    setLoanCategory(newCat);
    if (newCat === "ADVANCE_INTEREST") {
      setPrincipalAmount("150000");
      setAdvanceInterestAmount("15000");
      setAdvFrequency("DAILY");
      setAdvInstallments("100");
      setAdvInstallmentAmount("1500");
    } else if (newCat === "INTEREST_PRINCIPAL") {
      setPrincipalAmount("100000");
      setIpInstallments("10");
      setIpPrincipalPerInst("10000");
      setIpInterestMode("AMOUNT");
      setIpInterestPerInst("2000");
      setIpFrequency("MONTHLY");
    } else {
      setPrincipalAmount("50000");
      setStandardInterestType("FLAT");
      setStandardInterestMode("RATE");
      setInterestRate("2.0");
      setTotalInstallments("10");
      setPaymentFrequency("MONTHLY");
      setInterestFrequency("MONTHLY");
    }
  };

  const numPrincipal = Number(principalAmount) || 0;
  const numFee = Number(processingFee) || 0;

  // Live Loan Calculation
  let calcResult: LoanCalculationResult;
  if (loanCategory === "ADVANCE_INTEREST") {
    calcResult = calculateLoan({
      principal: numPrincipal,
      loanCalculationType: "ADVANCE_INTEREST",
      advanceInterestAmount: Number(advanceInterestAmount) || 0,
      totalInstallments: Math.max(1, Number(advInstallments) || 1),
      customInstallmentAmount: Number(advInstallmentAmount) || Math.round(numPrincipal / Math.max(1, Number(advInstallments) || 1)),
      paymentFrequency: advFrequency,
      processingFee: numFee,
      startDate: startDate ? new Date(startDate) : new Date(),
    });
  } else if (loanCategory === "INTEREST_PRINCIPAL") {
    const n = Math.max(1, Number(ipInstallments) || 1);
    const pPerInst = Number(ipPrincipalPerInst) || Math.round(numPrincipal / n);
    let iPerInst = 0;
    if (ipInterestMode === "AMOUNT") {
      iPerInst = Number(ipInterestPerInst) || 0;
    } else {
      iPerInst = Math.round((numPrincipal * (Number(ipInterestRate) || 0)) / 100);
    }
    calcResult = calculateLoan({
      principal: numPrincipal,
      loanCalculationType: "INTEREST_PRINCIPAL",
      totalInstallments: n,
      principalPerInstallment: pPerInst,
      interestPerInstallment: iPerInst,
      customInterestAmount: iPerInst * n,
      paymentFrequency: ipFrequency,
      processingFee: numFee,
      startDate: startDate ? new Date(startDate) : new Date(),
    });
  } else {
    calcResult = calculateLoan({
      principal: numPrincipal,
      loanCalculationType: "STANDARD",
      interestType: standardInterestType,
      interestRate: standardInterestMode === "RATE" ? Number(interestRate) || 0 : 0,
      customInterestAmount: standardInterestMode === "AMOUNT" ? Number(customInterestAmount) || 0 : undefined,
      interestFrequency,
      paymentFrequency,
      totalInstallments: Math.max(1, Number(totalInstallments) || 1),
      processingFee: numFee,
      startDate: startDate ? new Date(startDate) : new Date(),
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setErrorMsg("Please select or add a customer");
      return;
    }

    if (calcResult.principal <= 0) {
      setErrorMsg("Principal / Face amount must be greater than zero");
      return;
    }

    if (calcResult.customerReceives <= 0) {
      setErrorMsg("Customer Receives must be greater than zero. Interest or fees cannot exceed loan amount.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const payload: Record<string, unknown> = {
        customerId,
        principalAmount: calcResult.principal,
        processingFee: numFee,
        paymentMethod,
        startDate,
        notes,
        guarantorName,
        guarantorMobile,
        guarantorRelationship,
        collateralType: collateralType === "NONE" ? null : collateralType,
        collateralDescription,
        collateralEstimatedValue: Number(collateralEstimatedValue) || 0,
      };

      if (loanCategory === "ADVANCE_INTEREST") {
        payload.loanCalculationType = "ADVANCE_INTEREST";
        payload.advanceInterestAmount = calcResult.advanceInterest;
        payload.customInstallmentAmount = calcResult.installmentAmount;
        payload.totalInstallments = calcResult.totalInstallments;
        payload.paymentFrequency = advFrequency;
        payload.interestFrequency = advFrequency;
        payload.interestType = "MANUAL";
        payload.interestRate = 0;
      } else if (loanCategory === "INTEREST_PRINCIPAL") {
        payload.loanCalculationType = "INTEREST_PRINCIPAL";
        payload.principalPerInstallment = calcResult.schedule[0]?.principalPortion || Math.round(numPrincipal / calcResult.totalInstallments);
        payload.interestPerInstallment = calcResult.schedule[0]?.interestPortion || 0;
        payload.customInterestAmount = calcResult.totalInterest;
        payload.customInstallmentAmount = calcResult.installmentAmount;
        payload.totalInstallments = calcResult.totalInstallments;
        payload.paymentFrequency = ipFrequency;
        payload.interestFrequency = ipFrequency;
        payload.interestType = "MANUAL";
        payload.interestRate = ipInterestMode === "RATE" ? Number(ipInterestRate) : 0;
      } else {
        payload.loanCalculationType = "STANDARD";
        payload.interestType = standardInterestType;
        payload.interestRate = standardInterestMode === "RATE" ? Number(interestRate) || 0 : 0;
        payload.customInterestAmount = standardInterestMode === "AMOUNT" ? Number(customInterestAmount) || 0 : undefined;
        payload.interestFrequency = interestFrequency;
        payload.paymentFrequency = paymentFrequency;
        payload.totalInstallments = Number(totalInstallments) || 10;
      }

      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/loans/${data.loan.id}`);
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to create loan");
      }
    } catch {
      setErrorMsg(t.errorOccurred);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 max-w-6xl mx-auto">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/loans"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-indigo-600 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Loans</span>
        </Link>
        <span className="text-xs text-slate-400 font-medium">New Loan Origination & Schedule</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 text-rose-600 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT 2 COLUMNS: PARAMETERS */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Customer Selection */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <span>Borrower / Customer Selection</span>
                </h2>
                <Link
                  href="/customers?action=new"
                  className="text-xs font-semibold text-indigo-600 hover:underline"
                >
                  + Add New Customer
                </Link>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Select Borrower *
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.mobile}) - {c.city || "Tamil Nadu"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Primary Loan Category Selection */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" />
                  <span>Select Loan Type & Calculation Model</span>
                </h2>
                <span className="text-xs font-medium text-slate-400">
                  3 Primary Lending Models
                </span>
              </div>

              {/* 3 Main Loan Model Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Mode 1: Standard Loan */}
                <button
                  type="button"
                  onClick={() => handleCategoryChange("STANDARD")}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    loanCategory === "STANDARD"
                      ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">Standard Loan</span>
                      <Coins className={`w-4 h-4 ${loanCategory === "STANDARD" ? "text-indigo-600" : "text-slate-400"}`} />
                    </div>
                    <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">நிலையான கடன்</div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Flat, Reducing (EMI), Simple, or Manual Interest rate
                    </p>
                  </div>
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {loanCategory === "STANDARD" ? "✓ Selected" : "Select"}
                  </span>
                </button>

                {/* Mode 2: Advance Interest */}
                <button
                  type="button"
                  onClick={() => handleCategoryChange("ADVANCE_INTEREST")}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    loanCategory === "ADVANCE_INTEREST"
                      ? "border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">Advance Interest</span>
                      <Banknote className={`w-4 h-4 ${loanCategory === "ADVANCE_INTEREST" ? "text-emerald-600" : "text-slate-400"}`} />
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">முன் வட்டி முறை</div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Upfront interest deducted. Daily / Weekly / Monthly collection
                    </p>
                  </div>
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    {loanCategory === "ADVANCE_INTEREST" ? "✓ Selected" : "Select"}
                  </span>
                </button>

                {/* Mode 3: Interest + Principal */}
                <button
                  type="button"
                  onClick={() => handleCategoryChange("INTEREST_PRINCIPAL")}
                  className={`p-3.5 rounded-xl border text-left transition flex flex-col justify-between ${
                    loanCategory === "INTEREST_PRINCIPAL"
                      ? "border-amber-600 bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 shadow-sm"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">Interest + Principal</span>
                      <Layers className={`w-4 h-4 ${loanCategory === "INTEREST_PRINCIPAL" ? "text-amber-600" : "text-slate-400"}`} />
                    </div>
                    <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">அசல் + வட்டி தனித்தனி</div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Fixed principal portion + customer-specific interest per due
                    </p>
                  </div>
                  <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    {loanCategory === "INTEREST_PRINCIPAL" ? "✓ Selected" : "Select"}
                  </span>
                </button>
              </div>

              {/* ========================================================= */}
              {/* CATEGORY 1: STANDARD LOAN INPUTS                          */}
              {/* ========================================================= */}
              {loanCategory === "STANDARD" && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Principal Loan Amount (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        value={principalAmount}
                        onChange={(e) => setPrincipalAmount(e.target.value)}
                        placeholder="e.g. 50000"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Interest Calculation Method *
                      </label>
                      <select
                        value={standardInterestType}
                        onChange={(e) => setStandardInterestType(e.target.value as typeof standardInterestType)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="FLAT">Flat Interest (விகித வட்டி)</option>
                        <option value="REDUCING">Reducing Balance / EMI (குறைந்து வரும் வட்டி)</option>
                        <option value="SIMPLE">Simple Interest (எளிய வட்டி)</option>
                        <option value="MANUAL">Manual Fixed Interest (கையால் நிர்ணயிக்கப்பட்டது)</option>
                      </select>
                    </div>
                  </div>

                  {/* Customer-Specific Interest Amount vs Percentage Rate Toggle */}
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Interest Determination Mode
                      </span>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setStandardInterestMode("RATE")}
                          className={`px-2.5 py-1 rounded transition ${
                            standardInterestMode === "RATE"
                              ? "bg-indigo-600 text-white shadow-xs font-bold"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          Percentage Rate (%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setStandardInterestMode("AMOUNT")}
                          className={`px-2.5 py-1 rounded transition ${
                            standardInterestMode === "AMOUNT"
                              ? "bg-indigo-600 text-white shadow-xs font-bold"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          Customer-Specific Amount (₹)
                        </button>
                      </div>
                    </div>

                    {standardInterestMode === "RATE" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Interest Rate (% per frequency) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={interestRate}
                            onChange={(e) => setInterestRate(e.target.value)}
                            placeholder="e.g. 2.0"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                            Rate Periodicity
                          </label>
                          <select
                            value={interestFrequency}
                            onChange={(e) => setInterestFrequency(e.target.value as typeof interestFrequency)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="MONTHLY">Monthly (% per month)</option>
                            <option value="DAILY">Daily (% per day)</option>
                            <option value="WEEKLY">Weekly (% per week)</option>
                            <option value="YEARLY">Yearly (% per year)</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-1">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Negotiated / Customer-Specific Total Interest (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          value={customInterestAmount}
                          onChange={(e) => setCustomInterestAmount(e.target.value)}
                          placeholder="e.g. 5000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-amber-600 focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] text-slate-400 mt-0.5 block">
                          Fixed total interest agreed with customer for this loan
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Collection Frequency *
                      </label>
                      <select
                        value={paymentFrequency}
                        onChange={(e) => setPaymentFrequency(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="MONTHLY">Monthly Collection (மாதாந்திர)</option>
                        <option value="WEEKLY">Weekly Collection (வாராந்திர)</option>
                        <option value="DAILY">Daily Collection (தினசரி)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Total Number of Installments *
                      </label>
                      <input
                        type="number"
                        required
                        value={totalInstallments}
                        onChange={(e) => setTotalInstallments(e.target.value)}
                        placeholder="e.g. 10"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Customer Receives Breakdown */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">Customer Receives (Net Disbursed):</span>
                      <span className="text-slate-500 block text-[11px]">
                        Principal Amount (₹{numPrincipal.toLocaleString("en-IN")}) {numFee > 0 ? `- Fee (₹${numFee.toLocaleString("en-IN")})` : ""}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(Math.max(0, numPrincipal - numFee))}
                    </span>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* CATEGORY 2: ADVANCE INTEREST FORMAT                       */}
              {/* ========================================================= */}
              {loanCategory === "ADVANCE_INTEREST" && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Face / Loan Principal Amount (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        value={principalAmount}
                        onChange={(e) => {
                          setPrincipalAmount(e.target.value);
                          const p = Number(e.target.value) || 0;
                          const n = Math.max(1, Number(advInstallments) || 1);
                          setAdvInstallmentAmount(String(Math.round(p / n)));
                        }}
                        placeholder="e.g. 150000"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400">Total face loan to be recovered back</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Advance Interest Deducted (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        value={advanceInterestAmount}
                        onChange={(e) => setAdvanceInterestAmount(e.target.value)}
                        placeholder="e.g. 15000"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold text-amber-600 focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400">Interest retained upfront at time of disbursement</span>
                    </div>
                  </div>

                  {/* Advance Interest Dynamic Breakdown Card (Requirement 3 & 6) */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                        Advance Interest Financial Structure (முன் வட்டி கணக்கீடு)
                      </span>
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                        Dynamic Calculation
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans block">Loan / Face Amount</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          ₹{numPrincipal.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans block">Advance Interest</span>
                        <span className="font-bold text-amber-600">
                          -₹{Number(advanceInterestAmount || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="text-[10px] text-slate-500 font-sans block">Charges</span>
                        <span className="font-bold text-slate-600 dark:text-slate-400">
                          -₹{numFee.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="bg-emerald-100/70 dark:bg-emerald-950/60 p-2.5 rounded-lg border border-emerald-300 dark:border-emerald-700">
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 font-sans block">Customer Receives</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300 text-sm">
                          ₹{Math.max(0, numPrincipal - Number(advanceInterestAmount || 0) - numFee).toLocaleString("en-IN")}
                        </span>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800">
                        <span className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300 font-sans block">Customer Repays</span>
                        <span className="font-black text-indigo-700 dark:text-indigo-300 text-sm">
                          ₹{numPrincipal.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                      <span className="font-bold text-amber-900 dark:text-amber-300">Advance Interest Rule: </span>
                      Customer receives <span className="font-bold text-emerald-700 dark:text-emerald-300">₹{Math.max(0, numPrincipal - Number(advanceInterestAmount || 0) - numFee).toLocaleString("en-IN")}</span> in-hand today. However, repayment collection is based on the full face loan amount of <span className="font-bold text-indigo-700 dark:text-indigo-300">₹{numPrincipal.toLocaleString("en-IN")}</span> across <span className="font-bold">{advInstallments}</span> {advFrequency.toLowerCase()} dues of <span className="font-bold">₹{Number(advInstallmentAmount || 0).toLocaleString("en-IN")}</span> each.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Collection Frequency *
                      </label>
                      <select
                        value={advFrequency}
                        onChange={(e) => setAdvFrequency(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="DAILY">Daily Collection (தினசரி)</option>
                        <option value="WEEKLY">Weekly Collection (வாராந்திர)</option>
                        <option value="MONTHLY">Monthly Collection (மாதாந்திர)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Collection Amount (₹ per due) *
                      </label>
                      <input
                        type="number"
                        required
                        value={advInstallmentAmount}
                        onChange={(e) => {
                          setAdvInstallmentAmount(e.target.value);
                          const amt = Number(e.target.value) || 1;
                          if (amt > 0) {
                            setAdvInstallments(String(Math.ceil(numPrincipal / amt)));
                          }
                        }}
                        placeholder="e.g. 1500"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Number of Collections *
                      </label>
                      <input
                        type="number"
                        required
                        value={advInstallments}
                        onChange={(e) => {
                          setAdvInstallments(e.target.value);
                          const n = Math.max(1, Number(e.target.value) || 1);
                          setAdvInstallmentAmount(String(Math.round(numPrincipal / n)));
                        }}
                        placeholder="e.g. 100"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* CATEGORY 3: INTEREST + PRINCIPAL FORMAT                   */}
              {/* ========================================================= */}
              {loanCategory === "INTEREST_PRINCIPAL" && (
                <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Loan Principal (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        value={principalAmount}
                        onChange={(e) => {
                          setPrincipalAmount(e.target.value);
                          const p = Number(e.target.value) || 0;
                          const n = Math.max(1, Number(ipInstallments) || 1);
                          setIpPrincipalPerInst(String(Math.round(p / n)));
                        }}
                        placeholder="e.g. 100000"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Collection Frequency *
                      </label>
                      <select
                        value={ipFrequency}
                        onChange={(e) => setIpFrequency(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY")}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        <option value="MONTHLY">Monthly Collection (மாதாந்திர)</option>
                        <option value="WEEKLY">Weekly Collection (வாராந்திர)</option>
                        <option value="DAILY">Daily Collection (தினசரி)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Number of Installments *
                      </label>
                      <input
                        type="number"
                        required
                        value={ipInstallments}
                        onChange={(e) => {
                          setIpInstallments(e.target.value);
                          const n = Math.max(1, Number(e.target.value) || 1);
                          setIpPrincipalPerInst(String(Math.round(numPrincipal / n)));
                        }}
                        placeholder="e.g. 10"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Principal + Interest per Installment Split Box */}
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 space-y-3">
                    <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between">
                      <span>Per Installment Breakup (அசல் + வட்டி விகிதம்)</span>
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded border border-amber-300 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setIpInterestMode("AMOUNT")}
                          className={`px-2 py-0.5 rounded ${ipInterestMode === "AMOUNT" ? "bg-amber-600 text-white font-bold" : "text-slate-600"}`}
                        >
                          Fixed Amount (₹)
                        </button>
                        <button
                          type="button"
                          onClick={() => setIpInterestMode("RATE")}
                          className={`px-2 py-0.5 rounded ${ipInterestMode === "RATE" ? "bg-amber-600 text-white font-bold" : "text-slate-600"}`}
                        >
                          Rate (%)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Principal per Due (₹) *
                        </label>
                        <input
                          type="number"
                          required
                          value={ipPrincipalPerInst}
                          onChange={(e) => setIpPrincipalPerInst(e.target.value)}
                          placeholder="e.g. 10000"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Interest per Due (₹) *
                        </label>
                        {ipInterestMode === "AMOUNT" ? (
                          <input
                            type="number"
                            required
                            value={ipInterestPerInst}
                            onChange={(e) => setIpInterestPerInst(e.target.value)}
                            placeholder="e.g. 2000"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-amber-600"
                          />
                        ) : (
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={ipInterestRate}
                            onChange={(e) => {
                              setIpInterestRate(e.target.value);
                              const r = Number(e.target.value) || 0;
                              setIpInterestPerInst(String(Math.round((numPrincipal * r) / 100)));
                            }}
                            placeholder="e.g. 2.0%"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-amber-600"
                          />
                        )}
                      </div>

                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-500 font-sans font-bold">Total Collection Per Due:</span>
                        <span className="text-base font-black text-emerald-600">
                          ₹{(Number(ipPrincipalPerInst || 0) + Number(ipInterestPerInst || 0)).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Common Fields: Disbursement Mode, Fee, Start Date, Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursement Mode
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="CASH">Cash-in-Hand</option>
                    <option value="BANK">Bank Transfer / NEFT</option>
                    <option value="UPI">UPI Payment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Processing Charges (₹)
                  </label>
                  <input
                    type="number"
                    value={processingFee}
                    onChange={(e) => setProcessingFee(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sanction / Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Terms Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shop daily collection loan / Weekly market business loan"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* 3. Optional Guarantor & Collateral */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Guarantor & Collateral Security (Optional)</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Guarantor Name
                  </label>
                  <input
                    type="text"
                    placeholder="Relative / Friend"
                    value={guarantorName}
                    onChange={(e) => setGuarantorName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Guarantor Mobile
                  </label>
                  <input
                    type="text"
                    placeholder="Mobile"
                    value={guarantorMobile}
                    onChange={(e) => setGuarantorMobile(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    placeholder="Brother, Partner"
                    value={guarantorRelationship}
                    onChange={(e) => setGuarantorRelationship(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Collateral Type
                  </label>
                  <select
                    value={collateralType}
                    onChange={(e) => setCollateralType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                  >
                    <option value="NONE">None (Unsecured)</option>
                    <option value="GOLD">Gold</option>
                    <option value="VEHICLE">Vehicle RC</option>
                    <option value="PROPERTY">Property Document</option>
                    <option value="DOCUMENTS">Signed Cheques / Promissory Note</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                {collateralType !== "NONE" && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Collateral Description
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 24g Gold Chain"
                        value={collateralDescription}
                        onChange={(e) => setCollateralDescription(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Estimated Value (₹)
                      </label>
                      <input
                        type="number"
                        placeholder="120000"
                        value={collateralEstimatedValue}
                        onChange={(e) => setCollateralEstimatedValue(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT 1 COLUMN: LIVE REPAYMENT SCHEDULE & CALCULATION SUMMARY */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 sticky top-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Schedule Summary
                  </h3>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  loanCategory === "ADVANCE_INTEREST"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : loanCategory === "INTEREST_PRINCIPAL"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                }`}>
                  {loanCategory === "ADVANCE_INTEREST"
                    ? "Advance Interest"
                    : loanCategory === "INTEREST_PRINCIPAL"
                    ? "Interest + Principal"
                    : "Standard Loan"}
                </span>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 font-mono text-xs">
                {/* 1. Face / Principal Amount */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-sans">
                    {loanCategory === "ADVANCE_INTEREST" ? "Face Loan Amount:" : "Principal Loan Amount:"}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(calcResult.principal)}
                  </span>
                </div>

                {/* 2. Advance Interest or Total Interest */}
                {loanCategory === "ADVANCE_INTEREST" ? (
                  <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                    <span className="font-sans">Advance Interest (Upfront):</span>
                    <span className="font-bold">
                      -{formatCurrency(calcResult.advanceInterest)}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-center text-amber-600">
                    <span className="font-sans">Total Scheduled Interest:</span>
                    <span className="font-bold">
                      +{formatCurrency(calcResult.totalInterest)}
                    </span>
                  </div>
                )}

                {/* 3. Processing Fee */}
                {calcResult.processingFee > 0 && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="font-sans">Charges / Fee:</span>
                    <span className="font-bold">
                      -{formatCurrency(calcResult.processingFee)}
                    </span>
                  </div>
                )}

                {/* 4. Mandatory Customer Receives Callout (Requirement 6) */}
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-emerald-100/70 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300">
                  <span className="font-sans font-black text-xs">Customer Receives:</span>
                  <span className="font-black text-sm">
                    {formatCurrency(calcResult.customerReceives)}
                  </span>
                </div>

                {/* 5. Total Payable / Collection */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 flex justify-between items-center text-sm font-black">
                  <span className="text-slate-900 dark:text-slate-100 font-sans">
                    {loanCategory === "ADVANCE_INTEREST" ? "Total Collection:" : "Total Payable:"}
                  </span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(calcResult.totalPayable)}
                  </span>
                </div>

                {/* 6. Installment Due */}
                <div className="flex justify-between items-center text-sm font-black">
                  <span className="text-emerald-700 dark:text-emerald-400 font-sans">
                    Installment Due:
                  </span>
                  <span className="text-emerald-600">
                    {formatCurrency(calcResult.installmentAmount)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-sans text-right pt-0.5">
                  {calcResult.totalInstallments} {
                    loanCategory === "ADVANCE_INTEREST"
                      ? (advFrequency === "DAILY" ? "Daily Collections" : advFrequency === "WEEKLY" ? "Weekly Collections" : "Monthly Collections")
                      : loanCategory === "INTEREST_PRINCIPAL"
                      ? (ipFrequency === "DAILY" ? "Daily Collections" : ipFrequency === "WEEKLY" ? "Weekly Collections" : "Monthly Collections")
                      : (paymentFrequency === "DAILY" ? "Daily Collections" : paymentFrequency === "WEEKLY" ? "Weekly Collections" : "Monthly Collections")
                  }
                </div>
              </div>

              {/* Installment breakdown preview (Requirement 6) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Due Schedule Preview
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowScheduleModal(true)}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View All ({calcResult.schedule.length}) →
                  </button>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {calcResult.schedule.slice(0, 5).map((s) => (
                    <div
                      key={s.installmentNumber}
                      className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 font-mono text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-800 dark:text-slate-200 font-sans font-bold">
                          Due #{s.installmentNumber} • {formatDate(s.dueDate)}
                        </span>
                        <span className="font-bold text-emerald-600 font-mono">
                          {formatCurrency(s.installmentAmount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-100 dark:border-slate-700/40">
                        <span>P: ₹{s.principalPortion.toLocaleString("en-IN")} • I: ₹{s.interestPortion.toLocaleString("en-IN")}</span>
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Balance: ₹{s.remainingPrincipal.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? "Disbursing Loan..." : "DISBURSE LOAN NOW"}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* FULL INSTALLMENT SCHEDULE MODAL (Requirement 6) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Complete Due Schedule Preview ({calcResult.schedule.length} Installments)
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Principal: ₹{calcResult.principal.toLocaleString("en-IN")} • Total Repayable: ₹{calcResult.totalPayable.toLocaleString("en-IN")}
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
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Expected Amount</th>
                    <th className="py-2.5 px-3 text-right">Principal</th>
                    <th className="py-2.5 px-3 text-right">Interest</th>
                    <th className="py-2.5 px-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {calcResult.schedule.map((s) => (
                    <tr key={s.installmentNumber} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-bold text-indigo-600">{s.installmentNumber}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300">{formatDate(s.dueDate)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">{formatCurrency(s.installmentAmount)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">₹{s.principalPortion.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 px-3 text-right text-amber-600">₹{s.interestPortion.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800 dark:text-slate-200">₹{s.remainingPrincipal.toLocaleString("en-IN")}</td>
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
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
