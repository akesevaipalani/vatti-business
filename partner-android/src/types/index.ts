export interface UserSession {
  username: string;
  name: string;
  role: string;
  partnerId?: string | null;
  permissions?: Record<string, boolean> | null;
}

export interface PartnerStatsResponse {
  role: string;
  partner: {
    name: string;
    code: string;
  };
  stats: {
    todayCollectionsCount: number;
    todayCollectionAmount: number;
    pendingCollectionsCount: number;
    pendingCollectionsAmount: number;
    totalCollectionsAmount: number;
    activeCustomerCount: number;
    totalCustomers: number;
    activeLoanCount: number;
  };
}

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  mobile: string;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  occupation?: string | null;
  referencePerson?: string | null;
  notes?: string | null;
  totalLoansCount?: number;
  activeLoansCount?: number;
  totalOutstanding?: number;
  loans?: LoanSummary[];
  guarantors?: Array<{ id: string; name: string; mobile: string; relationship?: string }>;
}

export interface LoanSummary {
  id: string;
  loanNo: string;
  principalAmount: number;
  principalOutstanding: number;
  interestOutstanding: number;
  status: string;
  dueDate?: string;
  date?: string;
}

export interface LoanDetail {
  id: string;
  loanNo: string;
  customerId: string;
  principalAmount: number;
  interestRate: number;
  interestType: string;
  interestFrequency: string;
  paymentFrequency: string;
  totalInstallments: number;
  installmentAmount: number;
  totalPayable: number;
  principalPaid: number;
  interestPaid: number;
  principalOutstanding: number;
  interestOutstanding: number;
  dueDate: string;
  status: string;
  date: string;
  notes?: string;
  customer: {
    id: string;
    name: string;
    mobile: string;
    city?: string;
    address?: string;
  };
  installments?: InstallmentItem[];
  payments?: LoanPayment[];
}

export interface InstallmentItem {
  id: string;
  loanId: string;
  loanNo?: string;
  customerId: string;
  customerName?: string;
  mobile?: string;
  address?: string;
  installmentNumber: number;
  scheduledCollectionDate?: string;
  dueDate: string;
  amountToCollect?: number;
  installmentAmount: number;
  principal?: number;
  principalPortion: number;
  interest?: number;
  interestPortion: number;
  paidAmount: number;
  remainingAmount?: number;
  status: "PENDING" | "COLLECTED" | "PARTIALLY_PAID" | "OVERDUE";
  actualPaymentDate?: string | null;
}

export interface TodayCollectionListResponse {
  date: string;
  totalCustomers: number;
  totalAmountToCollect: number;
  totalCollected: number;
  totalRemaining: number;
  items: Array<{
    id: string;
    loanId: string;
    loanNo: string;
    customerId: string;
    customerName: string;
    mobile: string;
    address: string;
    installmentNumber: number;
    scheduledCollectionDate: string;
    amountToCollect: number;
    principal: number;
    interest: number;
    paidAmount: number;
    remainingAmount: number;
    status: "PENDING" | "COLLECTED" | "PARTIALLY_PAID" | "OVERDUE";
    actualPaymentDate?: string | null;
  }>;
}

export interface PendingCustomerSummary {
  customerId: string;
  customerName: string;
  mobile: string;
  address: string;
  loans: Array<{ loanId: string; loanNo: string }>;
  loanNumbers: string;
  pendingInstallmentsCount: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
  totalPendingAmount: number;
  status: "PENDING" | "PARTIALLY_PAID" | "OVERDUE";
  installments: Array<{
    id: string;
    loanId: string;
    loanNo: string;
    installmentNumber: number;
    dueDate: string;
    expectedAmount: number;
    collectedAmount: number;
    pendingAmount: number;
    status: string;
  }>;
}

export interface PendingCollectionListResponse {
  date: string;
  totalPendingCustomers: number;
  totalPendingInstallments: number;
  totalPendingAmount: number;
  customers: PendingCustomerSummary[];
}

export interface LoanPayment {
  id: string;
  paymentNo: string;
  loanId: string;
  customerId: string;
  date: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  paymentMethod: string;
  referenceNo?: string | null;
  notes?: string | null;
  customer?: { id: string; name: string; mobile: string };
  loan?: { id: string; loanNo: string; principalAmount: number };
}
