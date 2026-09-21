import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { ensureDefaultAccounts } from "@/lib/accounting/engine";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      businessName,
      ownerName,
      phone,
      adminUsername,
      adminPassword,
      pinCode,
      openingCash,
      bankName,
      bankAccountNo,
      bankOpeningBalance,
    } = body;

    await ensureDefaultAccounts();

    // 1. Business Profile
    await prisma.businessProfile.upsert({
      where: { id: "default-biz" },
      update: {
        name: businessName || "VATTI BUSINESS",
        ownerName: ownerName || "Business Owner",
        phone: phone || "+91 94432 10987",
        isSetupDone: true,
      },
      create: {
        id: "default-biz",
        name: businessName || "VATTI BUSINESS",
        ownerName: ownerName || "Business Owner",
        phone: phone || "+91 94432 10987",
        isSetupDone: true,
      },
    });

    // 2. Admin User
    const passwordHash = await bcrypt.hash(adminPassword || "admin123", 10);
    await prisma.user.upsert({
      where: { username: adminUsername || "admin" },
      update: {
        passwordHash,
        name: ownerName || "Admin",
        pinCode: pinCode || "1234",
      },
      create: {
        username: adminUsername || "admin",
        passwordHash,
        name: ownerName || "Admin",
        pinCode: pinCode || "1234",
        role: "ADMIN",
      },
    });

    // 3. Opening Cash
    await prisma.cashAccount.upsert({
      where: { id: "main-cash" },
      update: {
        openingBalance: Number(openingCash) || 0,
        currentBalance: Number(openingCash) || 0,
      },
      create: {
        id: "main-cash",
        name: "Cash-in-Hand",
        openingBalance: Number(openingCash) || 0,
        currentBalance: Number(openingCash) || 0,
      },
    });

    // 4. Primary Bank Account
    if (bankName && bankAccountNo) {
      await prisma.bankAccount.create({
        data: {
          bankName,
          accountName: `${businessName || "Vatti"} Main Account`,
          accountNumber: bankAccountNo,
          openingBalance: Number(bankOpeningBalance) || 0,
          currentBalance: Number(bankOpeningBalance) || 0,
          isPrimary: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
