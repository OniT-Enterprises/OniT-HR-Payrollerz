/**
 * Data Audit Report Generator
 *
 * Pulls all financial data and creates a comprehensive report
 * to verify all numbers add up correctly.
 *
 * Usage: node scripts/auditData.mjs > audit-report.txt
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Load service account
const serviceAccount = JSON.parse(
  readFileSync(new URL('../service-account.json', import.meta.url), 'utf8')
);

// Initialize Firebase Admin
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();
const TENANT_ID = 'onit';

// Helper to format currency
const fmt = (n) => `$${(n || 0).toFixed(2).padStart(10)}`;
const fmtNum = (n) => (n || 0).toFixed(2);

// Helper to convert Firestore timestamp
const toDate = (ts) => {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  return new Date(ts);
};

async function fetchCollection(path) {
  const snapshot = await db.collection(path).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function main() {
  console.log('═'.repeat(80));
  console.log('  ONIT HR/PAYROLL SYSTEM - DATA AUDIT REPORT');
  console.log('  Generated:', new Date().toISOString());
  console.log('  Tenant:', TENANT_ID);
  console.log('═'.repeat(80));

  // Fetch all data
  const [
    invoices,
    paymentsReceived,
    bills,
    billPayments,
    expenses,
    customers,
    vendors,
    employees,
    departments,
    accounts,
  ] = await Promise.all([
    fetchCollection(`tenants/${TENANT_ID}/invoices`),
    fetchCollection(`tenants/${TENANT_ID}/payments_received`),
    fetchCollection(`tenants/${TENANT_ID}/bills`),
    fetchCollection(`tenants/${TENANT_ID}/bill_payments`),
    fetchCollection(`tenants/${TENANT_ID}/expenses`),
    fetchCollection(`tenants/${TENANT_ID}/customers`),
    fetchCollection(`tenants/${TENANT_ID}/vendors`),
    fetchCollection(`tenants/${TENANT_ID}/employees`),
    fetchCollection(`tenants/${TENANT_ID}/departments`),
    fetchCollection(`tenants/${TENANT_ID}/accounts`),
  ]);

  // ==========================================
  // SECTION 1: INVOICES (ACCOUNTS RECEIVABLE)
  // ==========================================
  console.log('\n' + '─'.repeat(80));
  console.log('  SECTION 1: INVOICES (ACCOUNTS RECEIVABLE)');
  console.log('─'.repeat(80));

  let totalInvoiced = 0;
  let totalPaidInvoices = 0;
  let totalOutstandingAR = 0;

  console.log('\n  Individual Invoices:');
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'Invoice #'.padEnd(15)} ${'Customer'.padEnd(25)} ${'Total'.padStart(12)} ${'Paid'.padStart(12)} ${'Balance'.padStart(12)} Status`);
  console.log('  ' + '-'.repeat(76));

  invoices.sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber));

  for (const inv of invoices) {
    const total = inv.total || 0;
    const paid = inv.amountPaid || 0;
    const balance = inv.balanceDue || (total - paid);

    totalInvoiced += total;
    totalPaidInvoices += paid;
    totalOutstandingAR += balance;

    // Verify calculation
    const calcBalance = total - paid;
    const balanceCheck = Math.abs(balance - calcBalance) < 0.01 ? '✓' : `⚠ MISMATCH (calc: ${fmtNum(calcBalance)})`;

    console.log(`  ${(inv.invoiceNumber || 'N/A').padEnd(15)} ${(inv.customerName || '').substring(0, 24).padEnd(25)} ${fmt(total)} ${fmt(paid)} ${fmt(balance)} ${inv.status}`);
    if (balanceCheck !== '✓') {
      console.log(`     ${balanceCheck}`);
    }
  }

  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'TOTALS'.padEnd(15)} ${''.padEnd(25)} ${fmt(totalInvoiced)} ${fmt(totalPaidInvoices)} ${fmt(totalOutstandingAR)}`);

  // Verify totals
  const calcOutstanding = totalInvoiced - totalPaidInvoices;
  console.log('\n  Verification:');
  console.log(`    Total Invoiced:        ${fmt(totalInvoiced)}`);
  console.log(`    Total Paid:            ${fmt(totalPaidInvoices)}`);
  console.log(`    Outstanding (stored):  ${fmt(totalOutstandingAR)}`);
  console.log(`    Outstanding (calc):    ${fmt(calcOutstanding)}`);
  console.log(`    Difference:            ${fmt(totalOutstandingAR - calcOutstanding)} ${Math.abs(totalOutstandingAR - calcOutstanding) < 0.01 ? '✓ OK' : '⚠ MISMATCH'}`);

  // Payments received detail
  console.log('\n  Payments Received Detail:');
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'Date'.padEnd(12)} ${'Customer'.padEnd(25)} ${'Invoice'.padEnd(15)} ${'Amount'.padStart(12)} Method`);
  console.log('  ' + '-'.repeat(76));

  let totalPaymentsReceived = 0;
  for (const pay of paymentsReceived) {
    totalPaymentsReceived += pay.amount || 0;
    console.log(`  ${(pay.date || '').padEnd(12)} ${(pay.customerName || '').substring(0, 24).padEnd(25)} ${(pay.invoiceNumber || 'N/A').padEnd(15)} ${fmt(pay.amount)} ${pay.method}`);
  }
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'TOTAL'.padEnd(12)} ${''.padEnd(25)} ${''.padEnd(15)} ${fmt(totalPaymentsReceived)}`);

  console.log('\n  Payment Cross-Check:');
  console.log(`    Sum of Invoice amountPaid:   ${fmt(totalPaidInvoices)}`);
  console.log(`    Sum of payments_received:    ${fmt(totalPaymentsReceived)}`);
  console.log(`    Difference:                  ${fmt(totalPaidInvoices - totalPaymentsReceived)} ${Math.abs(totalPaidInvoices - totalPaymentsReceived) < 0.01 ? '✓ OK' : '⚠ MISMATCH'}`);

  // ==========================================
  // SECTION 2: BILLS (ACCOUNTS PAYABLE)
  // ==========================================
  console.log('\n' + '─'.repeat(80));
  console.log('  SECTION 2: BILLS (ACCOUNTS PAYABLE)');
  console.log('─'.repeat(80));

  let totalBilled = 0;
  let totalPaidBills = 0;
  let totalOutstandingAP = 0;

  console.log('\n  Individual Bills:');
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'Bill #'.padEnd(20)} ${'Vendor'.padEnd(20)} ${'Total'.padStart(12)} ${'Paid'.padStart(12)} ${'Balance'.padStart(12)} Status`);
  console.log('  ' + '-'.repeat(76));

  bills.sort((a, b) => (a.billNumber || '').localeCompare(b.billNumber || ''));

  for (const bill of bills) {
    const total = bill.total || 0;
    const paid = bill.amountPaid || 0;
    const balance = bill.balanceDue || (total - paid);

    totalBilled += total;
    totalPaidBills += paid;
    totalOutstandingAP += balance;

    // Verify calculation
    const calcBalance = total - paid;
    const balanceCheck = Math.abs(balance - calcBalance) < 0.01 ? '✓' : `⚠ MISMATCH (calc: ${fmtNum(calcBalance)})`;

    console.log(`  ${(bill.billNumber || 'N/A').substring(0, 19).padEnd(20)} ${(bill.vendorName || '').substring(0, 19).padEnd(20)} ${fmt(total)} ${fmt(paid)} ${fmt(balance)} ${bill.status}`);
    if (balanceCheck !== '✓') {
      console.log(`     ${balanceCheck}`);
    }
  }

  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'TOTALS'.padEnd(20)} ${''.padEnd(20)} ${fmt(totalBilled)} ${fmt(totalPaidBills)} ${fmt(totalOutstandingAP)}`);

  // Verify totals
  const calcOutstandingAP = totalBilled - totalPaidBills;
  console.log('\n  Verification:');
  console.log(`    Total Billed:          ${fmt(totalBilled)}`);
  console.log(`    Total Paid:            ${fmt(totalPaidBills)}`);
  console.log(`    Outstanding (stored):  ${fmt(totalOutstandingAP)}`);
  console.log(`    Outstanding (calc):    ${fmt(calcOutstandingAP)}`);
  console.log(`    Difference:            ${fmt(totalOutstandingAP - calcOutstandingAP)} ${Math.abs(totalOutstandingAP - calcOutstandingAP) < 0.01 ? '✓ OK' : '⚠ MISMATCH'}`);

  // Bill payments detail
  console.log('\n  Bill Payments Detail:');
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'Date'.padEnd(12)} ${'Bill ID'.padEnd(20)} ${'Amount'.padStart(12)} Method`);
  console.log('  ' + '-'.repeat(76));

  let totalBillPayments = 0;
  for (const pay of billPayments) {
    totalBillPayments += pay.amount || 0;
    console.log(`  ${(pay.date || '').padEnd(12)} ${(pay.billId || '').substring(0, 19).padEnd(20)} ${fmt(pay.amount)} ${pay.method}`);
  }
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'TOTAL'.padEnd(12)} ${''.padEnd(20)} ${fmt(totalBillPayments)}`);

  console.log('\n  Payment Cross-Check:');
  console.log(`    Sum of Bill amountPaid:      ${fmt(totalPaidBills)}`);
  console.log(`    Sum of bill_payments:        ${fmt(totalBillPayments)}`);
  console.log(`    Difference:                  ${fmt(totalPaidBills - totalBillPayments)} ${Math.abs(totalPaidBills - totalBillPayments) < 0.01 ? '✓ OK' : '⚠ MISMATCH'}`);

  // ==========================================
  // SECTION 3: EXPENSES
  // ==========================================
  console.log('\n' + '─'.repeat(80));
  console.log('  SECTION 3: EXPENSES');
  console.log('─'.repeat(80));

  console.log('\n  Individual Expenses:');
  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'Date'.padEnd(12)} ${'Description'.padEnd(40)} ${'Category'.padEnd(15)} ${'Amount'.padStart(10)}`);
  console.log('  ' + '-'.repeat(76));

  let totalExpenses = 0;
  const expensesByCategory = {};

  expenses.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  for (const exp of expenses) {
    totalExpenses += exp.amount || 0;
    expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + (exp.amount || 0);
    console.log(`  ${(exp.date || '').padEnd(12)} ${(exp.description || '').substring(0, 39).padEnd(40)} ${(exp.category || '').padEnd(15)} ${fmt(exp.amount)}`);
  }

  console.log('  ' + '-'.repeat(76));
  console.log(`  ${'TOTAL'.padEnd(12)} ${''.padEnd(40)} ${''.padEnd(15)} ${fmt(totalExpenses)}`);

  console.log('\n  Expenses by Category:');
  for (const [cat, amount] of Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${cat.padEnd(20)} ${fmt(amount)}`);
  }

  // ==========================================
  // SECTION 4: DASHBOARD CALCULATIONS
  // ==========================================
  console.log('\n' + '─'.repeat(80));
  console.log('  SECTION 4: EXPECTED DASHBOARD VALUES');
  console.log('─'.repeat(80));

  // Invoice status breakdown
  const invoicesByStatus = {};
  for (const inv of invoices) {
    invoicesByStatus[inv.status] = invoicesByStatus[inv.status] || { count: 0, total: 0, outstanding: 0 };
    invoicesByStatus[inv.status].count++;
    invoicesByStatus[inv.status].total += inv.total || 0;
    invoicesByStatus[inv.status].outstanding += inv.balanceDue || 0;
  }

  console.log('\n  Invoices by Status:');
  console.log(`    ${'Status'.padEnd(12)} ${'Count'.padStart(6)} ${'Total'.padStart(12)} ${'Outstanding'.padStart(12)}`);
  console.log('    ' + '-'.repeat(44));
  for (const [status, data] of Object.entries(invoicesByStatus)) {
    console.log(`    ${status.padEnd(12)} ${String(data.count).padStart(6)} ${fmt(data.total)} ${fmt(data.outstanding)}`);
  }

  // Bills status breakdown
  const billsByStatus = {};
  for (const bill of bills) {
    billsByStatus[bill.status] = billsByStatus[bill.status] || { count: 0, total: 0, outstanding: 0 };
    billsByStatus[bill.status].count++;
    billsByStatus[bill.status].total += bill.total || 0;
    billsByStatus[bill.status].outstanding += bill.balanceDue || 0;
  }

  console.log('\n  Bills by Status:');
  console.log(`    ${'Status'.padEnd(12)} ${'Count'.padStart(6)} ${'Total'.padStart(12)} ${'Outstanding'.padStart(12)}`);
  console.log('    ' + '-'.repeat(44));
  for (const [status, data] of Object.entries(billsByStatus)) {
    console.log(`    ${status.padEnd(12)} ${String(data.count).padStart(6)} ${fmt(data.total)} ${fmt(data.outstanding)}`);
  }

  // Summary metrics for dashboard
  console.log('\n  Dashboard Summary Metrics:');
  console.log('    ' + '-'.repeat(50));
  console.log(`    Total Revenue (Invoiced):      ${fmt(totalInvoiced)}`);
  console.log(`    Total Collected (AR):          ${fmt(totalPaidInvoices)}`);
  console.log(`    Outstanding Receivables:       ${fmt(totalOutstandingAR)}`);
  console.log('    ' + '-'.repeat(50));
  console.log(`    Total Bills:                   ${fmt(totalBilled)}`);
  console.log(`    Total Paid (AP):               ${fmt(totalPaidBills)}`);
  console.log(`    Outstanding Payables:          ${fmt(totalOutstandingAP)}`);
  console.log('    ' + '-'.repeat(50));
  console.log(`    Total Direct Expenses:         ${fmt(totalExpenses)}`);
  console.log('    ' + '-'.repeat(50));
  console.log(`    Net Position (AR - AP):        ${fmt(totalOutstandingAR - totalOutstandingAP)}`);

  // ==========================================
  // SECTION 5: AGING ANALYSIS
  // ==========================================
  console.log('\n' + '─'.repeat(80));
  console.log('  SECTION 5: AGING ANALYSIS');
  console.log('─'.repeat(80));

  const today = new Date();
  const aging = { current: 0, days30: 0, days60: 0, days90: 0 };

  console.log('\n  AR Aging (by Due Date):');
  for (const inv of invoices) {
    if (inv.status === 'paid' || inv.status === 'cancelled') continue;
    const dueDate = new Date(inv.dueDate);
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    const balance = inv.balanceDue || 0;

    if (daysPastDue <= 0) aging.current += balance;
    else if (daysPastDue <= 30) aging.days30 += balance;
    else if (daysPastDue <= 60) aging.days60 += balance;
    else aging.days90 += balance;
  }

  console.log(`    Current (not due):    ${fmt(aging.current)}`);
  console.log(`    1-30 days overdue:    ${fmt(aging.days30)}`);
  console.log(`    31-60 days overdue:   ${fmt(aging.days60)}`);
  console.log(`    60+ days overdue:     ${fmt(aging.days90)}`);
  console.log(`    Total Outstanding:    ${fmt(aging.current + aging.days30 + aging.days60 + aging.days90)}`);

  const agingCheck = aging.current + aging.days30 + aging.days60 + aging.days90;
  const unpaidInvoicesTotal = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').reduce((sum, i) => sum + (i.balanceDue || 0), 0);
  console.log(`    Cross-check with unpaid invoices: ${fmt(unpaidInvoicesTotal)} ${Math.abs(agingCheck - unpaidInvoicesTotal) < 0.01 ? '✓ OK' : '⚠ MISMATCH'}`);

  // AP Aging
  const apAging = { current: 0, days30: 0, days60: 0, days90: 0 };

  console.log('\n  AP Aging (by Due Date):');
  for (const bill of bills) {
    if (bill.status === 'paid' || bill.status === 'cancelled') continue;
    const dueDate = new Date(bill.dueDate);
    const daysPastDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
    const balance = bill.balanceDue || 0;

    if (daysPastDue <= 0) apAging.current += balance;
    else if (daysPastDue <= 30) apAging.days30 += balance;
    else if (daysPastDue <= 60) apAging.days60 += balance;
    else apAging.days90 += balance;
  }

  console.log(`    Current (not due):    ${fmt(apAging.current)}`);
  console.log(`    1-30 days overdue:    ${fmt(apAging.days30)}`);
  console.log(`    31-60 days overdue:   ${fmt(apAging.days60)}`);
  console.log(`    60+ days overdue:     ${fmt(apAging.days90)}`);
  console.log(`    Total Outstanding:    ${fmt(apAging.current + apAging.days30 + apAging.days60 + apAging.days90)}`);

  // ==========================================
  // SECTION 6: ENTITY COUNTS
  // ==========================================
  console.log('\n' + '─'.repeat(80));
  console.log('  SECTION 6: ENTITY COUNTS');
  console.log('─'.repeat(80));

  console.log(`\n    Departments:         ${departments.length}`);
  console.log(`    Employees:           ${employees.length}`);
  console.log(`    Customers:           ${customers.length}`);
  console.log(`    Vendors:             ${vendors.length}`);
  console.log(`    Invoices:            ${invoices.length}`);
  console.log(`    Payments Received:   ${paymentsReceived.length}`);
  console.log(`    Bills:               ${bills.length}`);
  console.log(`    Bill Payments:       ${billPayments.length}`);
  console.log(`    Expenses:            ${expenses.length}`);
  console.log(`    Chart of Accounts:   ${accounts.length}`);

  // ==========================================
  // SECTION 7: PAYROLL SUMMARY
  // ==========================================
  console.log('\n' + '─'.repeat(80));
  console.log('  SECTION 7: EMPLOYEE SALARY SUMMARY');
  console.log('─'.repeat(80));

  console.log('\n  Employee Salaries:');
  console.log('  ' + '-'.repeat(60));
  console.log(`  ${'Name'.padEnd(30)} ${'Department'.padEnd(20)} ${'Monthly'.padStart(12)}`);
  console.log('  ' + '-'.repeat(60));

  let totalMonthlySalary = 0;
  employees.sort((a, b) => (a.personalInfo?.lastName || '').localeCompare(b.personalInfo?.lastName || ''));

  for (const emp of employees) {
    const salary = emp.compensation?.monthlySalary || 0;
    totalMonthlySalary += salary;
    const name = `${emp.personalInfo?.firstName || ''} ${emp.personalInfo?.lastName || ''}`.trim();
    const dept = emp.jobDetails?.department || '';
    console.log(`  ${name.substring(0, 29).padEnd(30)} ${dept.substring(0, 19).padEnd(20)} ${fmt(salary)}`);
  }

  console.log('  ' + '-'.repeat(60));
  console.log(`  ${'TOTAL MONTHLY PAYROLL'.padEnd(30)} ${''.padEnd(20)} ${fmt(totalMonthlySalary)}`);
  console.log(`  ${'ANNUAL PAYROLL (x12)'.padEnd(30)} ${''.padEnd(20)} ${fmt(totalMonthlySalary * 12)}`);
  console.log(`  ${'WITH 13TH MONTH (x13)'.padEnd(30)} ${''.padEnd(20)} ${fmt(totalMonthlySalary * 13)}`);

  // ==========================================
  // FINAL SUMMARY
  // ==========================================
  console.log('\n' + '═'.repeat(80));
  console.log('  AUDIT SUMMARY');
  console.log('═'.repeat(80));

  const issues = [];

  if (Math.abs(totalOutstandingAR - calcOutstanding) > 0.01) {
    issues.push('AR balances do not match calculated values');
  }
  if (Math.abs(totalOutstandingAP - calcOutstandingAP) > 0.01) {
    issues.push('AP balances do not match calculated values');
  }
  if (Math.abs(totalPaidInvoices - totalPaymentsReceived) > 0.01) {
    issues.push('Invoice payments do not match payments_received');
  }
  if (Math.abs(totalPaidBills - totalBillPayments) > 0.01) {
    issues.push('Bill payments do not match bill_payments');
  }

  if (issues.length === 0) {
    console.log('\n  ✓ ALL CHECKS PASSED - Numbers are consistent');
  } else {
    console.log('\n  ⚠ ISSUES FOUND:');
    for (const issue of issues) {
      console.log(`    - ${issue}`);
    }
  }

  console.log('\n' + '═'.repeat(80));
  console.log('  END OF AUDIT REPORT');
  console.log('═'.repeat(80) + '\n');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
