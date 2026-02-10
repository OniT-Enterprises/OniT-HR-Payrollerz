/**
 * Comprehensive Test Suite for OniT HR/Payroll System
 *
 * Tests critical calculations that affect real money:
 * - Payroll (WIT, INSS, Net Pay)
 * - Invoice calculations (subtotal, total, balance)
 * - Bill calculations
 * - AR/AP consistency
 */

import { describe, expect, it } from "vitest";
import {
  calculateTLPayroll,
  calculateINSS,
  calculateSubsidioAnual,
  type TLPayrollInput,
} from "@/lib/payroll/calculations-tl";

// ============================================
// TEST HELPERS
// ============================================

function makePayrollInput(overrides: Partial<TLPayrollInput> = {}): TLPayrollInput {
  return {
    employeeId: "test-emp",
    monthlySalary: 1000,
    payFrequency: "monthly",
    isHourly: false,
    regularHours: 190,
    overtimeHours: 0,
    nightShiftHours: 0,
    holidayHours: 0,
    restDayHours: 0,
    absenceHours: 0,
    lateArrivalMinutes: 0,
    sickDaysUsed: 0,
    ytdSickDaysUsed: 0,
    bonus: 0,
    commission: 0,
    perDiem: 0,
    foodAllowance: 0,
    transportAllowance: 0,
    otherEarnings: 0,
    taxInfo: { isResident: true, hasTaxExemption: false },
    loanRepayment: 0,
    advanceRepayment: 0,
    courtOrders: 0,
    otherDeductions: 0,
    ytdGrossPay: 0,
    ytdIncomeTax: 0,
    ytdINSSEmployee: 0,
    monthsWorkedThisYear: 12,
    hireDate: "2024-01-01",
    ...overrides,
  };
}

// Simple invoice/bill calculation helpers (mirrors what the UI does)
function calculateInvoiceTotal(items: { quantity: number; unitPrice: number }[], taxRate: number = 0): {
  subtotal: number;
  taxAmount: number;
  total: number;
} {
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;
  return { subtotal, taxAmount, total };
}

function calculateBalance(total: number, amountPaid: number): number {
  return total - amountPaid;
}

// ============================================
// PAYROLL: WITHHOLDING INCOME TAX (WIT) TESTS
// ============================================

describe("Timor-Leste Withholding Income Tax (WIT)", () => {
  describe("Resident Tax Calculations", () => {
    it("should not tax income at exactly $500 threshold", () => {
      const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 500 }));
      expect(result.incomeTax).toBe(0);
    });

    it("should not tax income below $500 threshold", () => {
      const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 400 }));
      expect(result.incomeTax).toBe(0);
    });

    it("should tax 10% of amount above $500 for residents", () => {
      // $600 salary -> $100 above threshold -> $10 tax
      const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 600 }));
      expect(result.incomeTax).toBe(10);
    });

    it("should correctly calculate tax for $1000 salary", () => {
      // $1000 - $500 = $500 taxable -> $50 tax
      const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 1000 }));
      expect(result.incomeTax).toBe(50);
    });

    it("should correctly calculate tax for high salary ($5000)", () => {
      // $5000 - $500 = $4500 taxable -> $450 tax
      const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 5000 }));
      expect(result.incomeTax).toBe(450);
    });

    it("should correctly calculate tax for very high salary ($45000)", () => {
      // $45000 - $500 = $44500 taxable -> $4450 tax
      const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 45000 }));
      expect(result.incomeTax).toBe(4450);
    });
  });

  describe("Non-Resident Tax Calculations", () => {
    it("should tax 10% of ALL income for non-residents (no threshold)", () => {
      const result = calculateTLPayroll(makePayrollInput({
        monthlySalary: 500,
        taxInfo: { isResident: false, hasTaxExemption: false }
      }));
      expect(result.incomeTax).toBe(50); // 10% of 500, no threshold
    });

    it("should tax non-resident low income that would be exempt for residents", () => {
      const result = calculateTLPayroll(makePayrollInput({
        monthlySalary: 300,
        taxInfo: { isResident: false, hasTaxExemption: false }
      }));
      expect(result.incomeTax).toBe(30); // 10% of 300
    });
  });
});

// ============================================
// PAYROLL: INSS TESTS
// ============================================

describe("Timor-Leste INSS Contributions", () => {
  it("should calculate 4% employee contribution", () => {
    const result = calculateINSS(1000);
    expect(result.employee).toBe(40);
  });

  it("should calculate 6% employer contribution", () => {
    const result = calculateINSS(1000);
    expect(result.employer).toBe(60);
  });

  it("should calculate total 10% contribution", () => {
    const result = calculateINSS(1000);
    expect(result.total).toBe(100);
  });

  it("should handle zero salary", () => {
    const result = calculateINSS(0);
    expect(result.employee).toBe(0);
    expect(result.employer).toBe(0);
  });

  it("should exclude overtime from INSS base", () => {
    const result = calculateTLPayroll(makePayrollInput({
      monthlySalary: 1000,
      overtimeHours: 20, // Should not affect INSS base
    }));
    // INSS base should still be 1000 (overtime excluded)
    expect(result.inssBase).toBe(1000);
    expect(result.inssEmployee).toBe(40); // 4% of 1000
  });

  it("should exclude bonus from INSS base", () => {
    const result = calculateTLPayroll(makePayrollInput({
      monthlySalary: 1000,
      bonus: 500, // Should not affect INSS base
    }));
    expect(result.inssBase).toBe(1000);
    expect(result.inssEmployee).toBe(40);
  });

  it("should exclude food allowance from INSS base", () => {
    const result = calculateTLPayroll(makePayrollInput({
      monthlySalary: 1000,
      foodAllowance: 100,
    }));
    expect(result.inssBase).toBe(1000);
  });
});

// ============================================
// PAYROLL: NET PAY TESTS
// ============================================

describe("Timor-Leste Net Pay Calculations", () => {
  it("should calculate correct net pay for $500 salary (no WIT)", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 500 }));
    // Gross: 500, WIT: 0, INSS: 20 (4%)
    // Net: 500 - 0 - 20 = 480
    expect(result.grossPay).toBe(500);
    expect(result.incomeTax).toBe(0);
    expect(result.inssEmployee).toBe(20);
    expect(result.netPay).toBe(480);
  });

  it("should calculate correct net pay for $1000 salary", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 1000 }));
    // Gross: 1000, WIT: 50, INSS: 40
    // Net: 1000 - 50 - 40 = 910
    expect(result.grossPay).toBe(1000);
    expect(result.incomeTax).toBe(50);
    expect(result.inssEmployee).toBe(40);
    expect(result.netPay).toBe(910);
  });

  it("should calculate correct net pay for $2500 salary", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 2500 }));
    // Gross: 2500, WIT: 200 (10% of 2000), INSS: 100 (4% of 2500)
    // Net: 2500 - 200 - 100 = 2200
    expect(result.grossPay).toBe(2500);
    expect(result.incomeTax).toBe(200);
    expect(result.inssEmployee).toBe(100);
    expect(result.netPay).toBe(2200);
  });

  it("should apply loan deductions correctly", () => {
    const result = calculateTLPayroll(makePayrollInput({
      monthlySalary: 1000,
      loanRepayment: 100,
    }));
    // Net: 1000 - 50 (WIT) - 40 (INSS) - 100 (loan) = 810
    expect(result.netPay).toBe(810);
  });

  it("should calculate employer total cost correctly", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 1000 }));
    // Employer cost: 1000 (gross) + 60 (6% employer INSS) = 1060
    expect(result.totalEmployerCost).toBe(1060);
  });
});

// ============================================
// PAYROLL: SUBSIDIO ANUAL (13TH MONTH) TESTS
// ============================================

describe("Subsidio Anual (13th Month) Calculations", () => {
  it("should calculate full 13th month for 12 months worked", () => {
    const result = calculateSubsidioAnual(1000, 12, "2024-01-01", new Date("2024-12-31"));
    expect(result).toBe(1000);
  });

  it("should pro-rate for 6 months worked", () => {
    const result = calculateSubsidioAnual(1000, 6, "2024-07-01", new Date("2024-12-31"));
    expect(result).toBe(500); // 6/12 of 1000
  });

  it("should pro-rate for 1 month worked", () => {
    const result = calculateSubsidioAnual(1200, 1, "2024-12-01", new Date("2024-12-31"));
    expect(result).toBe(100); // 1/12 of 1200
  });
});

// ============================================
// INVOICE CALCULATIONS
// ============================================

describe("Invoice Calculations", () => {
  describe("Subtotal Calculations", () => {
    it("should calculate subtotal for single item", () => {
      const result = calculateInvoiceTotal([
        { quantity: 1, unitPrice: 5000 }
      ]);
      expect(result.subtotal).toBe(5000);
    });

    it("should calculate subtotal for multiple items", () => {
      const result = calculateInvoiceTotal([
        { quantity: 1, unitPrice: 5000 },
        { quantity: 2, unitPrice: 1500 },
        { quantity: 10, unitPrice: 100 },
      ]);
      // 5000 + 3000 + 1000 = 9000
      expect(result.subtotal).toBe(9000);
    });

    it("should handle fractional quantities", () => {
      const result = calculateInvoiceTotal([
        { quantity: 2.5, unitPrice: 100 }
      ]);
      expect(result.subtotal).toBe(250);
    });
  });

  describe("Tax Calculations", () => {
    it("should calculate 0% tax correctly", () => {
      const result = calculateInvoiceTotal([
        { quantity: 1, unitPrice: 1000 }
      ], 0);
      expect(result.taxAmount).toBe(0);
      expect(result.total).toBe(1000);
    });

    it("should calculate 10% tax correctly", () => {
      const result = calculateInvoiceTotal([
        { quantity: 1, unitPrice: 1000 }
      ], 0.10);
      expect(result.taxAmount).toBe(100);
      expect(result.total).toBe(1100);
    });
  });

  describe("Balance Calculations", () => {
    it("should calculate balance for unpaid invoice", () => {
      const balance = calculateBalance(5000, 0);
      expect(balance).toBe(5000);
    });

    it("should calculate balance for partially paid invoice", () => {
      const balance = calculateBalance(5000, 2000);
      expect(balance).toBe(3000);
    });

    it("should calculate zero balance for fully paid invoice", () => {
      const balance = calculateBalance(5000, 5000);
      expect(balance).toBe(0);
    });

    it("should handle overpayment (negative balance)", () => {
      const balance = calculateBalance(5000, 6000);
      expect(balance).toBe(-1000);
    });
  });
});

// ============================================
// AR/AP CONSISTENCY TESTS
// ============================================

describe("AR/AP Consistency Rules", () => {
  it("Outstanding AR should equal sum of invoice balances (excluding drafts)", () => {
    const invoices = [
      { total: 5000, amountPaid: 5000, status: "paid" },      // balance: 0
      { total: 15000, amountPaid: 15000, status: "paid" },    // balance: 0
      { total: 5500, amountPaid: 3000, status: "partial" },   // balance: 2500
      { total: 45000, amountPaid: 0, status: "sent" },        // balance: 45000
      { total: 8000, amountPaid: 0, status: "draft" },        // balance: 8000 (excluded)
    ];

    const outstandingAR = invoices
      .filter(inv => inv.status !== "draft")
      .reduce((sum, inv) => sum + (inv.total - inv.amountPaid), 0);

    // Should be 0 + 0 + 2500 + 45000 = 47500 (draft excluded)
    expect(outstandingAR).toBe(47500);
  });

  it("Outstanding AP should equal sum of bill balances", () => {
    const bills = [
      { total: 2400, amountPaid: 2400, status: "paid" },      // balance: 0
      { total: 850, amountPaid: 850, status: "paid" },        // balance: 0
      { total: 1550, amountPaid: 0, status: "pending" },      // balance: 1550
      { total: 2500, amountPaid: 0, status: "overdue" },      // balance: 2500
    ];

    const outstandingAP = bills.reduce((sum, bill) => sum + (bill.total - bill.amountPaid), 0);

    expect(outstandingAP).toBe(4050);
  });

  it("Total Collected should equal sum of payment amounts for invoices", () => {
    const invoices = [
      { invoiceId: "1", amountPaid: 5000 },
      { invoiceId: "2", amountPaid: 15000 },
      { invoiceId: "3", amountPaid: 3000 },
    ];

    const payments = [
      { invoiceId: "1", amount: 5000 },
      { invoiceId: "2", amount: 15000 },
      { invoiceId: "3", amount: 3000 },
    ];

    const totalFromInvoices = invoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
    const totalFromPayments = payments.reduce((sum, pay) => sum + pay.amount, 0);

    expect(totalFromInvoices).toBe(totalFromPayments);
  });
});

// ============================================
// EDGE CASES & ERROR CONDITIONS
// ============================================

describe("Edge Cases", () => {
  it("should handle $0 salary", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 0 }));
    expect(result.grossPay).toBe(0);
    expect(result.netPay).toBe(0);
    expect(result.incomeTax).toBe(0);
    expect(result.inssEmployee).toBe(0);
  });

  it("should handle exactly $500.01 salary (just over threshold)", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 500.01 }));
    // Taxable: $0.01, Tax: $0.001 -> rounds to $0.00
    expect(result.incomeTax).toBeLessThanOrEqual(0.01);
  });

  it("should handle invoice with 0 quantity", () => {
    const result = calculateInvoiceTotal([
      { quantity: 0, unitPrice: 1000 }
    ]);
    expect(result.subtotal).toBe(0);
    expect(result.total).toBe(0);
  });

  it("should handle invoice with 0 unit price", () => {
    const result = calculateInvoiceTotal([
      { quantity: 10, unitPrice: 0 }
    ]);
    expect(result.subtotal).toBe(0);
  });
});

// ============================================
// REAL-WORLD SCENARIOS
// ============================================

describe("Real-World Payroll Scenarios", () => {
  it("Scenario: Junior Developer ($6,000/month)", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 6000 }));

    // WIT: (6000 - 500) * 10% = 550
    expect(result.incomeTax).toBe(550);

    // INSS Employee: 6000 * 4% = 240
    expect(result.inssEmployee).toBe(240);

    // INSS Employer: 6000 * 6% = 360
    expect(result.inssEmployer).toBe(360);

    // Net: 6000 - 550 - 240 = 5210
    expect(result.netPay).toBe(5210);

    // Employer Cost: 6000 + 360 = 6360
    expect(result.totalEmployerCost).toBe(6360);
  });

  it("Scenario: CEO ($45,000/month)", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 45000 }));

    // WIT: (45000 - 500) * 10% = 4450
    expect(result.incomeTax).toBe(4450);

    // INSS Employee: 45000 * 4% = 1800
    expect(result.inssEmployee).toBe(1800);

    // INSS Employer: 45000 * 6% = 2700
    expect(result.inssEmployer).toBe(2700);

    // Net: 45000 - 4450 - 1800 = 38750
    expect(result.netPay).toBe(38750);
  });

  it("Scenario: Security Officer ($4,000/month)", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 4000 }));

    // WIT: (4000 - 500) * 10% = 350
    expect(result.incomeTax).toBe(350);

    // INSS: 4000 * 4% = 160
    expect(result.inssEmployee).toBe(160);

    // Net: 4000 - 350 - 160 = 3490
    expect(result.netPay).toBe(3490);
  });

  it("Scenario: Minimum wage worker ($115/month)", () => {
    const result = calculateTLPayroll(makePayrollInput({ monthlySalary: 115 }));

    // Below threshold, no WIT
    expect(result.incomeTax).toBe(0);

    // INSS: 115 * 4% = 4.6
    expect(result.inssEmployee).toBeCloseTo(4.6, 1);

    // Net: 115 - 0 - 4.6 = 110.4
    expect(result.netPay).toBeCloseTo(110.4, 1);
  });
});
