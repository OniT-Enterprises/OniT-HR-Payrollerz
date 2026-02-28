import { describe, expect, it } from "vitest";
import {
  UNASSIGNED_ALLOCATION,
  createEmployeeAllocationMetaMap,
  extractDonorLines,
  summarizeDonorLines,
  summarizePayrollAllocations,
} from "@/lib/reports/ngoReporting";

describe("NGO reporting helpers", () => {
  it("normalizes employee allocation metadata", () => {
    const map = createEmployeeAllocationMetaMap([
      {
        id: "emp-1",
        jobDetails: {
          projectCode: "  PRJ-A  ",
          fundingSource: " ",
        },
      },
      {
        jobDetails: {
          projectCode: "PRJ-B",
          fundingSource: "FUND-2",
        },
      },
    ]);

    expect(map.size).toBe(1);
    expect(map.get("emp-1")).toEqual({
      projectCode: "PRJ-A",
      fundingSource: UNASSIGNED_ALLOCATION,
    });
  });

  it("builds payroll allocation rollups and flags unassigned records", () => {
    const employeeMeta = createEmployeeAllocationMetaMap([
      {
        id: "emp-1",
        jobDetails: { projectCode: "PRJ-A", fundingSource: "FUND-1" },
      },
      {
        id: "emp-2",
        jobDetails: { projectCode: "PRJ-B", fundingSource: "" },
      },
    ]);

    const rollup = summarizePayrollAllocations(
      [
        {
          employeeId: "emp-1",
          totalGrossPay: 1000,
          deductions: [],
          employerTaxes: [{ type: "inss_employer", description: "", amount: 60 }],
        },
        {
          employeeId: "emp-2",
          totalGrossPay: 500,
          deductions: [],
          employerTaxes: [{ type: "inss_employer", description: "", amount: 30 }],
        },
        {
          employeeId: "emp-3",
          totalGrossPay: 700,
          deductions: [],
          employerTaxes: [{ type: "inss_employer", description: "", amount: 42 }],
        },
      ],
      employeeMeta
    );

    expect(rollup.allocations).toEqual([
      {
        projectCode: "PRJ-A",
        fundingSource: "FUND-1",
        grossPay: 1000,
        inssEmployer: 60,
      },
      {
        projectCode: UNASSIGNED_ALLOCATION,
        fundingSource: UNASSIGNED_ALLOCATION,
        grossPay: 700,
        inssEmployer: 42,
      },
      {
        projectCode: "PRJ-B",
        fundingSource: UNASSIGNED_ALLOCATION,
        grossPay: 500,
        inssEmployer: 30,
      },
    ]);
    expect(rollup.unassignedEmployeeCount).toBe(2);
    expect(rollup.unassignedRecordCount).toBe(2);
    expect(rollup.unassignedGrossPay).toBe(1200);
  });

  it("extracts donor lines only from payroll expense accounts", () => {
    const lines = extractDonorLines([
      {
        date: "2026-01-25",
        entryNumber: "JE-2026-0001",
        source: "payroll",
        sourceId: "run-1",
        description: "Payroll Jan",
        lines: [
          {
            accountCode: "5110",
            accountName: "Salaries and Wages",
            projectId: "PRJ-A",
            departmentId: "FUND-1",
            debit: 1000,
            credit: 0,
            description: "Salary expense",
          },
          {
            accountCode: "5150",
            accountName: "INSS Employer Contribution",
            projectId: "",
            departmentId: "",
            debit: 60,
            credit: 0,
          },
          {
            accountCode: "2210",
            accountName: "Salaries Payable",
            debit: 0,
            credit: 1060,
          },
        ],
      },
      {
        date: "2026-01-26",
        entryNumber: "JE-2026-0002",
        source: "invoice",
        sourceId: "inv-1",
        description: "Invoice",
        lines: [
          {
            accountCode: "5110",
            accountName: "Salaries and Wages",
            debit: 10,
            credit: 0,
          },
        ],
      },
    ]);

    expect(lines).toEqual([
      {
        date: "2026-01-25",
        entryNumber: "JE-2026-0001",
        sourceId: "run-1",
        projectCode: "PRJ-A",
        fundingSource: "FUND-1",
        accountCode: "5110",
        accountName: "Salaries and Wages",
        debit: 1000,
        credit: 0,
        description: "Salary expense",
      },
      {
        date: "2026-01-25",
        entryNumber: "JE-2026-0001",
        sourceId: "run-1",
        projectCode: UNASSIGNED_ALLOCATION,
        fundingSource: UNASSIGNED_ALLOCATION,
        accountCode: "5150",
        accountName: "INSS Employer Contribution",
        debit: 60,
        credit: 0,
        description: "Payroll Jan",
      },
    ]);
  });

  it("summarizes donor lines by project and funding source", () => {
    const summary = summarizeDonorLines([
      {
        date: "2026-01-25",
        entryNumber: "JE-2026-0001",
        sourceId: "run-1",
        projectCode: "PRJ-A",
        fundingSource: "FUND-1",
        accountCode: "5110",
        accountName: "Salaries and Wages",
        debit: 1000,
        credit: 0,
        description: "",
      },
      {
        date: "2026-01-25",
        entryNumber: "JE-2026-0001",
        sourceId: "run-1",
        projectCode: "PRJ-A",
        fundingSource: "FUND-1",
        accountCode: "5150",
        accountName: "INSS Employer Contribution",
        debit: 60,
        credit: 0,
        description: "",
      },
      {
        date: "2026-01-25",
        entryNumber: "JE-2026-0001",
        sourceId: "run-1",
        projectCode: "PRJ-B",
        fundingSource: "FUND-2",
        accountCode: "5110",
        accountName: "Salaries and Wages",
        debit: 500,
        credit: 20,
        description: "",
      },
    ]);

    expect(summary).toEqual([
      {
        projectCode: "PRJ-A",
        fundingSource: "FUND-1",
        salaryExpense: 1000,
        inssEmployerExpense: 60,
        totalExpense: 1060,
      },
      {
        projectCode: "PRJ-B",
        fundingSource: "FUND-2",
        salaryExpense: 500,
        inssEmployerExpense: 0,
        totalExpense: 480,
      },
    ]);
  });
});
