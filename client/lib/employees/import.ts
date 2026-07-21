import { roundMoney } from "@/lib/currency";
import type { Employee } from "@/services/employeeService";

export interface EmployeeCSVMapping {
  csvColumn: string;
  employeeField: string;
}

export interface EmployeeImportOptions {
  batchId: string;
  today: string;
}

export interface EmployeeImportError {
  rowNumber: number;
  messages: string[];
}

export interface EmployeeImportResult {
  employees: Array<{ rowNumber: number; employee: Omit<Employee, "id"> }>;
  errors: EmployeeImportError[];
}

function mappedValue(
  row: Record<string, string>,
  mappings: EmployeeCSVMapping[],
  field: string,
): string {
  const mapping = mappings.find((item) => item.employeeField === field);
  return mapping ? String(row[mapping.csvColumn] ?? "").trim() : "";
}

function validISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeEmploymentType(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[ _]/g, "-");
  const values: Record<string, string> = {
    "": "Full-time",
    fulltime: "Full-time",
    "full-time": "Full-time",
    parttime: "Part-time",
    "part-time": "Part-time",
    contract: "Contractor",
    contractor: "Contractor",
    temporary: "Temporary",
    intern: "Intern",
    shareholder: "Shareholder",
  };
  return values[normalized] || value.trim();
}

function parseOptionalMoney(value: string, label: string, errors: string[]): number {
  if (!value) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    errors.push(`${label} must be a non-negative number`);
    return 0;
  }
  return roundMoney(parsed);
}

function parseOptionalWholeNumber(
  value: string,
  fallback: number,
  label: string,
  errors: string[],
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push(`${label} must be a non-negative whole number`);
    return fallback;
  }
  return parsed;
}

/**
 * Validate and convert mapped CSV rows before any Firestore writes occur.
 * The mapper is intentionally strict on identity/job fields so a bulk import
 * cannot create employees that payroll cannot identify or assign.
 */
export function buildEmployeesFromCSV(
  rows: Record<string, string>[],
  mappings: EmployeeCSVMapping[],
  options: EmployeeImportOptions,
): EmployeeImportResult {
  const employees: EmployeeImportResult["employees"] = [];
  const errors: EmployeeImportError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // Header is row 1.
    const rowErrors: string[] = [];
    const firstName = mappedValue(row, mappings, "firstName");
    const lastName = mappedValue(row, mappings, "lastName");
    const email = mappedValue(row, mappings, "email");
    const department = mappedValue(row, mappings, "department");
    const position = mappedValue(row, mappings, "position");
    const hireDate = mappedValue(row, mappings, "hireDate") || options.today;
    const employmentType = normalizeEmploymentType(
      mappedValue(row, mappings, "employmentType"),
    );

    if (!firstName) rowErrors.push("First name is required");
    if (!lastName) rowErrors.push("Last name is required");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      rowErrors.push("A valid email is required");
    }
    if (!department) rowErrors.push("Department is required");
    if (!position) rowErrors.push("Job title/position is required");
    if (!validISODate(hireDate)) rowErrors.push("Hire date must use YYYY-MM-DD");

    const salary = parseOptionalMoney(
      mappedValue(row, mappings, "monthlySalary"),
      "Monthly salary",
      rowErrors,
    );
    const annualLeaveDays = parseOptionalWholeNumber(
      mappedValue(row, mappings, "annualLeaveDays"),
      12,
      "Annual leave days",
      rowErrors,
    );
    const contractedHoursText = mappedValue(
      row,
      mappings,
      "contractedWeeklyHours",
    );
    const contractedWeeklyHours = contractedHoursText
      ? Number(contractedHoursText)
      : undefined;
    const minimumWageTreatment = mappedValue(
      row,
      mappings,
      "minimumWageTreatment",
    ) as "full_floor" | "pro_rata" | "reviewed_exception" | "";

    if (employmentType === "Part-time") {
      if (
        contractedWeeklyHours === undefined ||
        !Number.isFinite(contractedWeeklyHours) ||
        contractedWeeklyHours <= 0 ||
        contractedWeeklyHours > 44
      ) {
        rowErrors.push("Part-time contracted hours must be between 1 and 44");
      }
      if (
        !["full_floor", "pro_rata", "reviewed_exception"].includes(
          minimumWageTreatment,
        )
      ) {
        rowErrors.push("Part-time minimum-wage treatment is required");
      }
    }

    const dateOfBirth = mappedValue(row, mappings, "dateOfBirth");
    if (dateOfBirth && !validISODate(dateOfBirth)) {
      rowErrors.push("Date of birth must use YYYY-MM-DD");
    }

    if (rowErrors.length) {
      errors.push({ rowNumber, messages: rowErrors });
      return;
    }

    const nationality = mappedValue(row, mappings, "nationality") || "Timor-Leste";
    const isTimorese = nationality.toLowerCase() === "timor-leste";
    const employeeIdCard = mappedValue(row, mappings, "employeeIdCard");
    const explicitEmployeeId = mappedValue(row, mappings, "employeeId");
    const employeeId =
      explicitEmployeeId ||
      employeeIdCard ||
      `TEMP-${options.batchId}-${rowNumber}`;
    const socialSecurityNumber = mappedValue(
      row,
      mappings,
      "socialSecurityNumber",
    );

    employees.push({
      rowNumber,
      employee: {
        personalInfo: {
          firstName,
          lastName,
          email,
          phone: mappedValue(row, mappings, "phone"),
          phoneApp: "",
          appEligible: false,
          address: mappedValue(row, mappings, "address"),
          dateOfBirth,
          socialSecurityNumber,
          emergencyContactName: mappedValue(
            row,
            mappings,
            "emergencyContactName",
          ),
          emergencyContactPhone: mappedValue(
            row,
            mappings,
            "emergencyContactPhone",
          ),
        },
        jobDetails: {
          employeeId,
          department,
          position,
          hireDate,
          employmentType,
          ...(employmentType === "Part-time"
            ? {
                contractedWeeklyHours,
                minimumWageTreatment: minimumWageTreatment || undefined,
              }
            : { contractedWeeklyHours: 44, minimumWageTreatment: "full_floor" }),
          workLocation: mappedValue(row, mappings, "workLocation") || "Office",
          manager: mappedValue(row, mappings, "manager"),
          projectCode: mappedValue(row, mappings, "projectCode"),
          fundingSource: mappedValue(row, mappings, "fundingSource"),
        },
        compensation: {
          monthlySalary: salary,
          annualLeaveDays,
          benefitsPackage:
            mappedValue(row, mappings, "benefitsPackage") || "standard",
          payFrequency: "monthly",
          isResident: isTimorese,
        },
        documents: {
          bilheteIdentidade: {
            number: isTimorese ? employeeIdCard : "",
            expiryDate: mappedValue(row, mappings, "employeeIdExpiryDate"),
            required: isTimorese,
          },
          employeeIdCard: {
            number: employeeIdCard,
            expiryDate: mappedValue(row, mappings, "employeeIdExpiryDate"),
            required: isTimorese,
          },
          socialSecurityNumber: {
            number: socialSecurityNumber,
            expiryDate: mappedValue(row, mappings, "ssnExpiryDate"),
            required: true,
          },
          taxIdentificationNumber: {
            number: mappedValue(row, mappings, "taxIdentificationNumber"),
            expiryDate: "",
            required: false,
          },
          electoralCard: {
            number: mappedValue(row, mappings, "electoralCardNumber"),
            expiryDate: mappedValue(row, mappings, "electoralCardExpiryDate"),
            required: false,
          },
          idCard: {
            number: mappedValue(row, mappings, "idCardNumber"),
            expiryDate: mappedValue(row, mappings, "idCardExpiryDate"),
            required: false,
          },
          passport: {
            number: mappedValue(row, mappings, "passportNumber"),
            expiryDate: mappedValue(row, mappings, "passportExpiryDate"),
            required: !isTimorese,
          },
          workContract: { fileUrl: "", uploadDate: options.today },
          nationality,
          residencyStatus: isTimorese ? "timorese" : "foreign_worker",
          workingVisaResidency: { number: "", expiryDate: "", fileUrl: "" },
        },
        isForeignWorker: !isTimorese,
        status: "active",
      },
    });
  });

  return { employees, errors };
}
