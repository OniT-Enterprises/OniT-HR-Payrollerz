/** Domestic ATTL tax-clearance request tracking (Certidão de Dívidas). */

export const ATTL_ETAX_URL = 'https://e-tax.mof.gov.tl/login';
export const ATTL_TAX_CLEARANCE_GUIDE_URL =
  'https://attl.gov.tl/uncategorized/etax-guideline/';

export type TaxClearancePurpose =
  | 'commercial_3_months'
  | 'commercial_1_month'
  | 'visa_3_months'
  | 'visa_1_month';

export type TaxClearanceStoredStatus = 'requested' | 'issued' | 'rejected';
export type TaxClearanceDisplayStatus = TaxClearanceStoredStatus | 'expired';

export interface TaxClearanceRequest {
  id: string;
  purpose: TaxClearancePurpose;
  requestedDate: string;
  status: TaxClearanceStoredStatus;
  issuedDate?: string;
  expiryDate?: string;
  certificateNumber?: string;
  certificateUrl?: string;
  rejectionReason?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt: Date;
}

export interface TaxClearanceRequestInput {
  purpose: TaxClearancePurpose;
  requestedDate: string;
  notes?: string;
}

export interface TaxClearanceIssuedInput {
  issuedDate: string;
  expiryDate: string;
  certificateNumber?: string;
  certificateUrl: string;
}

export const TAX_CLEARANCE_PURPOSES: readonly TaxClearancePurpose[] = [
  'commercial_3_months',
  'commercial_1_month',
  'visa_3_months',
  'visa_1_month',
] as const;

function parseISODate(value: string, label: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} must use YYYY-MM-DD format.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`${label} is not a valid calendar date.`);
  }
  return value;
}

export function validateTaxClearanceRequest(
  input: TaxClearanceRequestInput,
): TaxClearanceRequestInput {
  if (!TAX_CLEARANCE_PURPOSES.includes(input.purpose)) {
    throw new Error('Select an official ATTL tax-clearance document type.');
  }
  const requestedDate = parseISODate(input.requestedDate, 'Request date');
  const notes = input.notes?.trim();
  return {
    purpose: input.purpose,
    requestedDate,
    ...(notes ? { notes } : {}),
  };
}

export function validateTaxClearanceIssued(
  request: Pick<TaxClearanceRequest, 'requestedDate'>,
  input: TaxClearanceIssuedInput,
): TaxClearanceIssuedInput {
  const issuedDate = parseISODate(input.issuedDate, 'Issue date');
  const expiryDate = parseISODate(input.expiryDate, 'Expiry date');
  if (issuedDate < request.requestedDate) {
    throw new Error('Issue date cannot be before the request date.');
  }
  if (expiryDate <= issuedDate) {
    throw new Error('Expiry date must be after the issue date.');
  }
  const certificateUrl = input.certificateUrl.trim();
  if (!certificateUrl) {
    throw new Error('Upload the ATTL certificate PDF before marking it issued.');
  }
  const certificateNumber = input.certificateNumber?.trim();
  return {
    issuedDate,
    expiryDate,
    certificateUrl,
    ...(certificateNumber ? { certificateNumber } : {}),
  };
}

export function getTaxClearanceDisplayStatus(
  request: Pick<TaxClearanceRequest, 'status' | 'expiryDate'>,
  today: string,
): TaxClearanceDisplayStatus {
  parseISODate(today, 'Today');
  if (request.status === 'issued') {
    if (!request.expiryDate) {
      throw new Error('An issued tax-clearance record is missing its expiry date.');
    }
    parseISODate(request.expiryDate, 'Expiry date');
    if (request.expiryDate < today) return 'expired';
  }
  return request.status;
}

export function needsTaxClearanceOneMonthCoordination(purpose: TaxClearancePurpose): boolean {
  return purpose === 'commercial_1_month' || purpose === 'visa_1_month';
}
