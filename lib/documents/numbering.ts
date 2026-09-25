import { prisma } from "@/lib/prisma";

export async function getNextLoanNumber(customYear?: number): Promise<string> {
  const year = customYear || new Date().getFullYear();
  const prefix = `ABC/LOAN/${year}/`;

  // Find the highest loan number for this year
  const latestLoan = await prisma.loan.findFirst({
    where: {
      loanNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      loanNo: "desc",
    },
    select: {
      loanNo: true,
    },
  });

  let nextIndex = 1;
  if (latestLoan && latestLoan.loanNo.startsWith(prefix)) {
    const suffix = latestLoan.loanNo.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed)) {
      nextIndex = parsed + 1;
    }
  } else {
    // If no ABC/LOAN format exists yet, check count to preserve total sequence
    const totalCount = await prisma.loan.count();
    nextIndex = Math.max(1, totalCount + 1);
  }

  return `${prefix}${String(nextIndex).padStart(6, "0")}`;
}

export async function getNextReceiptNumber(customYear?: number): Promise<string> {
  const year = customYear || new Date().getFullYear();
  const prefix = `ABC/RCPT/${year}/`;

  // Find the highest receipt/payment number for this year
  const latestPayment = await prisma.loanPayment.findFirst({
    where: {
      paymentNo: {
        startsWith: prefix,
      },
    },
    orderBy: {
      paymentNo: "desc",
    },
    select: {
      paymentNo: true,
    },
  });

  let nextIndex = 1;
  if (latestPayment && latestPayment.paymentNo.startsWith(prefix)) {
    const suffix = latestPayment.paymentNo.slice(prefix.length);
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed)) {
      nextIndex = parsed + 1;
    }
  } else {
    const totalCount = await prisma.loanPayment.count();
    nextIndex = Math.max(1, totalCount + 1);
  }

  return `${prefix}${String(nextIndex).padStart(6, "0")}`;
}
