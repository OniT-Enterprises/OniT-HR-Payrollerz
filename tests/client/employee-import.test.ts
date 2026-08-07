import { describe, expect, it } from "vitest";
import { buildEmployeesFromCSV } from "@/lib/employees/import";

const mappings = [
  "firstName",
  "lastName",
  "email",
  "department",
  "position",
  "hireDate",
  "employmentType",
  "monthlySalary",
  "projectCode",
  "fundingSource",
  "contractedWeeklyHours",
  "minimumWageTreatment",
].map((field) => ({ csvColumn: field, employeeField: field }));

describe("employee CSV import", () => {
  it("creates payroll-ready employees with NGO dimensions and rounded money", () => {
    const result = buildEmployeesFromCSV(
      [
        {
          firstName: "Ana",
          lastName: "Soares",
          email: "ana@example.org",
          department: "Programs",
          position: "Officer",
          hireDate: "2026-01-10",
          employmentType: "Full-time",
          monthlySalary: "100.105",
          projectCode: " PRJ-1 ",
          fundingSource: " Donor A ",
        },
      ],
      mappings,
      { batchId: "batch", today: "2026-01-01" },
    );

    expect(result.errors).toEqual([]);
    expect(result.employees[0].employee.compensation.monthlySalary).toBe(100.11);
    expect(result.employees[0].employee.jobDetails).toMatchObject({
      employeeId: "TEMP-batch-2",
      projectCode: "PRJ-1",
      fundingSource: "Donor A",
      minimumWageTreatment: "full_floor",
    });
  });

  it("imports a cash worker with no email, department, or job title", () => {
    // The common Timor-Leste case: a security guard or driver with no email
    // address. This used to be rejected outright, which made the importer
    // unusable for the businesses Xefe is built for.
    const result = buildEmployeesFromCSV(
      [
        {
          firstName: "João",
          lastName: "Guterres",
          email: "",
          department: "",
          position: "",
          hireDate: "2026-01-10",
          employmentType: "Full-time",
          monthlySalary: "115",
        },
      ],
      mappings,
      { batchId: "batch", today: "2026-01-01" },
    );

    expect(result.errors).toEqual([]);
    expect(result.employees).toHaveLength(1);
    expect(result.employees[0].employee.compensation.monthlySalary).toBe(115);
  });

  it("requires a monthly salary rather than silently importing zero", () => {
    const result = buildEmployeesFromCSV(
      [
        {
          firstName: "Ana",
          lastName: "Soares",
          hireDate: "2026-01-10",
          employmentType: "Full-time",
          monthlySalary: "",
        },
      ],
      mappings,
      { batchId: "batch", today: "2026-01-01" },
    );

    expect(result.employees).toEqual([]);
    expect(result.errors[0].messages).toContain("Monthly salary is required");
  });

  it("rejects invalid rows before writes and enforces part-time settings", () => {
    const result = buildEmployeesFromCSV(
      [
        {
          firstName: "",
          lastName: "Soares",
          email: "not-an-email",
          department: "Programs",
          position: "Officer",
          hireDate: "2026-02-30",
          employmentType: "Part-time",
          monthlySalary: "-1",
        },
      ],
      mappings,
      { batchId: "batch", today: "2026-01-01" },
    );

    expect(result.employees).toEqual([]);
    expect(result.errors[0].rowNumber).toBe(2);
    expect(result.errors[0].messages).toEqual(
      expect.arrayContaining([
        "First name is required",
        // Email is optional now (many TL workers have none), but a supplied
        // one must still be a valid address.
        "Email is not a valid address",
        "Hire date must use YYYY-MM-DD",
        "Monthly salary must be a non-negative number",
        "Part-time contracted hours must be between 1 and 44",
        "Part-time minimum-wage treatment is required",
      ]),
    );
  });
});
