import { Timestamp } from 'firebase/firestore';

type UnknownRecord = Record<string, unknown>;

export interface NormalizedEmployeeDoc {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  nationalId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  department?: string;
  departmentId?: string;
  position?: string;
  positionId?: string;
  employmentType?: string;
  startDate?: string;
  status?: string;
  baseSalary?: number;
  currency?: string;
  documents?: Array<{
    name: string;
    type: string;
    url?: string;
    expiryDate?: string;
    status?: string;
  }>;
  photoUrl?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  qrCode?: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function asDateString(value: unknown): string | undefined {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString().split('T')[0];
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return asString(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const next = asString(value);
    if (next) return next;
  }
  return '';
}

function optionalString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const next = asString(value);
    if (next) return next;
  }
  return undefined;
}

function humanizeDocumentKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeDocuments(raw: unknown): NormalizedEmployeeDoc['documents'] {
  if (Array.isArray(raw)) {
    return raw
      .filter(isRecord)
      .map((item) => ({
        name: firstString(item.name, item.type, 'Document'),
        type: firstString(item.type, item.name, 'document'),
        url: optionalString(item.url, item.fileUrl),
        expiryDate: asDateString(item.expiryDate),
        status: optionalString(item.status),
      }));
  }

  if (!isRecord(raw)) return [];

  return Object.entries(raw)
    .filter(([, value]) => isRecord(value))
    .map(([key, value]) => {
      const docValue = asRecord(value);
      return {
        name: humanizeDocumentKey(key),
        type: key,
        url: optionalString(docValue.url, docValue.fileUrl),
        expiryDate: asDateString(docValue.expiryDate),
        status: optionalString(docValue.status),
      };
    });
}

export function sortByEmployeeName<T extends { firstName: string; lastName: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const left = `${a.firstName} ${a.lastName}`.trim().toLowerCase();
    const right = `${b.firstName} ${b.lastName}`.trim().toLowerCase();
    return left.localeCompare(right);
  });
}

export function normalizeEmployeeDoc(id: string, raw: unknown): NormalizedEmployeeDoc {
  const data = asRecord(raw);
  const personalInfo = asRecord(data.personalInfo);
  const jobDetails = asRecord(data.jobDetails);
  const compensation = asRecord(data.compensation);
  const fullName = firstString(data.name);
  const fullNameParts = fullName ? fullName.split(/\s+/) : [];

  return {
    id,
    firstName: firstString(data.firstName, personalInfo.firstName, fullNameParts[0]),
    lastName: firstString(
      data.lastName,
      personalInfo.lastName,
      fullNameParts.slice(1).join(' ')
    ),
    email: firstString(data.email, personalInfo.email),
    phone: optionalString(data.phone, personalInfo.phone, personalInfo.phoneApp),
    dateOfBirth: asDateString(data.dateOfBirth ?? personalInfo.dateOfBirth),
    gender: optionalString(data.gender, personalInfo.gender),
    address: optionalString(data.address, personalInfo.address),
    nationalId: optionalString(data.nationalId, personalInfo.socialSecurityNumber),
    emergencyContactName: optionalString(
      data.emergencyContactName,
      personalInfo.emergencyContactName
    ),
    emergencyContactPhone: optionalString(
      data.emergencyContactPhone,
      personalInfo.emergencyContactPhone
    ),
    department: optionalString(data.department, jobDetails.department),
    departmentId: optionalString(data.departmentId),
    position: optionalString(data.position, jobDetails.position),
    positionId: optionalString(data.positionId),
    employmentType: optionalString(data.employmentType, jobDetails.employmentType),
    startDate: asDateString(data.startDate ?? jobDetails.hireDate),
    status: optionalString(data.status) || 'active',
    baseSalary: asNumber(data.baseSalary) ?? asNumber(compensation.monthlySalary),
    currency: optionalString(data.currency) || 'USD',
    documents: normalizeDocuments(data.documents),
    photoUrl: optionalString(data.photoUrl),
    bankAccountName: optionalString(data.bankAccountName, data.bankName),
    bankAccountNumber: optionalString(data.bankAccountNumber),
    qrCode: optionalString(data.qrCode, jobDetails.employeeId, id),
  };
}
