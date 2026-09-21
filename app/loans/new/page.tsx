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
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { calculateLoan } from "@/lib/loans/calculator";

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

  // Form State
  const [customerId, setCustomerId] = useState("");
  const [principalAmount, setPrincipalAmount] = useState("50000");
  const [interestType, setInterestType] = useState<"FLAT" | "REDUCING" | "SIMPLE">("FLAT");
  const [interestRate, setInterestRate] = useState("2.0");
  const [interestFrequency, setInterestFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">("MONTHLY");
  const [paymentFrequency, setPaymentFrequency] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  const [totalInstallments, setTotalInstallments] = useState("10");
  const [processingFee, setProcessingFee] = useState("500");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  // Guarantor
  const [guarantorName, setGuarantorName] = useState("");
  const [guarantorMobile, setGuarantorMobile] = useState("");
  const [guarantorRelationship, setGuarantorRelationship] = useState("");

  // Collateral
  const [collateralType, setCollateralType] = useState("NONE");
  const [collateralDescription, setCollateralDescription] = useState("");
  const [collateralEstimatedValue, setCollateralEstimatedValue] = useState("");

  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        setCustomers(data.customers || []);
        if (data.customers?.length > 0) {
          setCustomerId(data.customers[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Compute live calculation
  const calcResult = calculateLoan({
    principal: Number(principalAmount) || 0,
    interestRate: Number(interestRate) || 0,
    interestType,
    interestFrequency,
    paymentFrequency,
    totalInstallments: Number(totalInstallments) || 1,
    startDate: new Date(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setErrorMsg("Please select or add a customer");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          principalAmount: Number(principalAmount),
          interestType,
          interestRate: Number(interestRate),
          interestFrequency,
          paymentFrequency,
          totalInstallments: Number(totalInstallments),
          processingFee: Number(processingFee),
          paymentMethod,
          notes,
          guarantorName,
          guarantorMobile,
          guarantorRelationship,
          collateralType: collateralType === "NONE" ? null : collateralType,
          collateralDescription,
          collateralEstimatedValue: Number(collateralEstimatedValue) || 0,
        }),
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
          {/* LEFT 2 COLUMNS: LOAN PARAMETERS & GUARANTOR */}
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
                      {c.name} ({c.mobile}) - {c.city || "Madurai"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 2. Loan Financial Terms & Calculator Inputs */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Loan Financial Terms</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Principal Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Interest Rate (% per frequency) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Interest Type
                  </label>
                  <select
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value as "FLAT" | "REDUCING" | "SIMPLE")}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="FLAT">Flat Interest</option>
                    <option value="REDUCING">Reducing Balance (EMI)</option>
                    <option value="SIMPLE">Simple Interest</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Interest Frequency
                  </label>
                  <select
                    value={interestFrequency}
                    onChange={(e) => {
                      const val = e.target.value as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
                      setInterestFrequency(val);
                      if (val === "DAILY" || val === "WEEKLY" || val === "MONTHLY") {
                        setPaymentFrequency(val);
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="MONTHLY">Monthly</option>
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Number of Installments
                  </label>
                  <input
                    type="number"
                    required
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursement Payment Mode
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
                    Processing Fee (₹)
                  </label>
                  <input
                    type="number"
                    value={processingFee}
                    onChange={(e) => setProcessingFee(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes / Terms
                </label>
                <input
                  type="text"
                  placeholder="e.g., Shop daily collection loan"
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
                    placeholder="Brother, Business Partner"
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
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Calculated Schedule Summary
                </h3>
              </div>

              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Principal Amount:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(calcResult.principal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Total Interest:</span>
                  <span className="font-bold text-amber-600">
                    {formatCurrency(calcResult.totalInterest)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-sm font-black">
                  <span className="text-slate-900 dark:text-slate-100 font-sans">Total Payable:</span>
                  <span className="text-indigo-600 dark:text-indigo-400">
                    {formatCurrency(calcResult.totalPayable)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-sm font-black">
                  <span className="text-emerald-700 dark:text-emerald-400 font-sans">Installment Amount:</span>
                  <span className="text-emerald-600">
                    {formatCurrency(calcResult.installmentAmount)}
                  </span>
                </div>
              </div>

              {/* Installment breakdown preview */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500">First 5 Installments Preview</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {calcResult.schedule.slice(0, 5).map((s) => (
                    <div
                      key={s.installmentNumber}
                      className="flex items-center justify-between text-[11px] p-2 rounded bg-slate-50 dark:bg-slate-800/50 font-mono"
                    >
                      <span className="text-slate-500 font-sans">
                        #{s.installmentNumber} ({formatDate(s.dueDate)})
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(s.installmentAmount)}
                      </span>
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
    </div>
  );
}
