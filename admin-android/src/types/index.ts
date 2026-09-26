export type UserRole = "ADMIN" | "PARTNER";

export interface UserSession {
  userId: string;
  username: string;
  role: string;
  name: string;
  partnerId?: string | null;
  permissions?: Record<string, boolean> | null;
}

export interface AdminStatsKPIs {
  totalCapital: number;
  totalPartnerInvestment: number;
  totalPartnerCapital: number;
  totalPartnerWithdrawal: number;
  totalMoneyGiven: number;
  totalPrincipalOutstanding: number;
  totalInterestReceivable: number;
  totalAmountReceivable: number;
  totalMoneyReceived: number;
  totalInterestReceived: number;
  totalExpenses: number;
  totalBusinessProfit: number;
  totalPartnerProfit: number;
  totalBusinessAssets: number;
  totalLiabilities: number;
  availableCash: number;
  bankBalance: number;
}

export interface AdminStatsToday {
  collection: number;
  expense: number;
  investment: number;
  withdrawal: number;
  profit: number;
  pendingCollections: number;
  overdueAmounts: number;
  overdueCount: number;
}

export interface MonthlyChartPoint {
  name: string;
  collections: number;
  interest: number;
  expenses: number;
  profit: number;
}

export interface ReminderItem {
  id: string;
  title: string;
  dueDate: string;
  amount?: number;
  isCompleted?: boolean;
}

export interface AdminStatsResponse {
  kpis: AdminStatsKPIs;
  today: AdminStatsToday;
  charts: {
    monthly: MonthlyChartPoint[];
  };
  reminders: ReminderItem[];
}

export interface Partner {
  id: string;
  partnerNo: string;
  name: string;
  mobile: string;
  email?: string;
  initialCapital: number;
  currentCapital: number;
  profitSharePercentage?: number;
  status: "ACTIVE" | "INACTIVE";
  notes?: string;
  investments?: Array<{ id: string; amount: number; createdAt: string; paymentMethod: string }>;
  withdrawals?: Array<{ id: string; amount: number; createdAt: string; paymentMethod: string }>;
}

export interface Customer {
  id: string;
  customerNo?: string;
  name: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  occupation?: string;
  referencePerson?: string;
  notes?: string;
  createdAt?: string;
  loans?: LoanDetail[];
  payments?: LoanPayment[];
}

export interface Installment {
  id: string;
  installmentNo?: number;
  installmentNumber?: number;
  dueDate: string;
  amount?: number;
  installmentAmount?: number;
  principalPortion: number;
  interestPortion: number;
  status: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE" | "COLLECTED" | "PARTIALLY_PAID" | string;
  paidAmount: number;
  balanceAmount?: number;
  paidDate?: string;
  actualPaymentDate?: string;
}

export interface LoanDetail {
  id: string;
  loanNo: string;
  customerId: string;
  customer?: { id: string; name: string; mobile: string; city?: string; address?: string; customerCode?: string };
  principalAmount: number;
  interestType: "FIXED" | "PERCENTAGE" | "REDUCING" | "FLAT" | "SIMPLE" | string;
  interestRate: number;
  interestFrequency: string;
  paymentFrequency: "DAILY" | "WEEKLY" | "MONTHLY" | string;
  totalInstallments: number;
  installmentAmount: number;
  totalPayable: number;
  customerReceives?: number;
  principalOutstanding: number;
  interestOutstanding: number;
  principalPaid: number;
  interestPaid: number;
  processingFee?: number;
  loanCalculationType?: string;
  advanceInterest?: number;
  disbursedAmount?: number;
  status: "ACTIVE" | "CLOSED" | "OVERDUE" | string;
  date?: string | Date;
  startDate: string;
  dueDate?: string;
  createdAt?: string;
  installments?: Installment[];
  schedule?: any[];
  payments?: LoanPayment[];
}

export interface LoanPayment {
  id: string;
  receiptNo: string;
  paymentNo?: string;
  loanId: string;
  customerId: string;
  installmentId?: string;
  amount: number;
  principalPortion: number;
  interestPortion: number;
  date: string;
  paymentMethod: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";
  referenceNo?: string;
  notes?: string;
  customer?: { name: string; mobile?: string; city?: string };
  loan?: { loanNo: string };
}

export interface TodayCollectionItem {
  id?: string;
  installmentId: string;
  loanId: string;
  loanNo: string;
  customerId?: string;
  customerName: string;
  customerCode?: string;
  mobile?: string;
  customerMobile: string;
  address?: string;
  installmentNo: number;
  installmentNumber?: number;
  amount: number;
  dueAmount?: number;
  installmentAmount?: number;
  paidAmount?: number;
  balance?: number;
  balanceAmount?: number;
  pendingAmount?: number;
  remainingAmount?: number;
  principalPortion: number;
  interestPortion: number;
  principal?: number;
  interest?: number;
  dueDate: string;
  dueDateYMD?: string;
  status: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE" | "COLLECTED" | "PARTIALLY_PAID" | string;
  statusRaw?: string;
  actualPaymentDate?: string | null;
  paymentMethod?: string | null;
}

export interface CollectedTodayPaymentItem {
  id: string;
  paymentNo: string;
  loanId: string;
  loanNo: string;
  customerId: string;
  customerName: string;
  customerCode?: string;
  mobile: string;
  installmentNumber?: number | null;
  installmentNo?: number | null;
  collectionDate: string;
  date: string;
  amount: number;
  amountCollected: number;
  principalPortion: number;
  interestPortion: number;
  paymentMethod: string;
  status: "PAID";
  notes?: string | null;
}

export interface CollectionScheduleResponse {
  date: string;
  dateDisplay: string;
  summary: {
    todayDueAmount: number;
    todayDueCount: number;
    todayCollectedAmount: number;
    todayCollectedCount: number;
    todayPendingAmount: number;
    todayPendingCount: number;
    todayCollectedOnDue: number;
    overdueAmount: number;
    overdueCount: number;
    futureCount: number;
    reconciled: boolean;
  };
  todayDue: TodayCollectionItem[];
  todayPending: TodayCollectionItem[];
  collectedToday: CollectedTodayPaymentItem[];
  overdue: TodayCollectionItem[];
  totalCustomers?: number;
  totalAmountToCollect?: number;
  totalCollected?: number;
  totalRemaining?: number;
  items?: TodayCollectionItem[];
}

export interface TodayCollectionListResponse extends CollectionScheduleResponse {
  date: string;
  totalAmountToCollect: number;
  totalCollected: number;
  items: TodayCollectionItem[];
}

export interface PendingCollectionListResponse {
  date: string;
  totalPendingAmount: number;
  totalPendingInstallments: number;
  items: TodayCollectionItem[];
}

export interface IncomeItem {
  id: string;
  incomeNo: string;
  type: string;
  description: string;
  amount: number;
  paymentMethod: string;
  date: string;
  referenceNo?: string;
  notes?: string;
}

export interface ExpenseItem {
  id: string;
  expenseNo: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  paidBy: string;
  date: string;
  referenceNo?: string;
  notes?: string;
}

export interface CashEntry {
  id: string;
  date: string;
  type: "IN" | "OUT";
  category: string;
  title: string;
  amount: number;
  ref: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  ifsc?: string;
  openingBalance: number;
  currentBalance: number;
  transactions?: Array<{
    id: string;
    type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER_IN" | "TRANSFER_OUT";
    amount: number;
    referenceNo?: string;
    description?: string;
    date: string;
  }>;
}

export interface DayClosingStatus {
  date: string;
  openingCash: number;
  totalReceipts: number;
  totalPayments: number;
  expectedClosingCash: number;
  isClosed: boolean;
  actualCashCount?: number;
  variance?: number;
}

export interface BusinessProfile {
  name: string;
  ownerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  gstin?: string;
  pan?: string;
  bankName?: string;
  accountNo?: string;
  ifsc?: string;
  upiId?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity: string;
  entityId?: string;
  performedBy: string;
  details: string;
}
