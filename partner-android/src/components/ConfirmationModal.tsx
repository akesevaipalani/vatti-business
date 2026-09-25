import React from "react";
import { AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  customerName: string;
  amount: number;
  loanNo: string;
  installmentNo: number;
  collectionDate: string;
  paymentMethod: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  customerName,
  amount,
  loanNo,
  installmentNo,
  collectionDate,
  paymentMethod,
  onConfirm,
  onCancel,
  isLoading,
}) => {
  const { language } = useAuth();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              {title}
            </h3>
            <p className="text-xs text-slate-500">
              {language === "ta" ? "பரிவர்த்தனையை உறுதிப்படுத்தவும்" : "Please confirm transaction details"}
            </p>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500">{language === "ta" ? "வாடிக்கையாளர்" : "Customer"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{customerName}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500">{language === "ta" ? "கடன் எண்" : "Loan & Inst"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{loanNo} (Inst #{installmentNo})</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500">{language === "ta" ? "வசூல் தேதி" : "Collection Date"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{collectionDate}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500">{language === "ta" ? "செலுத்தும் முறை" : "Payment Mode"}:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{paymentMethod}</span>
          </div>
          <div className="flex justify-between items-center pt-1 text-sm font-bold">
            <span className="text-slate-700 dark:text-slate-300">{language === "ta" ? "வசூல் தொகை" : "Amount"}:</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-base">₹{amount.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 transition tap-active disabled:opacity-50"
          >
            {language === "ta" ? "ரத்து செய்" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-500/20 tap-active disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>{language === "ta" ? "உறுதி செய்" : "Confirm"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
