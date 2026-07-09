/**
 * Contract template fill helpers.
 * Templates can contain {{token}} placeholders (e.g. {{employee.fullName}});
 * tokens are replaced deterministically from the employee/company data.
 * Dotted blanks ("......") in scanned templates are handled by the AI quick
 * fill path (contractQuickFill cloud function), not here.
 */

export interface ContractFillData {
  employee: Record<string, string>;
  company: Record<string, string>;
  contract: Record<string, string>;
}

export interface ContractFillResult {
  text: string;
  /** Tokens present in the template with no matching value */
  missing: string[];
  /** Number of tokens replaced */
  replaced: number;
}

/** Tokens documented for template authors (shown in the admin console). */
export const CONTRACT_PLACEHOLDERS: { token: string; example: string }[] = [
  { token: "employee.fullName", example: "Maria dos Santos" },
  { token: "employee.firstName", example: "Maria" },
  { token: "employee.lastName", example: "dos Santos" },
  { token: "employee.email", example: "maria@company.tl" },
  { token: "employee.phone", example: "+670 7712 3456" },
  { token: "employee.address", example: "Rua de Motael, Dili" },
  { token: "employee.dateOfBirth", example: "12/03/1995" },
  { token: "employee.nationality", example: "Timor-Leste" },
  { token: "employee.biNumber", example: "BI 0012345" },
  { token: "employee.passportNumber", example: "P1234567" },
  { token: "employee.inssNumber", example: "100123456" },
  { token: "employee.jobTitle", example: "Operations Supervisor" },
  { token: "employee.department", example: "Operations" },
  { token: "employee.manager", example: "João Pereira" },
  { token: "employee.startDate", example: "01/08/2026" },
  { token: "employee.employmentType", example: "Full-time" },
  { token: "employee.monthlySalary", example: "650" },
  { token: "employee.annualLeaveDays", example: "12" },
  { token: "employee.bankName", example: "BNCTL" },
  { token: "employee.bankAccountNumber", example: "123-456-789" },
  { token: "company.name", example: "Acme Unipessoal LDA" },
  { token: "company.tin", example: "1234567" },
  { token: "company.address", example: "Av. de Portugal, Dili" },
  { token: "company.phone", example: "+670 331 2345" },
  { token: "company.email", example: "info@acme.tl" },
  { token: "contract.date", example: "09/07/2026" },
];

function toDisplayDate(value: string): string {
  // Form dates are yyyy-mm-dd; contracts in TL use dd/mm/yyyy
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Flatten fill data into a case-insensitive token → value lookup */
function buildTokenMap(data: ContractFillData): Map<string, string> {
  const map = new Map<string, string>();
  for (const [scope, values] of Object.entries(data)) {
    for (const [key, raw] of Object.entries(values as Record<string, string>)) {
      const value = (raw ?? "").toString().trim();
      if (!value) continue;
      map.set(`${scope}.${key}`.toLowerCase(), value);
    }
  }
  return map;
}

/** Replace {{token}} placeholders in template text with data values. */
export function fillTemplateTokens(
  templateText: string,
  data: ContractFillData,
): ContractFillResult {
  const tokens = buildTokenMap(data);
  const missing = new Set<string>();
  let replaced = 0;

  const text = templateText.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (whole, token: string) => {
      const value = tokens.get(token.toLowerCase());
      if (value === undefined) {
        missing.add(token);
        return whole;
      }
      replaced += 1;
      return value;
    },
  );

  return { text, missing: Array.from(missing), replaced };
}

interface EmployeeFormSnapshot {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  department?: string;
  jobTitle?: string;
  manager?: string;
  startDate?: string;
  employmentType?: string;
  salary?: string;
  leaveDays?: string;
}

interface DocValuesSnapshot {
  [key: string]: { number: string; expiryDate: string } | undefined;
}

interface AdditionalInfoSnapshot {
  nationality?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

export interface CompanyDetailsSnapshot {
  legalName?: string;
  tradingName?: string;
  tinNumber?: string;
  registeredAddress?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
}

/** Assemble fill data from the AddEmployee wizard state + tenant company details. */
export function buildContractFillData(params: {
  form: EmployeeFormSnapshot;
  docValues: DocValuesSnapshot;
  additionalInfo: AdditionalInfoSnapshot;
  company?: CompanyDetailsSnapshot | null;
}): ContractFillData {
  const { form, docValues, additionalInfo, company } = params;
  const fullName = [form.firstName, form.lastName].filter(Boolean).join(" ");
  const companyAddress = [
    company?.registeredAddress,
    company?.city,
    company?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    employee: {
      fullName,
      firstName: form.firstName || "",
      lastName: form.lastName || "",
      email: form.email || "",
      phone: form.phone || "",
      address: form.address || "",
      dateOfBirth: toDisplayDate(form.dateOfBirth || ""),
      nationality: additionalInfo.nationality || "",
      biNumber: docValues.bilheteIdentidade?.number || "",
      passportNumber: docValues.passport?.number || "",
      inssNumber: docValues.socialSecurityNumber?.number || "",
      jobTitle: form.jobTitle || "",
      department: form.department || "",
      manager: form.manager || "",
      startDate: toDisplayDate(form.startDate || ""),
      employmentType: form.employmentType || "",
      monthlySalary: form.salary || "",
      annualLeaveDays: form.leaveDays || "",
      bankName: additionalInfo.bankName || "",
      bankAccountNumber: additionalInfo.bankAccountNumber || "",
    },
    company: {
      name: company?.legalName || company?.tradingName || "",
      tradingName: company?.tradingName || "",
      tin: company?.tinNumber || "",
      address: companyAddress,
      phone: company?.phone || "",
      email: company?.email || "",
    },
    contract: {
      date: toDisplayDate(new Date().toISOString().slice(0, 10)),
    },
  };
}
