import React, { useState } from "react";
import {
  CheckCircle2,
  Share2,
  X,
  Download,
  Printer,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { LoanPayment } from "../types";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import {
  generateCollectionReceiptPdf,
  downloadPdf,
  printPdf,
  CollectionReceiptData,
  DEFAULT_COMPANY_PROFILE,
} from "../services/documentGenerator";

interface ReceiptModalProps {
  isOpen: boolean;
  payment: LoanPayment | null;
  customerName?: string;
  mobile?: string;
  loanNo?: string;
  currentOutstanding?: number;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  payment,
  customerName,
  mobile,
  loanNo,
  currentOutstanding = 0,
  onClose,
}) => {
  const { language, user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [waStatus, setWaStatus] = useState<"IDLE" | "PENDING" | "SENT" | "FAILED" | "MANUAL">("IDLE");
  const [waMessage, setWaMessage] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  if (!isOpen || !payment) return null;

  const receiptNumber = (payment as any).receiptNo || payment.paymentNo || "ABC/RCPT/2026/000001";
  const loanNumber = loanNo || payment.loan?.loanNo || "ABC/LOAN/2026/000001";
  const custName = customerName || payment.customer?.name || "Customer";
  const custPhone = mobile || payment.customer?.mobile || "";
  const paymentMethod = ((payment.paymentMethod || "CASH") as "CASH" | "UPI" | "BANK");

  const buildReceiptData = (): CollectionReceiptData => {
    const prevOutstanding = currentOutstanding + payment.principalPortion + payment.interestPortion;
    return {
      receiptNo: receiptNumber,
      loanNo: loanNumber,
      collectionDate: payment.date || new Date(),
      actualPaymentDate: payment.date || new Date(),
      customer: {
        name: custName,
        mobile: custPhone,
        address: payment.customer?.city || undefined,
      },
      previousOutstanding: prevOutstanding,
      principalPaid: payment.principalPortion,
      interestPaid: payment.interestPortion,
      otherCharges: (payment as any).lateFeePortion || 0,
      totalAmountPaid: payment.amount,
      currentOutstanding,
      paymentMethod,
      referenceNo: payment.referenceNo || undefined,
      collectedBy: user?.name || "ABC FINANCE Representative",
      company: DEFAULT_COMPANY_PROFILE,
    };
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      setDownloadError(null);
      setDownloadSuccess(null);
      setPrintError(null);
      const data = buildReceiptData();
      const doc = await generateCollectionReceiptPdf(data);
      const safeNo = receiptNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
      await downloadPdf(doc, `${safeNo}_Receipt.pdf`);
      setDownloadSuccess(
        language === "ta"
          ? "ரசீது PDF வெற்றிகரமாக உருவாக்கப்பட்டு திறக்கப்பட்டது!"
          : "Receipt PDF generated and opened successfully!"
      );
    } catch (err: unknown) {
      console.error("PDF download failed:", err);
      const msg = err instanceof Error ? err.message : "ரசீது பதிவிறக்கம் தோல்வி / PDF download failed";
      setDownloadError(msg);
      // Fallback to server download URL
      if (payment.id) {
        window.open(api.getCollectionReceiptDownloadUrl(payment.id), "_blank");
      }
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintPdf = async () => {
    try {
      setPrinting(true);
      setPrintError(null);
      setDownloadError(null);
      const data = buildReceiptData();
      const doc = await generateCollectionReceiptPdf(data);
      const safeNo = receiptNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
      await printPdf(doc, `${safeNo}_Receipt.pdf`);
    } catch (err: unknown) {
      console.error("Print failed:", err);
      const msg = err instanceof Error ? err.message : "அச்சு தோல்வி / Printing failed";
      setPrintError(msg);
    } finally {
      setPrinting(false);
    }
  };

  const handleShareWhatsApp = async () => {
    try {
      setWaLoading(true);
      setWaStatus("PENDING");
      setWaMessage(null);

      // Attempt server-side WhatsApp dispatch
      if (payment.id) {
        const res = await api.sendWhatsAppDocument("RECEIPT", payment.id, custPhone);
        if (res.status === "SENT") {
          setWaStatus("SENT");
          setWaMessage(language === "ta" ? "வாட்ஸ்அப் ரசீது அனுப்பப்பட்டது!" : "WhatsApp receipt sent successfully!");
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
    const text = `*ABC FINANCE - PAYMENT RECEIPT*
--------------------------------
Receipt No: ${receiptNumber}
Loan No: ${loanNumber}
Customer: ${custName}
Date: ${new Date(payment.date || Date.now()).toLocaleDateString("en-IN")}
Amount Paid: Rs. ${payment.amount.toLocaleString("en-IN")}
Principal Credited: Rs. ${payment.principalPortion.toLocaleString("en-IN")}
Interest Credited: Rs. ${payment.interestPortion.toLocaleString("en-IN")}
Remaining Outstanding: Rs. ${currentOutstanding.toLocaleString("en-IN")}
Payment Mode: ${paymentMethod}
Received By: ${user?.name || "ABC FINANCE Representative"}
--------------------------------
Thank you for your payment! Please preserve this receipt for your records.
ABC FINANCE | Contact: +91 96008 71898`;

    const clean = custPhone.replace(/\D/g, "");
    const waPhone = clean.length === 10 ? `91${clean}` : clean;
    const url = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        {/* Header with ABC FINANCE Branding */}
        <div className="text-center space-y-1 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-1 -right-1 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>ABC FINANCE</span>
          </div>

          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {language === "ta" ? "அதிகாரப்பூர்வ வசூல் ரசீது" : "Official Collection Receipt"}
          </h3>
          <p className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
            {receiptNumber}
          </p>
        </div>

        {/* Receipt Details Card */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-2.5 text-xs border border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
            <span className="text-slate-500">{language === "ta" ? "வாடிக்கையாளர்" : "Customer"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {custName}
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
            <span className="text-slate-500">{language === "ta" ? "கடன் எண்" : "Loan No"}:</span>
            <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
              {loanNumber}
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
            <span className="text-slate-500">{language === "ta" ? "பணம் செலுத்திய முறை" : "Payment Mode"}:</span>
            <span className="px-2 py-0.5 rounded-md font-bold text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
              {paymentMethod}
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
            <span className="text-slate-500">{language === "ta" ? "அசல் பகுதி" : "Principal Portion"}:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              ₹{payment.principalPortion.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex justify-between items-center border-b border-slate-200/60 dark:border-slate-700/60 pb-1.5">
            <span className="text-slate-500">{language === "ta" ? "வட்டி பகுதி" : "Interest Portion"}:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              ₹{payment.interestPortion.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-700">
            <span className="font-bold text-slate-800 dark:text-white">
              {language === "ta" ? "செலுத்திய தொகை" : "Total Received"}:
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 text-base font-extrabold">
              ₹{payment.amount.toLocaleString("en-IN")}
            </span>
          </div>

          <div className="flex justify-between items-center text-[11px] pt-0.5 text-slate-500">
            <span>{language === "ta" ? "மீதமுள்ள நிலுவை" : "Remaining Outstanding"}:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              ₹{currentOutstanding.toLocaleString("en-IN")}
            </span>
          </div>
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
                <CheckCircle2 className="w-3.5 h-3.5" />
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

        {/* PDF Download Success Banner */}
        {downloadSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
            <button
              type="button"
              onClick={() => setDownloadSuccess(null)}
              className="text-[11px] font-bold text-emerald-600 underline ml-2"
            >
              OK
            </button>
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

        {/* Print Error Banner */}
        {printError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{printError}</span>
            </div>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="text-[11px] font-bold text-red-600 underline ml-2"
            >
              {language === "ta" ? "மீண்டும் முயற்சி" : "Retry"}
            </button>
          </div>
        )}

        {/* Action Buttons: Download PDF, Print, WhatsApp */}
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
              {language === "ta" ? "வாட்ஸ்அப் ரசீது & ஆவணம் அனுப்பு" : "Send WhatsApp Receipt & PDF"}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center justify-center gap-1.5 tap-active disabled:opacity-50"
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
              <span>{printing ? "Printing..." : "Print Receipt"}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold tap-active"
          >
            {language === "ta" ? "முடிந்தது" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
};
