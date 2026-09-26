import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

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
}

export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  name: "ABC FINANCE",
  phone: "+91 96008 71898",
  email: "contact@vattibusiness.com",
  address: "123, Gandhi Road, Main Bazaar",
  city: "Chennai",
  state: "Tamil Nadu",
  pincode: "600001",
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
  status: string;
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
  principalAmount: number;
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

export function formatIndianCurrency(amount: number, includeSymbol: boolean = true): string {
  const formatted = Math.round(amount || 0).toLocaleString("en-IN");
  return includeSymbol ? `Rs. ${formatted}` : formatted;
}

export function formatDDMMYYYY(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDDMMYYYYTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${day}/${month}/${year} ${hours}:${minutes} ${ampm}`;
}

let cachedLogoBase64: string | null = null;

export async function loadClientLogo(): Promise<string> {
  if (cachedLogoBase64) return cachedLogoBase64;
  try {
    const res = await fetch("/logo.png");
    if (res.ok) {
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          cachedLogoBase64 = reader.result as string;
          resolve(cachedLogoBase64);
        };
        reader.onerror = () => resolve("");
        reader.readAsDataURL(blob);
      });
    }
  } catch {
    // ignore
  }
  return "";
}

/**
 * Generate Loan Document PDF
 */
export async function generateLoanDocumentPdf(data: LoanDocumentData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const company = data.company || DEFAULT_COMPANY_PROFILE;
  const logoBase64 = await loadClientLogo();

  // Top decorative border bar
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, pageWidth, 5, "F");
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 5, pageWidth, 1.5, "F");

  let currentY = 14;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, currentY - 2, 24, 24);
    } catch {
      // ignore
    }
  }

  const headerLeft = logoBase64 ? margin + 28 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, headerLeft, currentY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const companyDetails = [
    company.address,
    [company.city, company.state, company.pincode].filter(Boolean).join(", "),
    `Phone: ${company.phone} | Email: ${company.email || "support@abcfinance.in"}`,
    company.gstin ? `GSTIN: ${company.gstin} | PAN: ${company.pan || ""}` : "",
  ].filter(Boolean);

  let compY = currentY + 9;
  companyDetails.forEach((line) => {
    if (line) {
      doc.text(line, headerLeft, compY);
      compY += 4;
    }
  });

  // Right Title Box
  const badgeWidth = 62;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(badgeX, currentY - 1, badgeWidth, 22, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.roundedRect(badgeX, currentY - 1, badgeWidth, 22, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("LOAN SANCTION ORDER", badgeX + badgeWidth / 2, currentY + 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("DOCUMENT / LOAN NO.", badgeX + badgeWidth / 2, currentY + 10, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(79, 70, 229);
  doc.text(data.loanNo, badgeX + badgeWidth / 2, currentY + 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${formatDDMMYYYY(data.date)}`, badgeX + badgeWidth / 2, currentY + 19.5, { align: "center" });

  currentY = Math.max(compY + 3, currentY + 25);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 4;

  // Borrower & Loan Particulars Cards
  const colWidth = (pageWidth - margin * 2 - 5) / 2;
  const cardHeight = 36;

  // Borrower
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, colWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, colWidth, cardHeight, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("BORROWER PARTICULARS", margin + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Name: ${data.customer.name}`, margin + 4, currentY + 12);
  doc.text(`Contact: ${data.customer.mobile}`, margin + 4, currentY + 17);
  doc.text(`Address: ${data.customer.address || "Local"}`, margin + 4, currentY + 22);
  if (data.customer.customerId) {
    doc.text(`Customer ID: ${data.customer.customerId}`, margin + 4, currentY + 27);
  }

  // Loan Summary
  const col2X = margin + colWidth + 5;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, currentY, colWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(col2X, currentY, colWidth, cardHeight, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("FINANCIAL TERMS & SUMMARY", col2X + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`Sanctioned Principal: ${formatIndianCurrency(data.principalAmount)}`, col2X + 4, currentY + 12);
  doc.text(`Interest: ${data.interestRate}% (${data.interestFrequency || "Monthly"})`, col2X + 4, currentY + 17);
  doc.text(`Tenure: ${data.totalInstallments} ${data.paymentFrequency} installments`, col2X + 4, currentY + 22);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text(`Installment Amount: ${formatIndianCurrency(data.installmentAmount)}`, col2X + 4, currentY + 27);
  doc.text(`Total Repayable: ${formatIndianCurrency(data.totalPayable)}`, col2X + 4, currentY + 32);

  currentY += cardHeight + 6;

  // Installment Table Section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text("DETAILED REPAYMENT & DUE SCHEDULE", margin, currentY);
  currentY += 2;

  const tableHeaders = [
    ["#", "Due Date", "Principal (Rs.)", "Interest (Rs.)", "Due (Rs.)", "Paid (Rs.)", "Balance (Rs.)", "Status"],
  ];

  const tableRows = data.schedule.map((item) => [
    String(item.installmentNumber),
    formatDDMMYYYY(item.dueDate),
    formatIndianCurrency(item.principalAmount, false),
    formatIndianCurrency(item.interestAmount, false),
    formatIndianCurrency(item.installmentAmount, false),
    formatIndianCurrency(item.paidAmount, false),
    formatIndianCurrency(item.balanceAmount, false),
    item.status,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: tableHeaders,
    body: tableRows,
    margin: { left: margin, right: margin, bottom: 22 },
    theme: "striped",
    styles: { overflow: "linebreak" },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [51, 65, 85],
      cellPadding: 2,
      valign: "middle",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 23 },
      2: { halign: "right", cellWidth: 25 },
      3: { halign: "right", cellWidth: 25 },
      4: { halign: "right", cellWidth: 25, fontStyle: "bold" },
      5: { halign: "right", cellWidth: 24 },
      6: { halign: "right", cellWidth: 25 },
      7: { halign: "center", cellWidth: 25 },
    },
    didDrawPage: (hookData) => {
      const pageNumber = (doc.internal as any).getCurrentPageInfo().pageNumber;
      const totalPages = (doc.internal as any).getNumberOfPages();

      // Top bar for continuation pages
      if (pageNumber > 1) {
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, pageWidth, 4, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(`${company.name} - Loan Sanction Order: ${data.loanNo}`, margin, 8);
      }

      // Footer
      const footerY = pageHeight - 8;
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Generated on ${formatDDMMYYYYTime(new Date())} | Confidential financial document issued by ${company.name}`,
        margin,
        footerY
      );
      doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, footerY, { align: "right" });
    },
  });

  // Check last page room for terms & signatures
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 40;
  if (finalY > pageHeight - 48) {
    doc.addPage();
  }

  const termsY = finalY > pageHeight - 48 ? 20 : finalY;

  // Terms and conditions
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("UNDERTAKING & SANCTION TERMS", margin, termsY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const termsText = [
    "1. The borrower agrees to repay the loan installments on or before the due dates indicated above.",
    "2. All payments must be made to authorized representatives of ABC FINANCE against valid official receipts.",
    "3. Any delay in installment payments may attract overdue charges as per company financing policy.",
  ];
  let ty = termsY + 4;
  termsText.forEach((t) => {
    doc.text(t, margin, ty);
    ty += 3.5;
  });

  // Signatures
  const sigY = ty + 12;
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.5);

  doc.line(margin, sigY, margin + 50, sigY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Borrower Signature", margin, sigY + 4);

  doc.line(pageWidth - margin - 50, sigY, pageWidth - margin, sigY);
  doc.text(`For ${company.name}`, pageWidth - margin - 50, sigY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Authorized Signatory & Seal", pageWidth - margin - 50, sigY + 8);

  return doc;
}

/**
 * Generate Collection Receipt PDF
 */
export async function generateCollectionReceiptPdf(data: CollectionReceiptData): Promise<jsPDF> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const company = data.company || DEFAULT_COMPANY_PROFILE;
  const logoBase64 = await loadClientLogo();

  // Top header bands
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 5, "F");
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 5, pageWidth, 1.5, "F");

  let currentY = 14;

  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, currentY - 2, 22, 22);
    } catch {
      // ignore
    }
  }

  const headerLeft = logoBase64 ? margin + 26 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(company.name, headerLeft, currentY + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const companyDetails = [
    company.address,
    [company.city, company.state, company.pincode].filter(Boolean).join(", "),
    `Phone: ${company.phone} | Email: ${company.email || "support@abcfinance.in"}`,
    company.gstin ? `GSTIN: ${company.gstin} | PAN: ${company.pan || ""}` : "",
  ].filter(Boolean);

  let compY = currentY + 9;
  companyDetails.forEach((line) => {
    if (line) {
      doc.text(line, headerLeft, compY);
      compY += 4;
    }
  });

  // Receipt Badge Box (Right side)
  const badgeWidth = 62;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.roundedRect(badgeX, currentY - 1, badgeWidth, 24, 2, 2, "F");
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.6);
  doc.roundedRect(badgeX, currentY - 1, badgeWidth, 24, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70); // emerald-800
  doc.text("PAYMENT RECEIPT", badgeX + badgeWidth / 2, currentY + 5.5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(4, 120, 87);
  doc.text("RECEIPT NUMBER", badgeX + badgeWidth / 2, currentY + 10.5, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(data.receiptNo, badgeX + badgeWidth / 2, currentY + 15, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(5, 150, 105);
  doc.text(`Date: ${formatDDMMYYYY(data.collectionDate)}`, badgeX + badgeWidth / 2, currentY + 20, { align: "center" });

  currentY = Math.max(compY + 4, currentY + 28);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 4;

  // Two columns: Customer particulars and Payment details
  const colWidth = (pageWidth - margin * 2 - 5) / 2;
  const cardHeight = 36;

  // Customer Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, currentY, colWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, colWidth, cardHeight, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("CUSTOMER DETAILS", margin + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Name: ${data.customer.name}`, margin + 4, currentY + 13);
  doc.text(`Phone: ${data.customer.mobile}`, margin + 4, currentY + 19);
  doc.text(`Address: ${data.customer.address || "Local"}`, margin + 4, currentY + 25);

  // Loan & Payment Ref Box
  const col2X = margin + colWidth + 5;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(col2X, currentY, colWidth, cardHeight, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(col2X, currentY, colWidth, cardHeight, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("COLLECTION INFORMATION", col2X + 4, currentY + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Loan Account No: ${data.loanNo}`, col2X + 4, currentY + 13);
  doc.text(`Payment Mode: ${data.paymentMethod}`, col2X + 4, currentY + 19);
  if (data.installmentNumber) {
    doc.text(`Installment Due: #${data.installmentNumber}`, col2X + 4, currentY + 25);
  }
  if (data.referenceNo) {
    doc.text(`Reference / UPI Ref: ${data.referenceNo}`, col2X + 4, currentY + 31);
  }

  currentY += cardHeight + 8;

  // Breakdown Table
  const tableHeaders = [["Sl", "Payment Breakdown Description", "Amount (Rs.)"]];
  const tableRows = [
    ["1", "Previous Outstanding Balance", formatIndianCurrency(data.previousOutstanding, false)],
    ["2", "Principal Component Credited", formatIndianCurrency(data.principalPaid, false)],
    ["3", "Interest Component Credited", formatIndianCurrency(data.interestPaid, false)],
    ["4", "Other Fees / Penal Charges", formatIndianCurrency(data.otherCharges || 0, false)],
  ];

  autoTable(doc, {
    startY: currentY,
    head: tableHeaders,
    body: tableRows,
    margin: { left: margin, right: margin },
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "left",
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 16 },
      1: { halign: "left" },
      2: { halign: "right", cellWidth: 38, fontStyle: "bold" },
    },
  });

  const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 4 : currentY + 36;

  // Highlight Box: Total Amount Received
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, lastY, pageWidth - margin * 2, 16, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(6, 95, 70);
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

  // Signatures
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
  doc.text(
    "Thank you for your payment! Please preserve this receipt for your financial records.",
    pageWidth / 2,
    thankY + 6,
    { align: "center" }
  );

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
 * Trigger client-side PDF download / save / open with Android Capacitor & WebView support
 */
export async function downloadPdf(
  doc: jsPDF,
  filename: string
): Promise<{ success: boolean; uri?: string }> {
  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Extract base64 data from jsPDF
      const dataUri = doc.output("datauristring");
      const base64Data = dataUri.split(",")[1];

      // 2. Save to Cache directory first for immediate FileProvider access
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      // Also attempt to save a copy to Documents directory
      try {
        await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (docErr) {
        console.warn("Could not write to Documents directory (handled):", docErr);
      }

      // 3. Launch Android system share sheet with PDF file attached
      // This allows the user on Android to Open With (Drive/Acrobat), Save to Files, Print, or Share!
      await Share.share({
        title: filename,
        text: `Vatti Business PDF: ${filename}`,
        url: saved.uri,
        dialogTitle: `Open or Save PDF: ${filename}`,
      });

      return { success: true, uri: saved.uri };
    } else {
      // Browser / Desktop Web environment
      doc.save(filename);

      // Secondary anchor fallback
      try {
        const blob = doc.output("blob");
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(blobUrl);
        }, 10000);
      } catch (anchorErr) {
        console.warn("Blob anchor trigger failed:", anchorErr);
      }

      return { success: true };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("downloadPdf error:", errorMsg);
    if (errorMsg.toLowerCase().includes("cancel") || errorMsg.toLowerCase().includes("dismiss")) {
      return { success: true };
    }
    throw new Error(errorMsg);
  }
}

/**
 * Trigger print using Android System Share / Print spooler or web print
 */
export async function printPdf(
  doc: jsPDF,
  filename: string = "document.pdf"
): Promise<{ success: boolean }> {
  try {
    if (Capacitor.isNativePlatform()) {
      // On Android native, write to cache and launch Share sheet with PDF
      // Android System provides the "Print" option right in the share sheet!
      const dataUri = doc.output("datauristring");
      const base64Data = dataUri.split(",")[1];

      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true,
      });

      await Share.share({
        title: `Print: ${filename}`,
        text: `Print document: ${filename}`,
        url: saved.uri,
        dialogTitle: "Print Document (Select Print or PDF Viewer)",
      });

      return { success: true };
    } else {
      // Browser / Desktop iframe print
      const blob = doc.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      const printWindow = window.open(blobUrl, "_blank");
      if (printWindow) {
        printWindow.focus();
        printWindow.onload = () => {
          printWindow.print();
        };
      } else {
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow?.print();
        };
      }
      return { success: true };
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("printPdf error:", errorMsg);
    if (errorMsg.toLowerCase().includes("cancel") || errorMsg.toLowerCase().includes("dismiss")) {
      return { success: true };
    }
    throw new Error(errorMsg);
  }
}
