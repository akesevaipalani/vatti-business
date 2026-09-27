import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateWhatsAppReceiptMessage,
  generateWhatsAppLoanMessage,
  DEFAULT_COMPANY_PROFILE,
  CompanyProfile,
  CollectionReceiptData,
  LoanDocumentData,
} from "@/lib/documents/pdf-engine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, id, recipientPhone } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: "Document type ('RECEIPT' or 'LOAN') and ID are required" },
        { status: 400 }
      );
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

    let messageText = "";
    let customerPhone = recipientPhone || "";
    let documentNumber = "";
    let documentUrl = "";

    if (type === "RECEIPT") {
      const payment = await prisma.loanPayment.findUnique({
        where: { id },
        include: { loan: true, customer: true },
      });

      if (!payment) {
        return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
      }

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

      const appliedInstallment = await prisma.loanInstallment.findFirst({
        where: { loanId: payment.loanId, actualPaymentDate: payment.date },
        orderBy: { installmentNumber: "asc" },
      });

      const receiptData: CollectionReceiptData = {
        receiptNo: payment.paymentNo,
        loanNo: payment.loan.loanNo,
        collectionDate: payment.date,
        installmentNumber: appliedInstallment?.installmentNumber,
        customer: {
          name: payment.customer.name,
          mobile: payment.customer.mobile,
          address: payment.customer.city || undefined,
        },
        previousOutstanding,
        principalPaid: payment.principalPortion,
        interestPaid: payment.interestPortion,
        otherCharges: payment.lateFeePortion || 0,
        totalAmountPaid: payment.amount,
        currentOutstanding,
        paymentMethod: (payment.paymentMethod as "CASH" | "UPI" | "BANK") || "CASH",
        referenceNo: payment.referenceNo || undefined,
        company,
      };

      messageText = generateWhatsAppReceiptMessage(receiptData);
      customerPhone = customerPhone || payment.customer.whatsapp || payment.customer.mobile;
      documentNumber = payment.paymentNo;
      documentUrl = `/api/documents/collection-receipt?paymentId=${payment.id}&download=1`;
    } else if (type === "LOAN") {
      const loan = await prisma.loan.findUnique({
        where: { id },
        include: {
          customer: true,
          installments: { orderBy: { installmentNumber: "asc" } },
        },
      });

      if (!loan) {
        return NextResponse.json({ error: "Loan record not found" }, { status: 404 });
      }

      const docData: LoanDocumentData = {
        loanNo: loan.loanNo,
        date: loan.date,
        customer: {
          name: loan.customer.name,
          mobile: loan.customer.mobile,
          address: loan.customer.city || undefined,
          customerId: loan.customer.customerCode,
        },
        principalAmount: loan.principalAmount,
        interestType: loan.interestType,
        interestRate: loan.interestRate,
        interestFrequency: loan.interestFrequency,
        paymentFrequency: loan.paymentFrequency,
        totalInstallments: loan.totalInstallments,
        installmentAmount: loan.installmentAmount,
        totalInterest: Math.max(0, loan.totalPayable - loan.principalAmount),
        totalPayable: loan.totalPayable,
        schedule: loan.installments.map((inst) => ({
          installmentNumber: inst.installmentNumber,
          dueDate: inst.dueDate,
          principalAmount: inst.principalPortion,
          interestAmount: inst.interestPortion,
          installmentAmount: inst.installmentAmount,
          paidAmount: inst.paidAmount,
          balanceAmount: Math.max(0, inst.installmentAmount - inst.paidAmount),
          status: inst.status,
        })),
        company,
      };

      messageText = generateWhatsAppLoanMessage(docData);
      customerPhone = customerPhone || loan.customer.whatsapp || loan.customer.mobile;
      documentNumber = loan.loanNo;
      documentUrl = `/api/documents/loan-document?id=${loan.id}&download=1`;
    }

    const cleanPhone = customerPhone.replace(/\D/g, "");
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const shareUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    // Check for Meta WhatsApp Cloud API credentials
    const waToken = process.env.WHATSAPP_API_TOKEN || process.env.META_WA_TOKEN;
    const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WA_PHONE_NUMBER_ID;

    if (!waToken || !waPhoneId) {
      // Cloud API not configured; return truthful status and manual fallback
      return NextResponse.json({
        success: true,
        deliveryMode: "MANUAL",
        configured: false,
        status: "NOT_CONFIGURED",
        message: "WhatsApp Business API not configured in server environment. Use direct WhatsApp share.",
        recipientPhone: waPhone,
        documentNumber,
        documentUrl,
        messageText,
        shareUrl,
      });
    }

    // If configured, attempt sending through Meta Graph API
    try {
      const metaRes = await fetch(`https://graph.facebook.com/v19.0/${waPhoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${waToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: waPhone,
          type: "text",
          text: { preview_url: true, body: messageText },
        }),
      });

      const metaData = await metaRes.json();

      if (!metaRes.ok) {
        return NextResponse.json({
          success: false,
          deliveryMode: "AUTOMATIC",
          configured: true,
          status: "FAILED",
          error: metaData?.error?.message || "Failed to dispatch via WhatsApp Cloud API",
          shareUrl,
          messageText,
        });
      }

      return NextResponse.json({
        success: true,
        deliveryMode: "AUTOMATIC",
        configured: true,
        status: "SENT",
        messageId: metaData?.messages?.[0]?.id,
        recipientPhone: waPhone,
        documentNumber,
        shareUrl,
      });
    } catch (apiErr: unknown) {
      const errMsg = apiErr instanceof Error ? apiErr.message : "WhatsApp dispatch error";
      return NextResponse.json({
        success: false,
        deliveryMode: "AUTOMATIC",
        configured: true,
        status: "FAILED",
        error: errMsg,
        shareUrl,
        messageText,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal error processing WhatsApp request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
