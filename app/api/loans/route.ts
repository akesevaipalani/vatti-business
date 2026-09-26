import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLoan } from "@/lib/loans/calculator";
import { postLoanDisbursement } from "@/lib/accounting/engine";
import { generateInstallmentsForLoan } from "@/lib/loans/installments";
import { getNextLoanNumber } from "@/lib/documents/numbering";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    const where: Prisma.LoanWhereInput = {};
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (q) {
      where.OR = [
        { loanNo: { contains: q } },
        { customer: { name: { contains: q } } },
        { customer: { mobile: { contains: q } } },
      ];
    }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, mobile: true, city: true } },
        payments: { orderBy: { date: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ loans });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch loans";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      customerId,
      principalAmount,
      loanCalculationType,
      interestType,
      interestRate,
      advanceInterestAmount,
      customInterestAmount,
      principalPerInstallment,
      interestPerInstallment,
      customInstallmentAmount,
      interestFrequency,
      paymentFrequency,
      totalInstallments,
      processingFee,
      paymentMethod,
      startDate,
      notes,
      guarantorName,
      guarantorMobile,
      guarantorRelationship,
      collateralType,
      collateralDescription,
      collateralEstimatedValue,
    } = body;

    const principal = Number(principalAmount);
    if (!customerId || !principal || principal <= 0) {
      return NextResponse.json({ error: "Customer and valid principal amount are required" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const calculationType = (loanCalculationType as "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL") || "STANDARD";

    // Run accurate loan calculation
    const calc = calculateLoan({
      principal,
      loanCalculationType: calculationType,
      interestRate: Number(interestRate) || 0,
      interestType: interestType || "FLAT",
      advanceInterestAmount: advanceInterestAmount !== undefined && advanceInterestAmount !== null ? Number(advanceInterestAmount) : undefined,
      customInterestAmount: customInterestAmount !== undefined && customInterestAmount !== null ? Number(customInterestAmount) : undefined,
      principalPerInstallment: principalPerInstallment !== undefined && principalPerInstallment !== null ? Number(principalPerInstallment) : undefined,
      interestPerInstallment: interestPerInstallment !== undefined && interestPerInstallment !== null ? Number(interestPerInstallment) : undefined,
      customInstallmentAmount: customInstallmentAmount !== undefined && customInstallmentAmount !== null ? Number(customInstallmentAmount) : undefined,
      processingFee: Number(processingFee) || 0,
      interestFrequency: interestFrequency || "MONTHLY",
      paymentFrequency: paymentFrequency || "MONTHLY",
      totalInstallments: Number(totalInstallments) || 12,
      startDate: startDate ? new Date(startDate) : new Date(),
    });

    const loanNo = await getNextLoanNumber();

    // Compute due date from schedule
    const lastItem = calc.schedule[calc.schedule.length - 1];
    const dueDate = lastItem ? new Date(lastItem.dueDate) : new Date(Date.now() + 30 * 86400000);

    // 1. Create Loan Record
    const loan = await prisma.loan.create({
      data: {
        loanNo,
        customerId,
        principalAmount: principal,
        loanCalculationType: calculationType,
        advanceInterest: calc.advanceInterest,
        disbursedAmount: calc.customerReceives,
        interestType: interestType || "FLAT",
        interestRate: Number(interestRate) || 0,
        interestFrequency: interestFrequency || "MONTHLY",
        paymentFrequency: paymentFrequency || "MONTHLY",
        totalInstallments: calc.totalInstallments,
        installmentAmount: calc.installmentAmount,
        processingFee: Number(processingFee) || 0,
        totalPayable: calc.totalPayable,
        principalOutstanding: principal,
        interestOutstanding: calculationType === "ADVANCE_INTEREST" ? 0 : calc.totalInterest,
        dueDate,
        status: "ACTIVE",
        notes,
      } as any,
    });

    // 1b. Generate scheduled installments in database with high performance precalculated batch
    await generateInstallmentsForLoan(loan.id, calc.schedule, { customerId });

    // 2. Guarantor if provided
    if (guarantorName) {
      await prisma.guarantor.create({
        data: {
          customerId,
          name: guarantorName,
          mobile: guarantorMobile || "",
          relationship: guarantorRelationship || "Guarantor",
        },
      });
    }

    // 3. Collateral if provided
    if (collateralType && collateralDescription) {
      await prisma.collateral.create({
        data: {
          customerId,
          loanId: loan.id,
          type: collateralType,
          description: collateralDescription,
          estimatedValue: Number(collateralEstimatedValue) || 0,
          status: "HELD",
        },
      });
    }

    // 4. Double-entry posting: Cash/Bank reduces, Loans Receivable increases, Advance Interest / Fees credited if applicable
    await postLoanDisbursement({
      loanId: loan.id,
      customerName: customer.name,
      principalAmount: principal,
      customerReceives: calc.customerReceives,
      advanceInterest: calc.advanceInterest,
      processingFee: Number(processingFee) || 0,
      paymentMethod: paymentMethod || "CASH",
    });

    // 5. Audit Log
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "LOAN",
        entityId: loan.id,
        performedBy: "Admin",
        details: `Disbursed loan ${loanNo} of ₹${principal} to ${customer.name} at ${interestRate}% ${interestFrequency} interest`,
      },
    });

    return NextResponse.json({ success: true, loan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to disburse loan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
