/** Strict readers for values used in ATTL and INSS statutory filings. */

export type TLStatutoryPayrollAmountField =
  | "grossWages"
  | "annualSubsidy"
  | "wagesPaid"
  | "witTaxableAmount"
  | "inssBase"
  | "incomeTax"
  | "inssEmployee"
  | "inssEmployer"
  | "netPay";

export interface TLStatutoryPayrollRecord {
  employeeId?: string;
  grossWages?: number;
  annualSubsidy?: number;
  wagesPaid?: number;
  witTaxableAmount?: number;
  inssBase?: number;
  incomeTax?: number;
  inssEmployee?: number;
  inssEmployer?: number;
  netPay?: number;
  isResident?: boolean;
}

export interface TLStatutoryEmployerSource {
  tinNumber?: string;
  legalName?: string;
  registeredAddress?: string;
}

export interface TLStatutoryEmployerIdentity {
  employerTIN: string;
  employerName: string;
  employerAddress: string;
}

export class MissingStatutoryPayrollDataError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(
      `Cannot generate a statutory filing because a paid payroll record has no valid ${field}. Reprocess or explicitly backfill the record; Xefe will not infer compliance values.`,
    );
    this.name = "MissingStatutoryPayrollDataError";
    this.field = field;
  }
}

export class MissingStatutorySourceDataError extends Error {
  readonly field: string;

  constructor(field: string) {
    super(
      `Cannot generate a statutory filing because its source data has no valid ${field}. Complete or explicitly backfill the record; Xefe will not substitute a blank or inferred value.`,
    );
    this.name = "MissingStatutorySourceDataError";
    this.field = field;
  }
}

/**
 * Non-throwing classifier for the strict-reader guards above. Normalo-facing
 * screens use it to degrade a failed filing generation into a "flag for
 * review" message (which record fact is missing) instead of a crash or a
 * generic error. It never makes generation proceed — Xefe still refuses to
 * infer compliance values; accountant screens keep surfacing the raw error.
 */
export function getStatutoryReviewFlag(
  error: unknown,
): { field: string } | null {
  if (
    error instanceof MissingStatutoryPayrollDataError ||
    error instanceof MissingStatutorySourceDataError
  ) {
    return { field: error.field };
  }
  return null;
}

export function requireStatutoryText(
  value: unknown,
  field: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new MissingStatutorySourceDataError(field);
  }
  return value.trim();
}

export function requireStatutoryISODate(
  value: unknown,
  field: string,
): string {
  const date = requireStatutoryText(value, field);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new MissingStatutorySourceDataError(field);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new MissingStatutorySourceDataError(field);
  }

  return date;
}

export function requireStatutoryEmployerIdentity(
  company: TLStatutoryEmployerSource,
): TLStatutoryEmployerIdentity {
  return {
    employerTIN: requireStatutoryText(company.tinNumber, "employer NIF/TIN"),
    employerName: requireStatutoryText(
      company.legalName,
      "employer legal name",
    ),
    employerAddress: requireStatutoryText(
      company.registeredAddress,
      "employer registered address",
    ),
  };
}

export function requireStatutoryPayrollAmount(
  record: TLStatutoryPayrollRecord,
  field: TLStatutoryPayrollAmountField,
): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new MissingStatutoryPayrollDataError(field);
  }
  return value;
}

export function requireStatutoryPayrollResidency(
  record: TLStatutoryPayrollRecord,
): boolean {
  if (typeof record.isResident !== "boolean") {
    throw new MissingStatutoryPayrollDataError("isResident");
  }
  return record.isResident;
}

export function requireStatutoryPayrollEmployeeId(
  record: TLStatutoryPayrollRecord,
): string {
  if (
    typeof record.employeeId !== "string" ||
    record.employeeId.trim().length === 0
  ) {
    throw new MissingStatutoryPayrollDataError("employeeId");
  }
  return record.employeeId;
}
