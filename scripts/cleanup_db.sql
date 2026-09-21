-- ============================================================
-- VATTI BUSINESS - PRECISE DATABASE CLEANUP SCRIPT
-- Date: 2026-09-20
-- 
-- KEEP:
--   Partner: ALAKESH KUMAR, BALAMURUGAN, KANNAN (3 records)
--   PartnerInvestment: 3 records (₹50,000 each)
--   LedgerTransaction: 3 partner investment transactions (INVESTMENT type)
--   LedgerEntry: 6 entries for the 3 partner investment transactions
--   AuditLog: Partner CREATE entries only
--
-- DELETE:
--   Customer: Mugesh (CUST-001)
--   Loan: LN-2026-001 (Mugesh ₹20,000 loan)
--   LoanInstallment: All 10 installments
--   LedgerTransaction: Mugesh loan disbursement (LOAN_GIVEN)
--   LedgerEntry: 2 entries for the loan disbursement
--   AuditLog: CUSTOMER, LOAN, PAYMENT entries + LOGIN entries
-- ============================================================

-- STEP 1: Delete Loan Installments
DELETE FROM LoanInstallment;

-- STEP 2: Delete Loan Payments
DELETE FROM LoanPayment;

-- STEP 3: Delete Loan
DELETE FROM Loan;

-- STEP 4: Delete Collateral (references Loan)
DELETE FROM Collateral;

-- STEP 5: Delete Guarantor (references Loan/Customer)
DELETE FROM Guarantor;

-- STEP 6: Delete Customer
DELETE FROM Customer;

-- STEP 7: Delete Ledger Entries for Mugesh loan disbursement
-- LedgerTransaction id: c70cad4e-266f-4943-ae92-789afffb0d3b (Loan Disbursed to Mugesh)
DELETE FROM LedgerEntry WHERE ledgerTransactionId = 'c70cad4e-266f-4943-ae92-789afffb0d3b';

-- STEP 8: Delete the Mugesh loan LedgerTransaction
DELETE FROM LedgerTransaction WHERE id = 'c70cad4e-266f-4943-ae92-789afffb0d3b';

-- STEP 9: Delete AuditLog - Remove non-partner entries
-- Keep only PARTNER CREATE entries
DELETE FROM AuditLog WHERE entity NOT IN ('PARTNER') OR action NOT IN ('CREATE');

-- STEP 10: Clear other business tables (safety sweep)
DELETE FROM Income;
DELETE FROM Expense;
DELETE FROM StockMovement;
DELETE FROM Product;
DELETE FROM SaleItem;
DELETE FROM Sale;
DELETE FROM PurchaseItem;
DELETE FROM Purchase;
DELETE FROM Asset;
DELETE FROM Liability;
DELETE FROM Supplier;
DELETE FROM InterestTransaction;
DELETE FROM BorrowedLoan;
DELETE FROM DailyClosing;
DELETE FROM MonthlyClosing;
DELETE FROM BankTransaction;
DELETE FROM BackupRecord;
DELETE FROM Reminder;
DELETE FROM Category;

-- STEP 11: Verify final state
SELECT '=== VERIFICATION ===' AS info;
SELECT 'Partner' AS tbl, COUNT(*) AS cnt FROM Partner
UNION ALL SELECT 'PartnerInvestment', COUNT(*) FROM PartnerInvestment
UNION ALL SELECT 'Customer', COUNT(*) FROM Customer
UNION ALL SELECT 'Loan', COUNT(*) FROM Loan
UNION ALL SELECT 'LoanInstallment', COUNT(*) FROM LoanInstallment
UNION ALL SELECT 'LoanPayment', COUNT(*) FROM LoanPayment
UNION ALL SELECT 'LedgerTransaction', COUNT(*) FROM LedgerTransaction
UNION ALL SELECT 'LedgerEntry', COUNT(*) FROM LedgerEntry
UNION ALL SELECT 'AuditLog', COUNT(*) FROM AuditLog
UNION ALL SELECT 'Income', COUNT(*) FROM Income
UNION ALL SELECT 'Expense', COUNT(*) FROM Expense
UNION ALL SELECT 'Product', COUNT(*) FROM Product
UNION ALL SELECT 'Sale', COUNT(*) FROM Sale
UNION ALL SELECT 'Purchase', COUNT(*) FROM Purchase
UNION ALL SELECT 'Supplier', COUNT(*) FROM Supplier;

SELECT '=== PARTNER VERIFICATION ===' AS info;
SELECT id, partnerCode, name, initialCapital, currentCapital, status FROM Partner;

SELECT '=== PARTNER INVESTMENT VERIFICATION ===' AS info;
SELECT pi.id, p.name, pi.amount, pi.type FROM PartnerInvestment pi 
JOIN Partner p ON pi.partnerId = p.id;
