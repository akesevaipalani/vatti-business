import React from "react";
import { CheckCircle2, Share2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LoanPayment } from "../types";

interface ReceiptModalProps {
  isOpen: boolean;
  payment: LoanPayment | null;
  customerName: string;
  mobile: string;
  loanNo: string;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  payment,
  customerName,
  mobile,
  loanNo,
  onClose,
}) => {
  const { language, user } = useAuth();

  if (!isOpen || !payment) return null;

  const handleShareReceipt = () => {
    // Architecture ready for WhatsApp Business Cloud API integration
    const text = `*VATTI BUSINESS - PAYMENT RECEIPT*\n` +
      `Receipt No: ${payment.paymentNo}\n` +
      `Customer: ${customerName}\n` +
      `Mobile: ${mobile}\n` +
      `Loan No: ${loanNo}\n` +
      `Amount Paid: ₹${payment.amount.toLocaleString("en-IN")}\n` +
      `Payment Method: ${payment.paymentMethod}\n` +
      `Date: ${new Date(payment.date).toLocaleDateString("en-IN")}\n` +
      `Collected By: ${user?.name || "Partner"}\n\n` +
      `Thank you! / நன்றி!`;

    if (navigator.share) {
      navigator.share({
        title: "Vatti Business Payment Receipt",
        text,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert(language === "ta" ? "ரசீது விவரங்கள் நகலெடுக்கப்பட்டது!" : "Receipt details copied to clipboard!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2.5 text-emerald-600">
            <CheckCircle2 className="w-7 h-7" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {language === "ta" ? "வசூல் பதிவு செய்யப்பட்டது" : "Collection Recorded"}
              </h3>
              <p className="text-[11px] text-slate-500">{payment.paymentNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 text-center">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
            {language === "ta" ? "பெறப்பட்ட தொகை" : "Amount Collected"}
          </span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
            ₹{payment.amount.toLocaleString("en-IN")}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500">{language === "ta" ? "வாடிக்கையாளர்" : "Customer"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{customerName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500">{language === "ta" ? "கடன் எண்" : "Loan No"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{loanNo}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500">{language === "ta" ? "தேதி" : "Date"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {new Date(payment.date).toLocaleDateString("en-IN")}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500">{language === "ta" ? "செலுத்தும் முறை" : "Method"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{payment.paymentMethod}</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-slate-500">{language === "ta" ? "வசூலித்தவர்" : "Collected By"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.name || "Partner"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={handleShareReceipt}
            className="w-full py-2.5 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-indigo-200 dark:border-indigo-800 tap-active"
          >
            <Share2 className="w-4 h-4" />
            <span>{language === "ta" ? "பகிரவும்" : "Share"}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900 text-white font-semibold text-xs tap-active"
          >
            {language === "ta" ? "சரி" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
};
