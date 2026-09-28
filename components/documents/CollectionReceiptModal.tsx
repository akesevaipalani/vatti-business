"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Printer,
  Download,
  Share2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Loader2,
} from "lucide-react";

export interface ReceiptData {
  receiptNo: string;
  loanNo: string;
  collectionDate: string | Date;
  actualPaymentDate?: string | Date;
  scheduledDueDate?: string | Date;
  installmentNumber?: number;
  customer: {
    name: string;
    mobile: string;
    address?: string;
  };
  previousOutstanding: number;
  principalPaid: number;
  interestPaid: number;
  otherCharges?: number;
  totalAmountPaid: number;
  currentOutstanding: number;
  paymentMethod: "CASH" | "UPI" | "BANK" | string;
  referenceNo?: string;
  collectedBy?: string;
  company?: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    pincode?: string;
    gstin?: string;
    pan?: string;
    logoUrl?: string | null;
  };
}

interface CollectionReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentId?: string | null;
  initialData?: Partial<ReceiptData> | null;
}

function formatIndianNumber(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return "0";
  return Math.round(num).toLocaleString("en-IN");
}

function formatDateDDMMYYYY(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return "-";
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    const [y, m, d] = dateInput.split("-");
    return `${d}/${m}/${y}`;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

export function CollectionReceiptModal({
  isOpen,
  onClose,
  paymentId,
  initialData,
}: CollectionReceiptModalProps) {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PDF Action state
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // WhatsApp Action state
  const [waLoading, setWaLoading] = useState(false);
  const [waStatus, setWaStatus] = useState<"IDLE" | "PENDING" | "SENT" | "MANUAL" | "FAILED">("IDLE");
  const [waMessage, setWaMessage] = useState<string | null>(null);
  const [waShareUrl, setWaShareUrl] = useState<string | null>(null);
  const [copiedWaText, setCopiedWaText] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Load authoritative receipt data when opened
  useEffect(() => {
    if (!isOpen) {
      setReceipt(null);
      setError(null);
      setPdfError(null);
      setWaStatus("IDLE");
      setWaMessage(null);
      setWaShareUrl(null);
      return;
    }

    if (initialData) {
      setReceipt(initialData as ReceiptData);
    }

    if (paymentId) {
      setLoading(true);
      fetch(`/api/documents/collection-receipt?paymentId=${paymentId}&format=json`)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`Failed to load receipt details (${res.status})`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.receipt) {
            setReceipt(data.receipt);
            if (data.whatsappMessage) {
              setWaMessage(data.whatsappMessage);
            }
          }
        })
        .catch((err: any) => {
          console.warn("Could not fetch remote receipt particulars:", err);
          if (!initialData) {
            setError(err.message || "Failed to load receipt details");
          }
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, paymentId, initialData]);

  if (!isOpen) return null;

  // 1. Isolated Print Handler: Prints ONLY the receipt document
  const handlePrint = () => {
    try {
      const printNode = printAreaRef.current;
      if (!printNode) return;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document;
      if (!frameDoc) {
        document.body.removeChild(iframe);
        return;
      }

      frameDoc.open();
      frameDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt_${receipt?.receiptNo || "Vatti"}</title>
            <style>
              @page { size: A4 portrait; margin: 15mm; }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                margin: 0;
                padding: 0;
                color: #0f172a;
                background: #ffffff;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              * { box-sizing: border-box; }
              .receipt-wrapper {
                width: 100%;
                max-width: 180mm;
                margin: 0 auto;
              }
              table { width: 100%; border-collapse: collapse; }
              th, td { padding: 6px 8px; text-align: left; }
            </style>
          </head>
          <body>
            <div class="receipt-wrapper">
              ${printNode.innerHTML}
            </div>
          </body>
        </html>
      `);
      frameDoc.close();

      iframe.contentWindow?.focus();
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch (e) {
          console.error("Print invocation failed:", e);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 250);
    } catch (e) {
      console.error("Error initiating receipt print:", e);
    }
  };

  // 2. Download PDF Handler
  const handleDownloadPdf = async () => {
    if (!paymentId && !receipt) return;
    setDownloadingPdf(true);
    setPdfError(null);

    try {
      const targetUrl = paymentId
        ? `/api/documents/collection-receipt?paymentId=${paymentId}&download=1`
        : `/api/documents/collection-receipt?receiptNo=${encodeURIComponent(receipt?.receiptNo || "")}&download=1`;

      const res = await fetch(targetUrl);
      if (!res.ok) {
        throw new Error(`PDF download failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const safeNo = (receipt?.receiptNo || "Collection").replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `${safeNo}_Receipt.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("PDF download failed:", err);
      setPdfError(err.message || "Failed to download PDF. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // 3. WhatsApp Share / Send Handler
  const handleWhatsApp = async () => {
    if (!receipt) return;
    setWaLoading(true);
    setWaStatus("PENDING");

    try {
      if (paymentId) {
        const res = await fetch("/api/documents/send-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "RECEIPT",
            id: paymentId,
            recipientPhone: receipt.customer.mobile,
          }),
        });

        const data = await res.json();
        if (data.status === "SENT") {
          setWaStatus("SENT");
          return;
        }

        if (data.shareUrl) {
          setWaStatus("MANUAL");
          setWaShareUrl(data.shareUrl);
          if (data.messageText) setWaMessage(data.messageText);
          window.open(data.shareUrl, "_blank");
          return;
        }
      }

      // Fallback: Build standard WhatsApp Web / App share URL
      const cleanPhone = (receipt.customer.mobile || "").replace(/\D/g, "");
      const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const msg =
        waMessage ||
        `*${(receipt.company?.name || "VATTI BUSINESS").toUpperCase()} – Collection Receipt*\n\nDear *${receipt.customer.name}*,\n\nYour payment has been successfully received.\n\n*Receipt Details:*\n• *Receipt No:* ${receipt.receiptNo}\n• *Loan No:* ${receipt.loanNo}\n• *Collection Date:* ${formatDateDDMMYYYY(receipt.collectionDate)}\n• *Previous Outstanding Balance:* ₹${formatIndianNumber(receipt.previousOutstanding)}\n• *Principal Component Credited:* ₹${formatIndianNumber(receipt.principalPaid)}\n• *Interest Component Credited:* ₹${formatIndianNumber(receipt.interestPaid)}\n• *Total Amount Received:* ₹${formatIndianNumber(receipt.totalAmountPaid)}\n• *Remaining Outstanding Balance:* ₹${formatIndianNumber(receipt.currentOutstanding)}\n• *Payment Mode:* ${receipt.paymentMethod}\n\nThank you.\n\n*${receipt.company?.name || "VATTI BUSINESS"}*\nVATTI BUSINESS – Private Business Management System`;

      const directShareUrl = waPhone
        ? `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;

      setWaStatus("MANUAL");
      setWaShareUrl(directShareUrl);
      setWaMessage(msg);
      window.open(directShareUrl, "_blank");
    } catch (err: any) {
      console.error("WhatsApp dispatch error:", err);
      setWaStatus("FAILED");
    } finally {
      setWaLoading(false);
    }
  };

  const handleCopyWaText = () => {
    if (!waMessage && !receipt) return;
    const textToCopy =
      waMessage ||
      `*${(receipt?.company?.name || "VATTI BUSINESS").toUpperCase()} – Collection Receipt*\n\nDear *${receipt?.customer.name}*,\n\nYour payment has been successfully received.\n\n• *Receipt No:* ${receipt?.receiptNo}\n• *Loan No:* ${receipt?.loanNo}\n• *Collection Date:* ${formatDateDDMMYYYY(receipt?.collectionDate)}\n• *Amount Paid:* ₹${formatIndianNumber(receipt?.totalAmountPaid)}\n• *Outstanding:* ₹${formatIndianNumber(receipt?.currentOutstanding)}\n\nThank you.\nVATTI BUSINESS`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedWaText(true);
    setTimeout(() => setCopiedWaText(false), 2000);
  };

  const company = receipt?.company || {
    name: "ABC FINANCE",
    phone: "+91 96008 71898",
    email: "contact@vattibusiness.com",
    address: "123, Gandhi Road, Main Bazaar",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600001",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/60 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Payment Recorded Successfully
                </h2>
                {receipt?.receiptNo && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {receipt.receiptNo}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Official transaction document generated & committed to database
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/60 dark:bg-slate-950/40">
          {loading && !receipt ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">Generating official receipt...</p>
            </div>
          ) : error && !receipt ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : receipt ? (
            /* A4-Ready Document Container */
            <div
              ref={printAreaRef}
              id="vatti-collection-receipt-print-area"
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-900 font-sans space-y-4 text-xs"
            >
              {/* Document Header */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200">
                <div className="flex items-start gap-3">
                  {company.logoUrl && (
                    <img
                      src={company.logoUrl}
                      alt={company.name}
                      className="w-12 h-12 object-contain rounded"
                    />
                  )}
                  <div>
                    <h1 className="text-base font-extrabold uppercase tracking-tight text-slate-900">
                      {company.name}
                    </h1>
                    <div className="text-[11px] text-slate-500 leading-tight space-y-0.5 mt-0.5">
                      <p>
                        {[company.address, company.city, company.state, company.pincode]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p>
                        Phone: {company.phone}
                        {company.email ? ` | Email: ${company.email}` : ""}
                      </p>
                      {(company.gstin || company.pan) && (
                        <p className="font-mono text-[10px]">
                          {company.gstin ? `GSTIN: ${company.gstin} ` : ""}
                          {company.pan ? `| PAN: ${company.pan}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* System Branding Badge */}
                <div className="text-right shrink-0">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    VATTI BUSINESS
                  </span>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                    Private Business Management System
                  </div>
                </div>
              </div>

              {/* Title Ribbon */}
              <div className="bg-slate-900 text-white rounded-lg py-1.5 px-3 flex items-center justify-between font-bold text-center">
                <span className="tracking-wider uppercase text-[11px]">
                  OFFICIAL COLLECTION RECEIPT
                </span>
                <span className="text-[10px] font-normal opacity-80">ORIGINAL CUSTOMER COPY</span>
              </div>

              {/* Receipt Reference Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">
                    Receipt Number
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {receipt.receiptNo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">
                    Collection Date
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatDateDDMMYYYY(receipt.collectionDate)}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-slate-400 block text-[10px] font-medium uppercase">
                    Collection Time
                  </span>
                  <span className="font-mono text-slate-700">
                    {formatTime(receipt.collectionDate || receipt.actualPaymentDate) || "Recorded"}
                  </span>
                </div>
              </div>

              {/* Two-Column Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Customer Particulars */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1">
                    Customer Particulars
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-slate-900 text-sm">
                      {receipt.customer.name}
                    </div>
                    <div className="font-mono text-slate-600 mt-0.5">
                      📞 {receipt.customer.mobile}
                    </div>
                    {receipt.customer.address && (
                      <div className="text-slate-500 text-[11px] mt-0.5 line-clamp-2">
                        📍 {receipt.customer.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Loan & Reference Particulars */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1">
                    Loan Reference
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Loan Number:</span>
                      <span className="font-mono font-bold text-indigo-700">
                        {receipt.loanNo}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Installment:</span>
                      <span className="font-semibold text-slate-800">
                        {receipt.installmentNumber
                          ? `Installment #${receipt.installmentNumber}`
                          : "Regular Collection"}
                      </span>
                    </div>
                    {receipt.scheduledDueDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Scheduled Due:</span>
                        <span className="font-mono text-slate-700">
                          {formatDateDDMMYYYY(receipt.scheduledDueDate)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Payment Mode:</span>
                      <span className="px-1.5 py-0.2 rounded font-bold text-[10px] bg-slate-200 text-slate-800">
                        {receipt.paymentMethod}
                        {receipt.referenceNo ? ` (${receipt.referenceNo})` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Allocation Table */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-12 text-center">#</th>
                      <th className="py-2 px-3">Description / Accounting Particulars</th>
                      <th className="py-2 px-3 text-right w-36">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    <tr>
                      <td className="py-2 px-3 text-center text-slate-400">1</td>
                      <td className="py-2 px-3 font-sans text-slate-700">
                        Previous Outstanding Balance
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600">
                        ₹{formatIndianNumber(receipt.previousOutstanding)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-center text-slate-400">2</td>
                      <td className="py-2 px-3 font-sans text-slate-900 font-medium">
                        Principal Component Credited
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        ₹{formatIndianNumber(receipt.principalPaid)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-center text-slate-400">3</td>
                      <td className="py-2 px-3 font-sans text-amber-900 font-medium">
                        Interest Component Credited
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-amber-700">
                        ₹{formatIndianNumber(receipt.interestPaid)}
                      </td>
                    </tr>
                    {Boolean(receipt.otherCharges && receipt.otherCharges > 0) && (
                      <tr>
                        <td className="py-2 px-3 text-center text-slate-400">4</td>
                        <td className="py-2 px-3 font-sans text-slate-700">
                          Other Fees / Penal Charges
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700">
                          ₹{formatIndianNumber(receipt.otherCharges)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Paid & Remaining Balance Highlight Box */}
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-emerald-950">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 block">
                    TOTAL AMOUNT RECEIVED
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-800">
                    ₹{formatIndianNumber(receipt.totalAmountPaid)}
                  </span>
                </div>
                <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-emerald-200 pt-2 sm:pt-0 sm:pl-4">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-800 block">
                    REMAINING OUTSTANDING BALANCE
                  </span>
                  <span className="text-base font-black font-mono text-slate-900">
                    ₹{formatIndianNumber(receipt.currentOutstanding)}
                  </span>
                </div>
              </div>

              {/* Verification & Signatures */}
              <div className="pt-2 flex items-end justify-between text-[11px] text-slate-500">
                <div className="space-y-0.5">
                  <p>
                    <span className="font-semibold text-slate-700">Received By:</span>{" "}
                    {receipt.collectedBy || company.name}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Digitally recorded & ledger-posted via VATTI BUSINESS
                  </p>
                </div>
                <div className="text-right">
                  <div className="h-9 border-b border-dashed border-slate-300 w-36 mb-1"></div>
                  <span className="text-[10px] font-bold text-slate-700 block">
                    Authorized Signatory
                  </span>
                  <span className="text-[9px] text-slate-400">{company.name}</span>
                </div>
              </div>

              {/* Receipt Footer Notice */}
              <div className="text-center pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
                Thank you for your payment! Please preserve this receipt for your records.
              </div>
            </div>
          ) : null}

          {/* PDF Download Error banner */}
          {pdfError && (
            <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{pdfError}</span>
              </div>
              <button
                onClick={handleDownloadPdf}
                className="text-xs font-bold text-amber-900 underline hover:no-underline ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* WhatsApp Status feedback banner */}
          {waStatus === "SENT" && (
            <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Receipt sent successfully via WhatsApp Cloud API!</span>
            </div>
          )}
          {waStatus === "MANUAL" && (
            <div className="mt-3 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium">
                  <Share2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>WhatsApp manual share opened in browser/app.</span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyWaText}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition"
                >
                  {copiedWaText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWaText ? "Copied!" : "Copy Message"}</span>
                </button>
              </div>
              {waShareUrl && (
                <div className="text-[11px]">
                  Did not open automatically?{" "}
                  <a
                    href={waShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline text-blue-700"
                  >
                    Click here to open WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}
          {waStatus === "FAILED" && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Automatic WhatsApp dispatch failed. You can share manually.</span>
              </div>
              <button
                type="button"
                onClick={handleCopyWaText}
                className="text-xs font-bold text-rose-900 underline hover:no-underline ml-2"
              >
                Copy Text
              </button>
            </div>
          )}
        </div>

        {/* Modal Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2">
            {/* Print Receipt */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={!receipt}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              <span>Print Receipt</span>
            </button>

            {/* Download PDF */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || !receipt}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
            >
              {downloadingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-emerald-400" />
              )}
              <span>{downloadingPdf ? "Downloading..." : "Download PDF"}</span>
            </button>

            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsApp}
              disabled={waLoading || !receipt}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 disabled:opacity-50"
            >
              {waLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span>WhatsApp</span>
            </button>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
