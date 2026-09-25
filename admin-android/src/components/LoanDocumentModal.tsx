import React, { useState } from "react";
import {
  FileText,
  Share2,
  X,
  Download,
  Printer,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Layers,
} from "lucide-react";
import { LoanDetail } from "../types";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  generateLoanDocumentPdf,
  downloadPdf,
  printPdf,
  LoanDocumentData,
  DEFAULT_COMPANY_PROFILE,
  formatIndianCurrency,
  formatDDMMYYYY,
} from "../services/documentGenerator";

interface LoanDocumentModalProps {
  isOpen: boolean;
  loan: LoanDetail | null;
  onClose: () => void;
}

export const LoanDocumentModal: React.FC<LoanDocumentModalProps> = ({
  isOpen,
  loan,
  onClose,
}) => {
  const { language } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waStatus, setWaStatus] = useState<"IDLE" | "PENDING" | "SENT" | "FAILED" | "MANUAL">("IDLE");
  const [waMessage, setWaMessage] = useState<string | null>(null);

  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!isOpen || !loan) return null;

  const loanNo = loan.loanNo || "ABC/LOAN/2026/000001";
  const customerName = loan.customer?.name || "Customer";
  const customerMobile = loan.customer?.mobile || "";
  const totalPayable = loan.totalPayable || (loan.principalAmount || 0) + (loan.interestOutstanding || 0);

  const buildLoanData = (): LoanDocumentData => {
    const rawList: any[] = (loan.installments && loan.installments.length > 0)
      ? loan.installments
      : ((loan as any).schedule && (loan as any).schedule.length > 0)
      ? (loan as any).schedule
      : [];

    let installments: any[] = [];

    if (rawList.length > 0) {
      installments = rawList.map((inst: any, idx: number) => {
        const instNum = inst.installmentNumber ?? inst.installmentNo ?? (idx + 1);
        const expAmt = Number(inst.installmentAmount ?? inst.amount ?? loan.installmentAmount ?? 0);
        const prin = Number(inst.principalPortion ?? (loan.principalAmount / (loan.totalInstallments || 1)));
        const intVal = Number(inst.interestPortion ?? ((totalPayable - loan.principalAmount) / (loan.totalInstallments || 1)));
        const paid = Number(inst.paidAmount ?? (inst.status === "PAID" || inst.status === "COLLECTED" ? expAmt : 0));
        const bal = Number(inst.balanceAmount ?? Math.max(0, expAmt - paid));

        return {
          installmentNumber: instNum,
          dueDate: inst.dueDate || new Date(),
          principalAmount: prin,
          interestAmount: intVal,
          installmentAmount: expAmt,
          paidAmount: paid,
          balanceAmount: bal,
          status: inst.status || (bal === 0 ? "COLLECTED" : "PENDING"),
        };
      });
    } else {
      // Fallback synthesis from loan parameters
      const count = loan.totalInstallments || 1;
      const expAmt = loan.installmentAmount || (totalPayable / count);
      const prinPerInst = (loan.principalAmount || 0) / count;
      const intPerInst = Math.max(0, totalPayable - (loan.principalAmount || 0)) / count;
      const baseDate = loan.createdAt ? new Date(loan.createdAt) : new Date();

      for (let i = 1; i <= count; i++) {
        const dDate = new Date(baseDate);
        if (loan.paymentFrequency === "DAILY") {
          dDate.setDate(dDate.getDate() + i);
        } else if (loan.paymentFrequency === "WEEKLY") {
          dDate.setDate(dDate.getDate() + i * 7);
        } else {
          dDate.setMonth(dDate.getMonth() + i);
        }
        installments.push({
          installmentNumber: i,
          dueDate: dDate,
          principalAmount: Math.round(prinPerInst),
          interestAmount: Math.round(intPerInst),
          installmentAmount: Math.round(expAmt),
          paidAmount: 0,
          balanceAmount: Math.round(expAmt),
          status: "PENDING",
        });
      }
    }

    return {
      loanNo,
      date: loan.createdAt || loan.dueDate || new Date(),
      customer: {
        name: customerName,
        mobile: customerMobile,
        address: (loan.customer as any)?.address || (loan.customer as any)?.city || undefined,
        customerId: (loan.customer as any)?.customerCode || undefined,
      },
      principalAmount: loan.principalAmount,
      interestType: loan.interestType || "PERCENTAGE",
      interestRate: loan.interestRate || 0,
      interestFrequency: (loan as any).interestFrequency || "MONTHLY",
      paymentFrequency: loan.paymentFrequency || "DAILY",
      totalInstallments: loan.totalInstallments || installments.length || 1,
      installmentAmount: loan.installmentAmount,
      totalInterest: Math.max(0, totalPayable - loan.principalAmount),
      totalPayable,
      schedule: installments,
      company: DEFAULT_COMPANY_PROFILE,
    };
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setDownloadError(null);
      const data = buildLoanData();
      const doc = await generateLoanDocumentPdf(data);
      const safeNo = loanNo.replace(/[^a-zA-Z0-9_-]/g, "_");
      downloadPdf(doc, `${safeNo}_Sanction_Order.pdf`);
    } catch (err: unknown) {
      console.error("Loan PDF download failed:", err);
      const msg = err instanceof Error ? err.message : "PDF பதிவிறக்கம் தோல்வி / PDF download failed";
      setDownloadError(msg);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPdf = async () => {
    try {
      setPrinting(true);
      const data = buildLoanData();
      const doc = await generateLoanDocumentPdf(data);
      printPdf(doc);
    } catch (err: unknown) {
      console.error("Print failed:", err);
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  const handleShareWhatsApp = async () => {
    try {
      setWaLoading(true);
      setWaStatus("PENDING");
      setWaMessage(null);

      if (loan.id) {
        const res = await api.sendWhatsAppDocument("LOAN", loan.id, customerMobile);
        if (res.status === "SENT") {
          setWaStatus("SENT");
          setWaMessage(
            language === "ta"
              ? "வாட்ஸ்அப் கடன் ஆவணம் அனுப்பப்பட்டது!"
              : "Loan sanction document sent via WhatsApp!"
          );
          return;
        } else if (res.status === "NOT_CONFIGURED" || res.deliveryMode === "MANUAL") {
          setWaStatus("MANUAL");
          setWaMessage(
            language === "ta"
              ? "நேரடி வாட்ஸ்அப் வழியாக திறக்கப்படுகிறது..."
              : "Opening official WhatsApp share..."
          );
          if (res.shareUrl) {
            window.open(res.shareUrl, "_blank");
          } else {
            fallbackManualShare();
          }
          return;
        } else {
          setWaStatus("FAILED");
          setWaMessage(res.error || (language === "ta" ? "அனுப்புவதில் தோல்வி" : "Delivery failed"));
          return;
        }
      }

      fallbackManualShare();
    } catch (err: unknown) {
      setWaStatus("FAILED");
      setWaMessage(err instanceof Error ? err.message : "WhatsApp dispatch error");
    } finally {
      setWaLoading(false);
    }
  };

  const fallbackManualShare = () => {
    const text = `*ABC FINANCE - LOAN SANCTION ORDER*
--------------------------------
Loan No: ${loanNo}
Customer: ${customerName}
Sanctioned Principal: Rs. ${loan.principalAmount.toLocaleString("en-IN")}
Total Repayable: Rs. ${totalPayable.toLocaleString("en-IN")}
Tenure: ${loan.totalInstallments} ${loan.paymentFrequency} installments
Installment Amount: Rs. ${loan.installmentAmount.toLocaleString("en-IN")}
--------------------------------
Your official loan sanction document with complete installment schedule has been generated.
ABC FINANCE | Contact: +91 96008 71898`;

    const clean = customerMobile.replace(/\D/g, "");
    const waPhone = clean.length === 10 ? `91${clean}` : clean;
    const url = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center space-y-1 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-1 -right-1 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <FileText className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>ABC FINANCE</span>
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {language === "ta" ? "கடன் அனுமதி ஆவணம் (PDF)" : "Official Loan Sanction Document"}
          </h3>
          <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {loanNo}
          </p>
        </div>

        {/* Loan Financial Summary Box */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <div>
              <span className="text-[11px] text-slate-400 block">{language === "ta" ? "வாடிக்கையாளர்" : "Borrower"}</span>
              <span className="text-sm font-bold text-white">{customerName}</span>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">{language === "ta" ? "தொடர்பு" : "Contact"}</span>
              <span className="text-xs font-semibold text-slate-300">{customerMobile || "N/A"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block">{language === "ta" ? "வழங்கிய அசல்" : "Principal Sanctioned"}</span>
              <span className="text-sm font-extrabold text-white">
                ₹{loan.principalAmount.toLocaleString("en-IN")}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">{language === "ta" ? "மொத்த திருப்பிச் செலுத்த வேண்டியது" : "Total Repayable"}</span>
              <span className="text-sm font-extrabold text-indigo-300">
                ₹{totalPayable.toLocaleString("en-IN")}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">{language === "ta" ? "தவணை முறை" : "Frequency"}</span>
              <span className="text-xs font-semibold text-slate-200">
                {loan.paymentFrequency} ({loan.totalInstallments} தவணைகள்)
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">{language === "ta" ? "தவணை தொகை" : "Installment Amount"}</span>
              <span className="text-sm font-extrabold text-emerald-400">
                ₹{loan.installmentAmount.toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>

        {/* Schedule Highlights */}
        <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              {language === "ta" ? "தவணை அட்டவணை நிலை" : "Repayment Schedule Status"}
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              {loan.installments?.length || loan.totalInstallments} {language === "ta" ? "தவணைகள் தயார்" : "installments ready"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {language === "ta"
              ? "முழுமையான 8-நெடுவரிசை தவணை அட்டவணை PDF ஆவணத்தில் A4 அளவில் சேர்க்கப்பட்டுள்ளது."
              : "Full 8-column installment schedule with principal/interest split is embedded in the official A4 PDF."}
          </p>
        </div>

        {/* WhatsApp Delivery Status Badge */}
        {waStatus !== "IDLE" && (
          <div
            className={`p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 ${
              waStatus === "SENT"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : waStatus === "FAILED"
                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                : waStatus === "PENDING"
                ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
            }`}
          >
            <div className="flex items-center gap-1.5">
              {waStatus === "PENDING" ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : waStatus === "FAILED" ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span className="font-medium">{waMessage || `Status: ${waStatus}`}</span>
            </div>

            {waStatus === "FAILED" && (
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="px-2 py-1 rounded bg-red-600 text-white text-[10px] font-bold tap-active"
              >
                {language === "ta" ? "மீண்டும் முயற்சி" : "RETRY"}
              </button>
            )}
          </div>
        )}

        {/* PDF Download Error Banner */}
        {downloadError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{downloadError}</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="text-[11px] font-bold text-red-600 underline ml-2"
            >
              {language === "ta" ? "மீண்டும் முயற்சி" : "Retry"}
            </button>
          </div>
        )}

        {/* Document Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            disabled={waLoading}
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 tap-active disabled:opacity-50"
          >
            {waLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span>
              {language === "ta" ? "வாட்ஸ்அப் கடன் ஆவணம் அனுப்பு" : "Send WhatsApp Loan Sanction PDF"}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md tap-active disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? "PDF..." : "Download PDF"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintPdf}
              disabled={printing}
              className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 tap-active disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{printing ? "Printing..." : "Print Order"}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold tap-active"
          >
            {language === "ta" ? "மூடு" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
};
