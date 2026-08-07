import { describe, expect, it } from "vitest";
import {
  EMPLOYEE_CSV_TEMPLATE_COLUMNS,
  buildEmployeesFromCSV,
  buildEmployeesFromPositionalCSV,
} from "@/lib/employees/import";

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

/**
 * The Employees page reads the downloaded template by COLUMN POSITION and has
 * no mapper. It used to build Employees itself, and drifted from the rules
 * above twice: hire dates stored verbatim (a RangeError inside
 * calculateSubsidioAnual) and, later, salary cents truncated with annual leave
 * granted at 25 days instead of Art. 32's 12. These tests pin the positional
 * wrapper to the SAME rules.
 */
describe("positional employee CSV template", () => {
  const options = { batchId: "batch", today: "2026-01-01" };

  /** Build a template row from field name -> value, so tests don't count commas. */
  const templateRow = (values: Record<string, string>): string[] =>
    EMPLOYEE_CSV_TEMPLATE_COLUMNS.map((field) => values[field] ?? "");

  it("keeps the template column order the file contract depends on", () => {
    // Customers already hold downloaded templates. Columns may be APPENDED;
    // reordering silently re-reads their spreadsheets as different fields.
    expect(EMPLOYEE_CSV_TEMPLATE_COLUMNS.slice(0, 20)).toEqual([
      "employeeId",
      "firstName",
      "lastName",
      "email",
      "phone",
      "department",
      "position",
      "hireDate",
      "employmentType",
      "workLocation",
      "monthlySalary",
      "benefitsPackage",
      "addressStreet",
      "addressCity",
      "addressState",
      "addressPostalCode",
      "emergencyContactName",
      "emergencyContactPhone",
      "dateOfBirth",
      "status",
    ]);
  });

  it("imports a template row, joining the address parts", () => {
    const result = buildEmployeesFromPositionalCSV(
      [
        templateRow({
          employeeId: "EMP001",
          firstName: "Ana",
          lastName: "Soares",
          department: "Operations",
          position: "Driver",
          hireDate: "2026-01-10",
          employmentType: "Full-time",
          workLocation: "Office",
          monthlySalary: "850.75",
          addressStreet: "Rua 1",
          addressCity: "Dili",
          dateOfBirth: "1990-05-15",
          status: "active",
        }),
      ],
      options,
    );

    expect(result.errors).toEqual([]);
    const { employee } = result.employees[0];
    // parseInt used to truncate the cents here and default a blank to $0.
    expect(employee.compensation.monthlySalary).toBe(850.75);
    // Art. 32 is 12 working days. This path granted 25.
    expect(employee.compensation.annualLeaveDays).toBe(12);
    expect(employee.personalInfo.address).toBe("Rua 1, Dili");
    expect(employee.jobDetails.employeeId).toBe("EMP001");
    expect(employee.status).toBe("active");
  });

  it("rejects a non-ISO hire date instead of storing it verbatim", () => {
    const result = buildEmployeesFromPositionalCSV(
      [
        templateRow({
          firstName: "Ana",
          lastName: "Soares",
          hireDate: "15/01/2026",
          monthlySalary: "850",
        }),
      ],
      options,
    );

    expect(result.employees).toEqual([]);
    expect(result.errors[0].rowNumber).toBe(2);
    expect(result.errors[0].messages).toContain("Hire date must use YYYY-MM-DD");
  });

  it("requires a salary and reports the row rather than importing $0", () => {
    const result = buildEmployeesFromPositionalCSV(
      [templateRow({ firstName: "Ana", lastName: "Soares", hireDate: "2026-01-10" })],
      options,
    );

    expect(result.employees).toEqual([]);
    expect(result.errors[0].messages).toContain("Monthly salary is required");
  });

  it("refuses a part-timer whose hours and minimum-wage treatment are unknown", () => {
    // Payroll itself errors on this combination, so importing the person only
    // moves the failure to the middle of a payroll run.
    const result = buildEmployeesFromPositionalCSV(
      [
        templateRow({
          firstName: "Ana",
          lastName: "Soares",
          hireDate: "2026-01-10",
          employmentType: "Part-time",
          monthlySalary: "400",
        }),
      ],
      options,
    );

    expect(result.employees).toEqual([]);
    expect(result.errors[0].messages).toEqual(
      expect.arrayContaining([
        "Part-time contracted hours must be between 1 and 44",
        "Part-time minimum-wage treatment is required",
      ]),
    );
  });

  it("accepts a part-timer once the appended columns are filled in", () => {
    const result = buildEmployeesFromPositionalCSV(
      [
        templateRow({
          firstName: "Ana",
          lastName: "Soares",
          hireDate: "2026-01-10",
          employmentType: "Part-time",
          monthlySalary: "400",
          contractedWeeklyHours: "22",
          minimumWageTreatment: "pro_rata",
        }),
      ],
      options,
    );

    expect(result.errors).toEqual([]);
    expect(result.employees[0].employee.jobDetails).toMatchObject({
      contractedWeeklyHours: 22,
      minimumWageTreatment: "pro_rata",
    });
  });

  it("rejects an unrecognised status instead of writing it onto the record", () => {
    const result = buildEmployeesFromPositionalCSV(
      [
        templateRow({
          firstName: "Ana",
          lastName: "Soares",
          hireDate: "2026-01-10",
          monthlySalary: "850",
          status: "Ativu",
        }),
      ],
      options,
    );

    expect(result.employees).toEqual([]);
    expect(result.errors[0].messages).toContain(
      "Status must be active, inactive or terminated",
    );
  });

  it("defaults a blank status to active and blank hire date to today", () => {
    const result = buildEmployeesFromPositionalCSV(
      [templateRow({ firstName: "Ana", lastName: "Soares", monthlySalary: "850" })],
      options,
    );

    expect(result.errors).toEqual([]);
    expect(result.employees[0].employee.status).toBe("active");
    expect(result.employees[0].employee.jobDetails.hireDate).toBe("2026-01-01");
  });
});
