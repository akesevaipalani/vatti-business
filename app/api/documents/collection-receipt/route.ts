import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateCollectionReceiptPdf,
  generateWhatsAppReceiptMessage,
  CollectionReceiptData,
  DEFAULT_COMPANY_PROFILE,
  CompanyProfile,
} from "@/lib/documents/pdf-engine";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId") || searchParams.get("id");
    const receiptNo = searchParams.get("receiptNo");
    const format = searchParams.get("format") || "pdf";
    const download = searchParams.get("download") === "1" || searchParams.get("download") === "true";

    if (!paymentId && !receiptNo) {
      return NextResponse.json({ error: "Payment ID or Receipt Number is required" }, { status: 400 });
    }

    const payment = await prisma.loanPayment.findFirst({
      where: paymentId ? { id: paymentId } : { paymentNo: receiptNo! },
      include: {
        loan: true,
        customer: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
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
      state: biz?.state || undefined,
      pincode: biz?.pincode || undefined,
      gstin: biz?.gstin || undefined,
      pan: biz?.pan || undefined,
      logoUrl: biz?.logoUrl || undefined,
    };

    // Determine cumulative payments prior to this payment for accurate historical progression
    const allPayments = await prisma.loanPayment.findMany({
      where: { loanId: payment.loanId },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });

    let paidBefore = 0;
    for (const p of allPayments) {
      if (p.id === payment.id) break;
      paidBefore += p.amount;
    }

    const isAdvanceInterest = payment.loan.loanCalculationType === "ADVANCE_INTEREST" || Boolean((payment.loan as any).advanceInterest && (payment.loan as any).advanceInterest > 0);

    const totalPayable = payment.loan.totalPayable && payment.loan.totalPayable > 0
      ? payment.loan.totalPayable
      : (payment.loan.principalAmount + (isAdvanceInterest ? 0 : ((payment.loan.interestOutstanding || 0) + (payment.loan.interestPaid || 0))));

    const previousOutstanding = Math.max(0, Math.round((totalPayable - paidBefore) * 100) / 100);
    const currentOutstanding = Math.max(0, Math.round((previousOutstanding - payment.amount) * 100) / 100);

    // Find installment number if applied
    let appliedInstallment = await prisma.loanInstallment.findFirst({
      where: {
        loanId: payment.loanId,
        actualPaymentDate: payment.date,
      },
      orderBy: { installmentNumber: "asc" },
    });

    if (!appliedInstallment && payment.notes) {
      const match = payment.notes.match(/Installment #(\d+)/i);
      if (match) {
        appliedInstallment = await prisma.loanInstallment.findFirst({
          where: {
            loanId: payment.loanId,
            installmentNumber: parseInt(match[1], 10),
          },
        });
      }
    }

    const receiptData: CollectionReceiptData = {
      receiptNo: payment.paymentNo,
      loanNo: payment.loan.loanNo,
      collectionDate: payment.date,
      actualPaymentDate: payment.date,
      scheduledDueDate: appliedInstallment?.dueDate,
      installmentNumber: appliedInstallment?.installmentNumber,
      customer: {
        name: payment.customer.name,
        mobile: payment.customer.mobile,
        address: (() => {
          const a = (payment.customer.address || "").trim();
          const c = (payment.customer.city || "").trim();
          if (!a) return c || "—";
          if (!c || a.toLowerCase().includes(c.toLowerCase())) return a;
          return `${a}, ${c}`;
        })(),
      },
      previousOutstanding,
      principalPaid: payment.principalPortion,
      interestPaid: payment.interestPortion,
      otherCharges: payment.lateFeePortion || 0,
      totalAmountPaid: payment.amount,
      currentOutstanding,
      paymentMethod: (payment.paymentMethod as "CASH" | "UPI" | "BANK") || "CASH",
      referenceNo: payment.referenceNo || undefined,
      collectedBy: biz?.ownerName ? `${biz.ownerName} (Admin)` : "Admin",
      company,
    };

    const whatsappMessage = generateWhatsAppReceiptMessage(receiptData);

    if (format === "json") {
      return NextResponse.json({
        success: true,
        receipt: receiptData,
        whatsappMessage,
      });
    }

    // Generate PDF
    const pdfDoc = generateCollectionReceiptPdf(receiptData);
    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));
    const safeReceiptNo = payment.paymentNo.replace(/[^a-zA-Z0-9_-]/g, "_");
    const dispositionType = download ? "attachment" : "inline";

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${dispositionType}; filename="${safeReceiptNo}_Receipt.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, max-age=3600",
        "X-Receipt-Number": payment.paymentNo,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate collection receipt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
