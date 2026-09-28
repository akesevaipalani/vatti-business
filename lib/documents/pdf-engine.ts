import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getLogoBase64 } from "./logo-helper";
import { formatISTDisplay, formatISTDateTime } from "@/lib/date";

export interface CompanyProfile {
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
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "ABC FINANCE",
  phone: "9600871898",
  email: "akesevaipalani@gmail.com",
  address: "Mill Road, Sanmugapuram",
  city: "Palani",
  state: "Tamil Nadu",
  pincode: "624601",
  gstin: "33AAAAA0000A1Z5",
  pan: "ABCDE1234F",
};

export interface InstallmentScheduleItem {
  installmentNumber: number;
  dueDate: string | Date;
  principalAmount: number;
  interestAmount: number;
  installmentAmount: number;
  paidAmount: number;
  balanceAmount: number;
  installmentBalance?: number;
  loanOutstanding?: number;
  status: string; // PENDING, COLLECTED, PARTIALLY_PAID, OVERDUE
}

export interface LoanDocumentData {
  loanNo: string;
  date: string | Date;
  customer: {
    name: string;
    mobile: string;
    address?: string;
    customerId?: string;
  };
  principalAmount: number; // Face Loan Amount
  customerReceives?: number; // Net Disbursement (Mandatory Step 3)
  advanceInterest?: number; // Advance interest deducted upfront
  processingFee?: number; // Charges
  loanCalculationType?: string; // STANDARD, ADVANCE_INTEREST, INTEREST_PRINCIPAL
  interestType: string;
  interestRate: number;
  interestFrequency: string;
  paymentFrequency: string;
  totalInstallments: number;
  installmentAmount: number;
  totalInterest: number;
  totalPayable: number;
  schedule: InstallmentScheduleItem[];
  company?: CompanyProfile;
}

export interface CollectionReceiptData {
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
  paymentMethod: "CASH" | "UPI" | "BANK";
  referenceNo?: string;
  collectedBy?: string;
  company?: CompanyProfile;
}

// Format number into Indian currency representation (e.g. 50,000 or Rs. 50,000)
export function formatIndianCurrency(amount: number, includeSymbol: boolean = true): string {
  const formatted = Math.round(amount || 0).toLocaleString("en-IN");
  return includeSymbol ? `Rs. ${formatted}` : formatted;
}

// Format date into DD/MM/YYYY in IST
export function formatDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  if (typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateInput.trim())) {
    const [y, m, d] = dateInput.trim().slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  }
  return formatISTDisplay(dateInput);
}

// Format date and time into DD/MM/YYYY hh:mm A in IST
export function formatDDMMYYYYTime(dateInput: string | Date | null | undefined): string {
  return formatISTDateTime(dateInput);
}

/**
 * 1. PROFESSIONAL LOAN DOCUMENT PDF (LOAN SANCTION & FULL REPAYMENT SCHEDULE)
 */
export function generateLoanDocumentPdf(data: LoanDocumentData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const company = data.company || DEFAULT_COMPANY_PROFILE;
  const logo = getLogoBase64();
  const pageWidth = doc.internal.pageSize.width; // 210mm
  const margin = 14;

  // Add Company Logo if available
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 10, 20, 20);
    } catch {
      // Fallback if logo invalid
    }
  }

  // Company Header Text
  const headerLeft = logo ? margin + 24 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // #0f172a slate-900
  doc.text(company.name.toUpperCase(), headerLeft, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // slate-600
  const addressLine = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(", ");
  doc.text(addressLine, headerLeft, 21);
  doc.text(`Phone: ${company.phone} | Email: ${company.email || "akesevaipalani@gmail.com"}`, headerLeft, 25.5);
  if (company.gstin) {
    doc.text(`GSTIN: ${company.gstin} | PAN: ${company.pan || "-"}`, headerLeft, 30);
  }

  // Header Divider
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(margin, 34, pageWidth - margin, 34);

  // Document Title Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, 38, pageWidth - margin * 2, 8, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("LOAN SANCTION & REPAYMENT SCHEDULE", pageWidth / 2, 43.5, { align: "center" });

  // Two-column Box: Customer Particulars & Loan Details
  const boxTop = 50;
  const boxHeight = 48;
  const colWidth = (pageWidth - margin * 2 - 4) / 2;

  // Box 1: Customer Details
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, boxTop, colWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("BORROWER INFORMATION", margin + 4, boxTop + 6);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin + 4, boxTop + 8, margin + colWidth - 4, boxTop + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const custY = boxTop + 14;
  doc.text("Customer Name:", margin + 4, custY);
  doc.text("Mobile Number:", margin + 4, custY + 6);
  doc.text("Customer ID:", margin + 4, custY + 12);
  doc.text("Address:", margin + 4, custY + 18);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.customer.name || "—", margin + 32, custY);
  doc.text(data.customer.mobile || "—", margin + 32, custY + 6);
  doc.text(data.customer.customerId || "—", margin + 32, custY + 12);
  const addr = data.customer.address?.trim() || "—";
  const splitAddr = doc.splitTextToSize(addr, colWidth - 36);
  doc.text(splitAddr, margin + 32, custY + 18);

  // Box 2: Loan Summary
  const isAdvance = data.loanCalculationType === "ADVANCE_INTEREST";
  const isInterestPrincipal = data.loanCalculationType === "INTEREST_PRINCIPAL";
  const custReceives = data.customerReceives !== undefined && data.customerReceives > 0
    ? data.customerReceives
    : Math.max(0, data.principalAmount - (data.advanceInterest || 0) - (data.processingFee || 0));

  const col2X = margin + colWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, boxTop, colWidth, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("LOAN SANCTION DETAILS", col2X + 4, boxTop + 6);
  doc.line(col2X + 4, boxTop + 8, col2X + colWidth - 4, boxTop + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const loanY = boxTop + 13;

  if (isAdvance) {
    doc.text("Loan Number:", col2X + 4, loanY);
    doc.text("Sanction Date:", col2X + 4, loanY + 5.5);
    doc.text("Calculation Type:", col2X + 4, loanY + 11);
    doc.text("Face Loan Amount:", col2X + 4, loanY + 16.5);
    doc.text("Advance Interest:", col2X + 4, loanY + 22);
    doc.text("Customer Receives:", col2X + 4, loanY + 27.5);
    doc.text("Tenure / Terms:", col2X + 4, loanY + 33);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(data.loanNo, col2X + 34, loanY);
    doc.text(formatDDMMYYYY(data.date), col2X + 34, loanY + 5.5);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text("Advance Interest (முன் வட்டி)", col2X + 34, loanY + 11);
    doc.setTextColor(15, 23, 42);
    doc.text(formatIndianCurrency(data.principalAmount), col2X + 34, loanY + 16.5);
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text(formatIndianCurrency(data.advanceInterest || data.totalInterest), col2X + 34, loanY + 22);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(formatIndianCurrency(custReceives), col2X + 34, loanY + 27.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${data.totalInstallments} ${data.paymentFrequency} Installments`, col2X + 34, loanY + 33);
  } else if (isInterestPrincipal) {
    doc.text("Loan Number:", col2X + 4, loanY);
    doc.text("Sanction Date:", col2X + 4, loanY + 5.5);
    doc.text("Calculation Type:", col2X + 4, loanY + 11);
    doc.text("Principal Amount:", col2X + 4, loanY + 16.5);
    doc.text("Total Interest:", col2X + 4, loanY + 22);
    doc.text("Customer Receives:", col2X + 4, loanY + 27.5);
    doc.text("Tenure / Terms:", col2X + 4, loanY + 33);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(data.loanNo, col2X + 34, loanY);
    doc.text(formatDDMMYYYY(data.date), col2X + 34, loanY + 5.5);
    doc.setTextColor(79, 70, 229); // indigo-600
    doc.text("Interest + Principal (அசல்+வட்டி)", col2X + 34, loanY + 11);
    doc.setTextColor(15, 23, 42);
    doc.text(formatIndianCurrency(data.principalAmount), col2X + 34, loanY + 16.5);
    doc.setTextColor(217, 119, 6); // amber-600
    doc.text(formatIndianCurrency(data.totalInterest), col2X + 34, loanY + 22);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text(formatIndianCurrency(custReceives), col2X + 34, loanY + 27.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${data.totalInstallments} ${data.paymentFrequency} Installments`, col2X + 34, loanY + 33);
  } else {
    doc.text("Loan Number:", col2X + 4, loanY);
    doc.text("Sanction Date:", col2X + 4, loanY + 5.5);
    doc.text("Calculation Type:", col2X + 4, loanY + 11);
    doc.text("Principal Amount:", col2X + 4, loanY + 16.5);
    doc.text("Interest Rate:", col2X + 4, loanY + 22);
    doc.text("Customer Receives:", col2X + 4, loanY + 27.5);
    doc.text("Tenure / Terms:", col2X + 4, loanY + 33);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(data.loanNo, col2X + 34, loanY);
    doc.text(formatDDMMYYYY(data.date), col2X + 34, loanY + 5.5);
    doc.setTextColor(79, 70, 229);
    doc.text(`Standard (${data.interestType || "Flat"})`, col2X + 34, loanY + 11);
    doc.setTextColor(15, 23, 42);
    doc.text(formatIndianCurrency(data.principalAmount), col2X + 34, loanY + 16.5);
    doc.text(`${data.interestRate}% (${data.interestFrequency || "Monthly"})`, col2X + 34, loanY + 22);
    doc.setTextColor(5, 150, 105);
    doc.text(formatIndianCurrency(custReceives), col2X + 34, loanY + 27.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${data.totalInstallments} ${data.paymentFrequency} Installments`, col2X + 34, loanY + 33);
  }

  // Summary Metrics Badges
  const metricY = boxTop + boxHeight + 4;
  const metricW = (pageWidth - margin * 2 - 6) / 3;

  if (isAdvance) {
    // Metric 1: Advance Interest
    doc.setFillColor(240, 253, 250); // teal-50
    doc.roundedRect(margin, metricY, metricW, 14, 1.5, 1.5, "F");
    doc.setFontSize(7);
    doc.setTextColor(13, 148, 136); // teal-600
    doc.text("ADVANCE INTEREST (UPFRONT)", margin + 4, metricY + 4.5);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(formatIndianCurrency(data.advanceInterest || data.totalInterest), margin + 4, metricY + 10.5);

    // Metric 2: Customer Receives
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(167, 243, 208); // emerald-200
    doc.roundedRect(margin + metricW + 3, metricY, metricW, 14, 1.5, 1.5, "FD");
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text("CUSTOMER RECEIVES", margin + metricW + 7, metricY + 4.5);
    doc.setFontSize(10.5);
    doc.setTextColor(6, 95, 70); // emerald-800
    doc.setFont("helvetica", "bold");
    doc.text(formatIndianCurrency(custReceives), margin + metricW + 7, metricY + 10.5);

    // Metric 3: Total Collection
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + (metricW + 3) * 2, metricY, metricW, 14, 1.5, 1.5, "F");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL COLLECTION", margin + (metricW + 3) * 2 + 4, metricY + 4.5);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(formatIndianCurrency(data.totalPayable), margin + (metricW + 3) * 2 + 4, metricY + 10.5);
  } else {
    // Metric 1: Total Interest
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, metricY, metricW, 14, 1.5, 1.5, "F");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("TOTAL INTEREST", margin + 4, metricY + 4.5);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(formatIndianCurrency(data.totalInterest), margin + 4, metricY + 10.5);

    // Metric 2: Installment Amount
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + metricW + 3, metricY, metricW, 14, 1.5, 1.5, "F");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`INSTALLMENT (${data.paymentFrequency})`, margin + metricW + 7, metricY + 4.5);
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text(formatIndianCurrency(data.installmentAmount), margin + metricW + 7, metricY + 10.5);

    // Metric 3: Total Payable
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(167, 243, 208); // emerald-200
    doc.roundedRect(margin + (metricW + 3) * 2, metricY, metricW, 14, 1.5, 1.5, "FD");
    doc.setFontSize(7);
    doc.setTextColor(4, 120, 87); // emerald-700
    doc.text("TOTAL PAYABLE", margin + (metricW + 3) * 2 + 4, metricY + 4.5);
    doc.setFontSize(10.5);
    doc.setTextColor(6, 95, 70); // emerald-800
    doc.setFont("helvetica", "bold");
    doc.text(formatIndianCurrency(data.totalPayable), margin + (metricW + 3) * 2 + 4, metricY + 10.5);
  }

  // Section Header: Installment Schedule
  const scheduleHeaderY = metricY + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("COMPLETE REPAYMENT SCHEDULE", margin, scheduleHeaderY);

  // Build Schedule Table Data (Strictly matching Installment No, Due Date, Expected Amount, Principal, Interest, Paid Amount, Balance, Status)
  const tableRows = data.schedule.map((item) => {
    const loanOut = (item as any).projectedBalance !== undefined
      ? (item as any).projectedBalance
      : (item as any).remainingPrincipal !== undefined
      ? (item as any).remainingPrincipal
      : (item as any).loanOutstandingAfterInstallment !== undefined
      ? (item as any).loanOutstandingAfterInstallment
      : (item as any).cumulativePrincipalOutstanding !== undefined
      ? (item as any).cumulativePrincipalOutstanding
      : item.balanceAmount !== undefined
      ? item.balanceAmount
      : item.loanOutstanding;
    return [
      String(item.installmentNumber),
      formatDDMMYYYY(item.dueDate),
      formatIndianCurrency(item.installmentAmount, false),
      formatIndianCurrency(item.principalAmount, false),
      formatIndianCurrency(item.interestAmount, false),
      formatIndianCurrency(item.paidAmount, false),
      formatIndianCurrency(loanOut, false),
      item.status.replace("_", " "),
    ];
  });

  autoTable(doc, {
    startY: scheduleHeaderY + 2.5,
    margin: { left: margin, right: margin, bottom: 25 },
    head: [["Inst #", "Due Date", "Expected (Rs)", "Principal (Rs)", "Interest (Rs)", "Paid (Rs)", "Balance (Rs)", "Status"]],
    body: tableRows,
    theme: "striped",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: "helvetica",
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 14 },
      1: { halign: "center", cellWidth: 22 },
      2: { halign: "right", cellWidth: 25 },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "right", cellWidth: 22 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 26, fontStyle: "bold" },
      7: { halign: "center" },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 7) {
        const val = String(hookData.cell.raw);
        if (val === "COLLECTED") {
          hookData.cell.styles.textColor = [5, 150, 105]; // emerald-600
          hookData.cell.styles.fontStyle = "bold";
        } else if (val === "OVERDUE") {
          hookData.cell.styles.textColor = [225, 29, 72]; // rose-600
          hookData.cell.styles.fontStyle = "bold";
        } else if (val === "PARTIALLY PAID") {
          hookData.cell.styles.textColor = [217, 119, 6]; // amber-600
          hookData.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // Multi-page header/footer loop
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // If multi-page, add running header on pages > 1
    if (i > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${company.name} | Loan No: ${data.loanNo} | Customer: ${data.customer.name}`, margin, 10);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, 12, pageWidth - margin, 12);
    }

    // Professional Footer on all pages
    const footerY = 286;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Generated on ${formatDDMMYYYYTime(new Date())} | ${company.name} Computer Generated Document`, margin, footerY);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
  }

  // Add signatures on the final page
  doc.setPage(totalPages);
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 230;

  // Only draw if there is space, else new page
  if (finalY > 250) {
    doc.addPage();
  }
  const sigY = finalY > 250 ? 40 : finalY;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Terms & Conditions: Repayments must be remitted on or before the due date. Receipts are issued digitally upon collection.", margin, sigY);

  const sigLineY = sigY + 18;
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, sigLineY, margin + 50, sigLineY);
  doc.line(pageWidth - margin - 50, sigLineY, pageWidth - margin, sigLineY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Borrower's Signature", margin, sigLineY + 4);
  doc.text(`For ${company.name}`, pageWidth - margin - 50, sigLineY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Authorized Signatory", pageWidth - margin - 50, sigLineY + 8);

  return doc;
}

/**
 * 2. PROFESSIONAL COLLECTION PAYMENT RECEIPT PDF
 */
export function generateCollectionReceiptPdf(data: CollectionReceiptData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const company = data.company || DEFAULT_COMPANY_PROFILE;
  const logo = getLogoBase64();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 16;

  // Add Logo
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 12, 22, 22);
    } catch {}
  }

  // Header Details
  const headerLeft = logo ? margin + 26 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name.toUpperCase(), headerLeft, 19);

  // System Branding Badge (Top Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text("VATTI BUSINESS", pageWidth - margin, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("Private Business Management System", pageWidth - margin, 22.5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const addressLine = [company.address, company.city, company.state, company.pincode].filter(Boolean).join(", ");
  doc.text(addressLine, headerLeft, 24);
  doc.text(`Phone: ${company.phone} | Email: ${company.email || "akesevaipalani@gmail.com"}`, headerLeft, 29);
  if (company.gstin || company.pan) {
    const taxLine = [company.gstin ? `GSTIN: ${company.gstin}` : "", company.pan ? `PAN: ${company.pan}` : ""].filter(Boolean).join(" | ");
    doc.text(taxLine, headerLeft, 33.5);
  }

  // Header Line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.6);
  doc.line(margin, 38, pageWidth - margin, 38);

  // Title Banner
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, 42, pageWidth - margin * 2, 9, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text("OFFICIAL COLLECTION RECEIPT", pageWidth / 2, 48, { align: "center" });

  // Receipt Number & Date Ribbon
  const ribbonY = 56;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, ribbonY, pageWidth - margin * 2, 10, 1.5, 1.5, "F");

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Receipt No:", margin + 4, ribbonY + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.receiptNo, margin + 24, ribbonY + 6.5);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Collection Date:", pageWidth / 2 + 10, ribbonY + 6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(formatDDMMYYYY(data.collectionDate), pageWidth / 2 + 36, ribbonY + 6.5);

  // Customer & Loan Details Grid
  const gridTop = 70;
  const colW = (pageWidth - margin * 2 - 4) / 2;

  // Box 1: Borrower Details
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, gridTop, colW, 36, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("CUSTOMER DETAILS", margin + 4, gridTop + 5.5);
  doc.line(margin + 4, gridTop + 7.5, margin + colW - 4, gridTop + 7.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Name:", margin + 4, gridTop + 13);
  doc.text("Mobile:", margin + 4, gridTop + 19);
  doc.text("Address:", margin + 4, gridTop + 25);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.customer.name || "—", margin + 22, gridTop + 13);
  doc.text(data.customer.mobile || "—", margin + 22, gridTop + 19);
  doc.setFont("helvetica", "normal");
  const custAddr = doc.splitTextToSize(data.customer.address?.trim() || "—", colW - 26);
  doc.text(custAddr, margin + 22, gridTop + 25);

  // Box 2: Loan Particulars
  const col2X = margin + colW + 4;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, gridTop, colW, 36, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("LOAN / INSTALLMENT REFERENCE", col2X + 4, gridTop + 5.5);
  doc.line(col2X + 4, gridTop + 7.5, col2X + colW - 4, gridTop + 7.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("Loan No:", col2X + 4, gridTop + 13);
  doc.text("Installment No:", col2X + 4, gridTop + 19);
  doc.text("Scheduled Due:", col2X + 4, gridTop + 25);
  doc.text("Payment Mode:", col2X + 4, gridTop + 31);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(data.loanNo, col2X + 28, gridTop + 13);
  doc.text(data.installmentNumber ? `#${data.installmentNumber}` : "Regular Collection", col2X + 28, gridTop + 19);
  doc.text(formatDDMMYYYY(data.scheduledDueDate || data.collectionDate), col2X + 28, gridTop + 25);

  // Payment Mode Badge
  const modeColor: [number, number, number] = data.paymentMethod === "CASH" ? [5, 150, 105] : [2, 132, 199];
  doc.setTextColor(...modeColor);
  doc.text(data.paymentMethod + (data.referenceNo ? ` (${data.referenceNo})` : ""), col2X + 28, gridTop + 31);

  // Payment Breakdown Table
  const tableY = gridTop + 42;
  const breakdownRows = [
    ["1", "Previous Outstanding Balance", formatIndianCurrency(data.previousOutstanding)],
    ["2", "Principal Component Credited", formatIndianCurrency(data.principalPaid)],
    ["3", "Interest Component Credited", formatIndianCurrency(data.interestPaid)],
    ...(data.otherCharges ? [["4", "Other Fees / Penal Charges", formatIndianCurrency(data.otherCharges)]] : []),
  ];

  autoTable(doc, {
    startY: tableY,
    margin: { left: margin, right: margin },
    head: [["S.No", "Description / Particulars", "Amount (Rs)"]],
    body: breakdownRows,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      font: "helvetica",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 16 },
      1: { halign: "left" },
      2: { halign: "right", cellWidth: 38, fontStyle: "bold" },
    },
  });

  const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 4 : tableY + 36;

  // Highlight Box: Total Amount Received
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129); // emerald-500
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, lastY, pageWidth - margin * 2, 16, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text("TOTAL AMOUNT RECEIVED", margin + 6, lastY + 7);

  doc.setFontSize(13);
  doc.text(formatIndianCurrency(data.totalAmountPaid), margin + 6, lastY + 12.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(4, 120, 87);
  doc.text("REMAINING OUTSTANDING BALANCE", pageWidth - margin - 6, lastY + 7, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(formatIndianCurrency(data.currentOutstanding), pageWidth - margin - 6, lastY + 12.5, { align: "right" });

  // Verification & Signatures
  const authY = lastY + 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Received By: ${data.collectedBy || "Authorized Representative"}`, margin, authY);
  doc.text(`Payment Recorded: ${formatDDMMYYYYTime(data.actualPaymentDate || new Date())}`, margin, authY + 5);

  doc.setDrawColor(148, 163, 184);
  doc.line(pageWidth - margin - 50, authY + 14, pageWidth - margin, authY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`For ${company.name}`, pageWidth - margin - 50, authY + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Authorized Signature & Seal", pageWidth - margin - 50, authY + 22);

  // Thank you message
  const thankY = authY + 34;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, thankY, pageWidth - margin * 2, 10, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Thank you for your payment! Please preserve this receipt for your financial records.", pageWidth / 2, thankY + 6, { align: "center" });

  // Footer
  const footerY = 286;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Receipt generated on ${formatDDMMYYYYTime(new Date())} | ${company.name} Digital Receipt System`, margin, footerY);
  doc.text("Page 1 of 1", pageWidth - margin, footerY, { align: "right" });

  return doc;
}

/**
 * 3. WHATSAPP MESSAGE FORMATTERS (PROFESSIONAL & BILINGUAL-FRIENDLY)
 */

export function generateWhatsAppReceiptMessage(data: CollectionReceiptData): string {
  const company = data.company || DEFAULT_COMPANY_PROFILE;
  const paymentDate = formatDDMMYYYY(data.collectionDate);
  const companyHeader = company.name ? `${company.name.toUpperCase()} – Collection Receipt` : "VATTI BUSINESS – Collection Receipt";
  const instText = data.installmentNumber ? `\n• *Installment:* #${data.installmentNumber}` : "";
  const chargesText = data.otherCharges && data.otherCharges > 0 ? `\n• *Other Charges:* ₹${Math.round(data.otherCharges).toLocaleString("en-IN")}` : "";

  return `*${companyHeader}*
_VATTI BUSINESS – Private Business Management System_

Dear *${data.customer.name}*,

Your payment has been successfully received.

*Receipt Details:*
• *Receipt No:* ${data.receiptNo}
• *Loan No:* ${data.loanNo}
• *Collection Date:* ${paymentDate}${instText}
• *Previous Outstanding Balance:* ₹${Math.round(data.previousOutstanding).toLocaleString("en-IN")}
• *Principal Component Credited:* ₹${Math.round(data.principalPaid).toLocaleString("en-IN")}
• *Interest Component Credited:* ₹${Math.round(data.interestPaid).toLocaleString("en-IN")}${chargesText}
• *Total Amount Received:* ₹${Math.round(data.totalAmountPaid).toLocaleString("en-IN")}
• *Remaining Outstanding Balance:* ₹${Math.round(data.currentOutstanding).toLocaleString("en-IN")}
• *Payment Mode:* ${data.paymentMethod}

Thank you.

*${company.name || "VATTI BUSINESS"}*
${company.phone ? `📞 ${company.phone}\n` : ""}${company.address || company.city ? `📍 ${[company.address, company.city].filter(Boolean).join(", ")}` : ""}`.trim();
}

export function generateWhatsAppLoanMessage(data: LoanDocumentData): string {
  const company = data.company || DEFAULT_COMPANY_PROFILE;
  const loanDate = formatDDMMYYYY(data.date);
  const firstDue = data.schedule[0] ? formatDDMMYYYY(data.schedule[0].dueDate) : "-";
  const advIntText = data.advanceInterest && data.advanceInterest > 0
    ? `\n• *Advance Interest:* ₹${Math.round(data.advanceInterest).toLocaleString("en-IN")}`
    : "";
  const chargesText = data.processingFee && data.processingFee > 0
    ? `\n• *Charges / Fees:* ₹${Math.round(data.processingFee).toLocaleString("en-IN")}`
    : "";
  const netReceives = data.customerReceives !== undefined && data.customerReceives > 0
    ? data.customerReceives
    : Math.max(0, data.principalAmount - (data.advanceInterest || 0) - (data.processingFee || 0));

  return `*${company.name.toUpperCase()} – Loan Sanction*
_VATTI BUSINESS – Private Business Management System_

Dear *${data.customer.name}*,

Your loan has been sanctioned and disbursed successfully.

*Loan Sanction Details:*
• *Loan No:* ${data.loanNo}
• *Sanction Date:* ${loanDate}
• *Face / Loan Amount:* ₹${Math.round(data.principalAmount).toLocaleString("en-IN")}${advIntText}${chargesText}
• *Customer Receives:* ₹${Math.round(netReceives).toLocaleString("en-IN")}
• *Total Payable:* ₹${Math.round(data.totalPayable).toLocaleString("en-IN")}
• *Tenure:* ${data.totalInstallments} ${data.paymentFrequency} collections
• *Collection Amount:* ₹${Math.round(data.installmentAmount).toLocaleString("en-IN")}
• *First Due Date:* ${firstDue}

Your complete repayment schedule document is attached.

Thank you.

*${company.name}*
📞 ${company.phone}
📍 ${company.address || company.city || "Tamil Nadu, India"}`.trim();
}
