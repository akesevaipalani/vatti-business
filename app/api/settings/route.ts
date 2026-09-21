import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const profile = await prisma.businessProfile.findUnique({
      where: { id: "default-biz" },
    });
    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { username: true, name: true, pinCode: true, language: true, theme: true },
    });

    return NextResponse.json({ profile, admin });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      ownerName,
      phone,
      email,
      address,
      city,
      gstin,
      pan,
      bankName,
      accountNo,
      ifsc,
      upiId,
      newPassword,
      pinCode,
    } = body;

    await prisma.businessProfile.upsert({
      where: { id: "default-biz" },
      update: {
        name,
        ownerName,
        phone,
        email,
        address,
        city,
        gstin,
        pan,
        bankName,
        accountNo,
        ifsc,
        upiId,
      },
      create: {
        id: "default-biz",
        name: name || "VATTI BUSINESS",
        ownerName: ownerName || "Owner",
        phone: phone || "+91 94432 10987",
        email,
        address,
        city,
        gstin,
        pan,
        bankName,
        accountNo,
        ifsc,
        upiId,
      },
    });

    if (newPassword || pinCode) {
      const updateData: { passwordHash?: string; pinCode?: string } = {};
      if (newPassword) {
        updateData.passwordHash = await bcrypt.hash(newPassword, 10);
      }
      if (pinCode) {
        updateData.pinCode = pinCode;
      }
      const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
      if (admin) {
        await prisma.user.update({
          where: { id: admin.id },
          data: updateData,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
