import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { ensureDefaultAccounts } from "./accounting/engine";

export async function seedDemoData() {
  console.log("Seeding VATTI BUSINESS database...");

  // 1. Chart of accounts & Cash account
  await ensureDefaultAccounts();

  // 2. Admin User (Only create if not existing; never overwrite credentials)
  const existingAdmin = await prisma.user.findFirst({
    where: { OR: [{ username: "admin" }, { role: "ADMIN" }] },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        username: "admin",
        passwordHash,
        name: "Business Owner / Admin",
        role: "ADMIN",
        pinCode: "1234",
        language: "en",
        theme: "light",
      },
    });
  }

  // 3. Business Profile
  await prisma.businessProfile.upsert({
    where: { id: "default-biz" },
    update: {
      name: "VATTI BUSINESS",
      ownerName: "Business Owner",
      phone: "+91 94432 10987",
      email: "admin@vattibusiness.com",
      address: "124-A, West Masi Street",
      city: "Madurai",
      state: "Tamil Nadu",
      pincode: "625001",
      gstin: "33AAAAA0000A1Z5",
      pan: "ABCDE1234F",
      bankName: "State Bank of India",
      accountNo: "30894567890",
      ifsc: "SBIN0001234",
      upiId: "vatti@sbi",
      currencySymbol: "₹",
      isSetupDone: true,
    },
    create: {
      id: "default-biz",
      name: "VATTI BUSINESS",
      ownerName: "Business Owner",
      phone: "+91 94432 10987",
      email: "admin@vattibusiness.com",
      address: "124-A, West Masi Street",
      city: "Madurai",
      state: "Tamil Nadu",
      pincode: "625001",
      gstin: "33AAAAA0000A1Z5",
      pan: "ABCDE1234F",
      bankName: "State Bank of India",
      accountNo: "30894567890",
      ifsc: "SBIN0001234",
      upiId: "vatti@sbi",
      currencySymbol: "₹",
      isSetupDone: true,
    },
  });

  // 4. Cash and Bank Accounts
  await prisma.cashAccount.upsert({
    where: { id: "main-cash" },
    update: { openingBalance: 150000, currentBalance: 285000 },
    create: { id: "main-cash", name: "Cash-in-Hand", openingBalance: 150000, currentBalance: 285000 },
  });

  const existingBank = await prisma.bankAccount.findFirst();
  if (!existingBank) {
    await prisma.bankAccount.create({
      data: {
        bankName: "State Bank of India",
        accountName: "Vatti Business Current A/c",
        accountNumber: "30894567890",
        ifsc: "SBIN0001234",
        openingBalance: 400000,
        currentBalance: 520000,
        isPrimary: true,
      },
    });

    await prisma.bankAccount.create({
      data: {
        bankName: "HDFC Bank",
        accountName: "Vatti Business Reserve",
        accountNumber: "50200087654",
        ifsc: "HDFC0000456",
        openingBalance: 200000,
        currentBalance: 245000,
        isPrimary: false,
      },
    });
  }

  // 5. Partners
  const existingPartner = await prisma.partner.findFirst();
  if (!existingPartner) {
    const p1 = await prisma.partner.create({
      data: {
        partnerCode: "PRT-001",
        name: "P. Karthikeyan",
        mobile: "+91 98421 11223",
        email: "karthik@vattibusiness.com",
        address: "12, Kamarajar Salai, Madurai",
        initialCapital: 500000,
        currentCapital: 550000,
        profitSharePercent: 50,
        lossSharePercent: 50,
        status: "ACTIVE",
        notes: "Managing Partner",
      },
    });

    const p2 = await prisma.partner.create({
      data: {
        partnerCode: "PRT-002",
        name: "S. Muthukumar",
        mobile: "+91 97890 22334",
        email: "muthu@vattibusiness.com",
        address: "78, Palace Road, Madurai",
        initialCapital: 300000,
        currentCapital: 325000,
        profitSharePercent: 30,
        lossSharePercent: 30,
        status: "ACTIVE",
        notes: "Capital Partner",
      },
    });

    const p3 = await prisma.partner.create({
      data: {
        partnerCode: "PRT-003",
        name: "R. Anandhan",
        mobile: "+91 94433 33445",
        email: "anand@vattibusiness.com",
        address: "34, South Veli St, Madurai",
        initialCapital: 200000,
        currentCapital: 210000,
        profitSharePercent: 20,
        lossSharePercent: 20,
        status: "ACTIVE",
        notes: "Sleeping Partner",
      },
    });

    // Partner Investments
    await prisma.partnerInvestment.create({
      data: {
        investmentCode: "INV-PRT-001",
        partnerId: p1.id,
        amount: 500000,
        type: "INITIAL",
        paymentMethod: "BANK",
        purpose: "Initial Business Capital",
      },
    });
    await prisma.partnerInvestment.create({
      data: {
        investmentCode: "INV-PRT-002",
        partnerId: p1.id,
        amount: 50000,
        type: "ADDITIONAL",
        paymentMethod: "BANK",
        purpose: "Festival Loan Expansion",
      },
    });
    await prisma.partnerInvestment.create({
      data: {
        investmentCode: "INV-PRT-003",
        partnerId: p2.id,
        amount: 300000,
        type: "INITIAL",
        paymentMethod: "BANK",
        purpose: "Initial Partner Capital",
      },
    });
    await prisma.partnerInvestment.create({
      data: {
        investmentCode: "INV-PRT-004",
        partnerId: p3.id,
        amount: 200000,
        type: "INITIAL",
        paymentMethod: "CASH",
        purpose: "Initial Partner Capital",
      },
    });

    // Partner Withdrawal
    await prisma.partnerWithdrawal.create({
      data: {
        withdrawalCode: "WDL-PRT-001",
        partnerId: p2.id,
        amount: 20000,
        reason: "Personal Emergency",
        paymentMethod: "BANK",
      },
    });
  }

  // 6. Customers (Borrowers)
  const existingCustomer = await prisma.customer.findFirst();
  if (!existingCustomer) {
    const customersData = [
      { name: "K. Senthil Nathan", mobile: "98421 55667", city: "Madurai", occupation: "Textile Shop Owner", address: "14, Town Hall Rd" },
      { name: "M. Saravanan", mobile: "97890 66778", city: "Madurai", occupation: "Grocery Merchant", address: "88, West Masi St" },
      { name: "V. Meenakshi Sundaram", mobile: "94431 77889", city: "Madurai", occupation: "Tea Stall Owner", address: "22, Periyar Bus Stand" },
      { name: "A. Pandian", mobile: "99442 88990", city: "Madurai", occupation: "Auto Consultant", address: "40, Ellis Nagar" },
      { name: "R. Kannan", mobile: "98433 99001", city: "Madurai", occupation: "Mobile Accessories", address: "05, Simmakkal" },
      { name: "G. Murugesan", mobile: "97510 11224", city: "Dindigul", occupation: "Vegetable Commission", address: "Market Road" },
      { name: "S. Manikandan", mobile: "98425 22335", city: "Madurai", occupation: "Hardware Store", address: "67, Workshop Road" },
      { name: "T. Arumugam", mobile: "94880 33446", city: "Theni", occupation: "Spices Trader", address: "Bazaar Street" },
      { name: "P. Rajasekaran", mobile: "99940 44557", city: "Madurai", occupation: "Electrical Contractor", address: "19, KK Nagar" },
      { name: "N. Selvaraj", mobile: "98940 55668", city: "Madurai", occupation: "Bakery Owner", address: "102, Anna Nagar" },
    ];

    for (let i = 0; i < customersData.length; i++) {
      const c = customersData[i];
      const createdCustomer = await prisma.customer.create({
        data: {
          customerCode: `CUST-${String(i + 1).padStart(3, "0")}`,
          name: c.name,
          mobile: c.mobile,
          city: c.city,
          occupation: c.occupation,
          address: c.address,
        },
      });

      // Create Guarantor
      await prisma.guarantor.create({
        data: {
          customerId: createdCustomer.id,
          name: `${c.name.split(" ")[1] || "Kumar"} Relative`,
          mobile: "94430 00000",
          relationship: "Brother / Business Partner",
          address: c.address,
        },
      });

      // Create 5 active loans for the first 5 customers
      if (i < 5) {
        const principal = (i + 1) * 25000 + 25000; // 50,000, 75,000, etc.
        const interestRate = 2.0; // 2% per month
        const installments = 10;
        const totalInterest = (principal * interestRate * installments) / 100;
        const totalPayable = principal + totalInterest;
        const installmentAmount = Math.round(totalPayable / installments);

        const loan = await prisma.loan.create({
          data: {
            loanNo: `LN-2026-${String(i + 1).padStart(3, "0")}`,
            customerId: createdCustomer.id,
            principalAmount: principal,
            interestType: i === 1 ? "REDUCING" : "FLAT",
            interestRate,
            interestFrequency: "MONTHLY",
            paymentFrequency: "MONTHLY",
            totalInstallments: installments,
            installmentAmount,
            totalPayable,
            principalPaid: installmentAmount * 2 * 0.8,
            interestPaid: installmentAmount * 2 * 0.2,
            principalOutstanding: principal - (installmentAmount * 2 * 0.8),
            interestOutstanding: totalInterest - (installmentAmount * 2 * 0.2),
            status: "ACTIVE",
            dueDate: new Date(Date.now() + 15 * 86400000),
          },
        });

        // Record 2 sample payments
        await prisma.loanPayment.create({
          data: {
            paymentNo: `PAY-2026-${String(i + 1).padStart(3, "0")}-1`,
            loanId: loan.id,
            customerId: createdCustomer.id,
            amount: installmentAmount,
            principalPortion: installmentAmount * 0.8,
            interestPortion: installmentAmount * 0.2,
            paymentMethod: "CASH",
            date: new Date(Date.now() - 30 * 86400000),
          },
        });

        await prisma.loanPayment.create({
          data: {
            paymentNo: `PAY-2026-${String(i + 1).padStart(3, "0")}-2`,
            loanId: loan.id,
            customerId: createdCustomer.id,
            amount: installmentAmount,
            principalPortion: installmentAmount * 0.8,
            interestPortion: installmentAmount * 0.2,
            paymentMethod: "UPI",
            referenceNo: "UPI/9876543210/PAY",
            date: new Date(Date.now() - 2 * 86400000),
          },
        });
      }
    }
  }

  // 7. Borrowed Loans (Loans Taken from Bank/Financier)
  const existingBorrowed = await prisma.borrowedLoan.findFirst();
  if (!existingBorrowed) {
    await prisma.borrowedLoan.create({
      data: {
        loanCode: "BL-2026-001",
        lenderName: "Sundaram Finance Ltd",
        contact: "0452-2345678",
        amount: 300000,
        interestRate: 11.5,
        installmentAmount: 15000,
        paidAmount: 60000,
        balanceAmount: 240000,
        interestPaid: 12000,
        paymentMethod: "BANK",
        status: "ACTIVE",
        notes: "Business Expansion Credit Line",
      },
    });
  }

  // 8. Expenses
  const existingExpense = await prisma.expense.findFirst();
  if (!existingExpense) {
    const sampleExpenses = [
      { category: "RENT", amount: 18000, description: "Office Monthly Rent", method: "BANK" },
      { category: "ELECTRICITY", amount: 2450, description: "TNEB Power Bill", method: "UPI" },
      { category: "SALARY", amount: 15000, description: "Collection Agent Salary", method: "BANK" },
      { category: "FUEL", amount: 3200, description: "Collection Bike Petrol", method: "CASH" },
      { category: "INTERNET", amount: 999, description: "Office Fiber Internet", method: "UPI" },
      { category: "OFFICE", amount: 1250, description: "Tea, Refreshments & Stationery", method: "CASH" },
    ];

    for (let i = 0; i < sampleExpenses.length; i++) {
      const exp = sampleExpenses[i];
      await prisma.expense.create({
        data: {
          expenseNo: `EXP-2026-${String(i + 1).padStart(3, "0")}`,
          category: exp.category,
          amount: exp.amount,
          description: exp.description,
          paymentMethod: exp.method,
        },
      });
    }
  }

  // 9. Other Incomes
  const existingIncome = await prisma.income.findFirst();
  if (!existingIncome) {
    await prisma.income.create({
      data: {
        incomeNo: "INC-2026-001",
        type: "COMMISSION",
        description: "Document Processing & Verification Charges",
        amount: 8500,
        paymentMethod: "CASH",
      },
    });
    await prisma.income.create({
      data: {
        incomeNo: "INC-2026-002",
        type: "SERVICE",
        description: "Cheque Clearance Assistance Fee",
        amount: 3200,
        paymentMethod: "UPI",
      },
    });
  }

  // 10. Assets
  const existingAsset = await prisma.asset.findFirst();
  if (!existingAsset) {
    await prisma.asset.create({
      data: {
        assetCode: "AST-001",
        assetName: "Dell Core i5 All-in-One Office Desktop",
        category: "COMPUTER",
        purchaseCost: 48000,
        currentValue: 42000,
        location: "Owner Desk",
      },
    });
    await prisma.asset.create({
      data: {
        assetCode: "AST-002",
        assetName: "Godrej Fireproof Security Safe / Locker",
        category: "EQUIPMENT",
        purchaseCost: 35000,
        currentValue: 35000,
        location: "Strong Room",
      },
    });
    await prisma.asset.create({
      data: {
        assetCode: "AST-003",
        assetName: "Heavy Duty Currency Counting Machine with Fake Note Detector",
        category: "EQUIPMENT",
        purchaseCost: 14500,
        currentValue: 12000,
        location: "Cash Counter",
      },
    });
  }

  // 11. Initial Reminders
  const existingReminder = await prisma.reminder.findFirst();
  if (!existingReminder) {
    await prisma.reminder.create({
      data: {
        title: "K. Senthil Nathan - Monthly Interest Due",
        dueDate: new Date(Date.now() + 2 * 86400000),
        type: "LOAN_DUE",
        notes: "Call in morning for shop collection",
      },
    });
    await prisma.reminder.create({
      data: {
        title: "Sundaram Finance - Business Loan EMI Due",
        dueDate: new Date(Date.now() + 5 * 86400000),
        type: "LOAN_DUE",
        notes: "Keep ₹15,000 balance in SBI A/c for auto debit",
      },
    });
  }

  console.log("VATTI BUSINESS database successfully seeded with realistic private records!");
}
