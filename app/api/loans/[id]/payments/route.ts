import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postLoanCollection } from "@/lib/accounting/engine";
import { getCurrentUser } from "@/lib/auth/session";
import { syncEvents } from "@/lib/sync/events";
import { getNextReceiptNumber } from "@/lib/documents/numbering";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      amount,
      principalPortion,
      interestPortion,
      lateFeePortion,
      paymentMethod,
      collectionDate,
      date,
      referenceNo,
      notes,
    } = body;

    const totalAmount = Number(amount);
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: "Valid payment amount is required" }, { status: 400 });
    }

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Determine default allocation if not explicitly split
    let pPortion = Number(principalPortion);
    let iPortion = Number(interestPortion);

    if (isNaN(pPortion) || isNaN(iPortion) || pPortion + iPortion === 0) {
      // Default: interest first, rest to principal
      iPortion = Math.min(loan.interestOutstanding, totalAmount);
      pPortion = totalAmount - iPortion;
    }

    const paymentNo = await getNextReceiptNumber();

    // Parse collection date (defaults to current time if not provided)
    let paymentDate = new Date();
    const rawDate = collectionDate || date;
    if (rawDate) {
      if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        const [y, m, d] = rawDate.split("-").map(Number);
        const now = new Date();
        paymentDate = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
      } else {
        paymentDate = new Date(rawDate);
      }
    }

    // 1. Create Payment record with explicit collection date
    const payment = await prisma.loanPayment.create({
      data: {
        paymentNo,
        loanId: id,
        customerId: loan.customerId,
        amount: totalAmount,
        principalPortion: pPortion,
        interestPortion: iPortion,
        lateFeePortion: Number(lateFeePortion) || 0,
        paymentMethod: paymentMethod || "CASH",
        date: paymentDate,
        referenceNo,
        notes,
      },
    });

    // 2. Update Loan outstanding balances
    const newPrincipalOutstanding = Math.max(0, loan.principalOutstanding - pPortion);
    const newInterestOutstanding = Math.max(0, loan.interestOutstanding - iPortion);
    const isFullyPaid = newPrincipalOutstanding <= 0 && newInterestOutstanding <= 0;

    const updatedLoan = await prisma.loan.update({
      where: { id },
      data: {
        principalPaid: { increment: pPortion },
        interestPaid: { increment: iPortion },
        principalOutstanding: newPrincipalOutstanding,
        interestOutstanding: newInterestOutstanding,
        status: isFullyPaid ? "CLOSED" : loan.status,
        closedAt: isFullyPaid ? new Date() : undefined,
      },
    });

    // 2b. Reconcile with unpaid installments in FIFO order
    let remToApply = totalAmount;
    const unpaidInstallments = await prisma.loanInstallment.findMany({
      where: { loanId: id, status: { not: "COLLECTED" } },
      orderBy: { installmentNumber: "asc" },
    });

    for (const inst of unpaidInstallments) {
      if (remToApply <= 0) break;
      const pendingOnInst = inst.installmentAmount - inst.paidAmount;
      const applied = Math.min(remToApply, pendingOnInst);
      const isComplete = (inst.paidAmount + applied) >= inst.installmentAmount;
      const iApplied = Math.min(Math.max(0, inst.interestPortion - inst.interestPaid), applied);
      const pApplied = applied - iApplied;

      await prisma.loanInstallment.update({
        where: { id: inst.id },
        data: {
          paidAmount: { increment: applied },
          principalPaid: { increment: pApplied },
          interestPaid: { increment: iApplied },
          status: isComplete ? "COLLECTED" : "PARTIALLY_PAID",
          actualPaymentDate: paymentDate,
        },
      });

      remToApply -= applied;
    }

    // 3. Post double-entry transaction with collection date
    await postLoanCollection({
      loanId: id,
      customerName: loan.customer.name,
      totalAmount,
      principalPortion: pPortion,
      interestPortion: iPortion,
      paymentMethod: paymentMethod || "CASH",
      date: paymentDate,
    });

    // Determine current user for audit
    const session = await getCurrentUser();
    const collectorName = session?.name || session?.username || "Admin";

    // 4. Audit Log
    await prisma.auditLog.create({
      data: {
        action: "PAYMENT",
        entity: "LOAN",
        entityId: id,
        performedBy: collectorName,
        details: `Collected ₹${totalAmount} from ${loan.customer.name} for loan ${loan.loanNo} (Prin: ₹${pPortion}, Int: ₹${iPortion}) by ${collectorName}. Status: ${updatedLoan.status}`,
      },
    });

    // 5. Broadcast real-time sync event across all connected devices
    syncEvents.broadcast("COLLECTION_RECORDED", {
      loanId: id,
      loanNo: loan.loanNo,
      customerName: loan.customer.name,
      amount: totalAmount,
      collectedBy: collectorName,
      paymentNo: payment.paymentNo,
      time: Date.now(),
    });

    return NextResponse.json({ success: true, payment, loan: updatedLoan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
