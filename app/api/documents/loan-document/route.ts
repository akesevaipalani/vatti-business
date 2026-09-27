import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateLoanDocumentPdf,
  generateWhatsAppLoanMessage,
  LoanDocumentData,
  DEFAULT_COMPANY_PROFILE,
  CompanyProfile,
} from "@/lib/documents/pdf-engine";
import { generateInstallmentsForLoan } from "@/lib/loans/installments";
import { calculateLoan } from "@/lib/loans/calculator";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const loanNo = searchParams.get("loanNo");
    const format = searchParams.get("format") || "pdf";
    const download = searchParams.get("download") === "1" || searchParams.get("download") === "true";

    if (!id && !loanNo) {
      return NextResponse.json({ error: "Loan ID or Loan Number is required" }, { status: 400 });
    }

    let loan = await prisma.loan.findFirst({
      where: id ? { id } : { loanNo: loanNo! },
      include: {
        customer: true,
        installments: {
          orderBy: { installmentNumber: "asc" },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan record not found" }, { status: 404 });
    }

    // Auto-bootstrap installments in DB if empty
    if (!loan.installments || loan.installments.length === 0) {
      try {
        await generateInstallmentsForLoan(loan.id);
        const reloaded = await prisma.loanInstallment.findMany({
          where: { loanId: loan.id },
          orderBy: { installmentNumber: "asc" },
        });
        if (reloaded.length > 0) {
          loan = { ...loan, installments: reloaded };
        }
      } catch (genErr) {
        console.warn("Failed to auto-generate installments for document:", genErr);
      }
    }

    // Fetch business profile or fallback
    const biz = await prisma.businessProfile.findUnique({
      where: { id: "default-biz" },
    });

    const company: CompanyProfile = {
      name: biz?.name || DEFAULT_COMPANY_PROFILE.name,
      phone: biz?.phone || DEFAULT_COMPANY_PROFILE.phone,
      email: biz?.email || DEFAULT_COMPANY_PROFILE.email,
      address: biz?.address || DEFAULT_COMPANY_PROFILE.address,
      city: biz?.city || DEFAULT_COMPANY_PROFILE.city,
      state: DEFAULT_COMPANY_PROFILE.state,
      pincode: DEFAULT_COMPANY_PROFILE.pincode,
      gstin: biz?.gstin || DEFAULT_COMPANY_PROFILE.gstin,
      pan: biz?.pan || DEFAULT_COMPANY_PROFILE.pan,
    };

    const l = loan as any;
    const customerReceives = l.disbursedAmount && l.disbursedAmount > 0
      ? l.disbursedAmount
      : Math.max(0, loan.principalAmount - (l.advanceInterest || 0) - (loan.processingFee || 0));

    const docData: LoanDocumentData = {
      loanNo: loan.loanNo,
      date: loan.date,
      customer: {
        name: loan.customer.name,
        mobile: loan.customer.mobile,
        address: (() => {
          const a = (loan.customer.address || "").trim();
          const c = (loan.customer.city || "").trim();
          if (!a) return c || "—";
          if (!c || a.toLowerCase().includes(c.toLowerCase())) return a;
          return `${a}, ${c}`;
        })(),
        customerId: loan.customer.customerCode,
      },
      principalAmount: loan.principalAmount,
      customerReceives,
      advanceInterest: l.advanceInterest || 0,
      processingFee: loan.processingFee || 0,
      loanCalculationType: l.loanCalculationType || "STANDARD",
      interestType: loan.interestType,
      interestRate: loan.interestRate,
      interestFrequency: loan.interestFrequency,
      paymentFrequency: loan.paymentFrequency,
      totalInstallments: loan.totalInstallments,
      installmentAmount: loan.installmentAmount,
      totalInterest: Math.max(0, loan.totalPayable - loan.principalAmount) || (l.advanceInterest || 0),
      totalPayable: loan.totalPayable,
      schedule: loan.installments && loan.installments.length > 0
        ? loan.installments.map((inst) => ({
            installmentNumber: inst.installmentNumber,
            dueDate: inst.dueDate,
            principalAmount: inst.principalPortion,
            interestAmount: inst.interestPortion,
            installmentAmount: inst.installmentAmount,
            paidAmount: inst.paidAmount,
            balanceAmount: Math.max(0, inst.installmentAmount - inst.paidAmount),
            status: inst.status,
          }))
        : calculateLoan({
            principal: loan.principalAmount,
            loanCalculationType: (l.loanCalculationType as any) || "STANDARD",
            interestRate: loan.interestRate,
            interestType: loan.interestType as any,
            advanceInterestAmount: l.advanceInterest,
            processingFee: loan.processingFee,
            interestFrequency: loan.interestFrequency as any,
            paymentFrequency: loan.paymentFrequency as any,
            totalInstallments: loan.totalInstallments,
            startDate: loan.date,
          }).schedule.map((item) => ({
            installmentNumber: item.installmentNumber,
            dueDate: new Date(item.dueDate),
            principalAmount: item.principalPortion,
            interestAmount: item.interestPortion,
            installmentAmount: item.installmentAmount,
            paidAmount: 0,
            balanceAmount: item.installmentAmount,
            status: "PENDING",
          })),
      company,
    };

    const whatsappMessage = generateWhatsAppLoanMessage(docData);

    if (format === "json") {
      return NextResponse.json({
        success: true,
        document: docData,
        whatsappMessage,
      });
    }

    // Generate PDF
    const pdfDoc = generateLoanDocumentPdf(docData);
    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const safeLoanNo = loan.loanNo.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dispositionType = download ? "attachment" : "inline";

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionType}; filename="${safeLoanNo}_Sanction.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, max-age=3600",
        "X-Document-Number": loan.loanNo,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate loan document";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
