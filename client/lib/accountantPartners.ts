export const ACCOUNTANT_PARTNER_STORAGE_KEY = "xefe:selected-accountant-partner";

export type AccountantPartnerId = "primos-boot";

export type AccountantPartnerConnectionStatus =
  | "selected"
  | "requested"
  | "accepted"
  | "connected"
  | "declined"
  | "cancelled"
  | "revoked";

export interface AccountantPartnerConnection {
  partnerId: AccountantPartnerId;
  partnerName: string;
  status: AccountantPartnerConnectionStatus;
  selectedBy?: string;
  selectedAt?: unknown;
  requestedBy?: string;
  requestedAt?: unknown;
  acceptedAt?: unknown;
  connectedAt?: unknown;
  accessUid?: string;
}

export interface AccountantPartner {
  id: AccountantPartnerId;
  tenantId: string;
  name: string;
  /** Hard launch gate. False keeps the partner visible without contacting it. */
  connectionsOpen: boolean;
  website: string;
  email: string;
  phone: string;
  location: string;
  established: number;
  logoDarkText: string;
  logoLightText: string;
  mark: string;
}

/**
 * The partnership is NOT signed yet (2026-07-18): the firm's real name, logo,
 * and contact details must not appear anywhere public until the agreement is
 * in place. The internal ids stay stable so stored selections/connections
 * survive the announcement — when it is signed, restore the identity fields
 * here, the partner logo assets under public/images/partners/, and the
 * partner-name strings in the three locales (grep "partner firm" /
 * "firma parceira" / "firma parseira").
 */
export const PRIMOS_BOOT_PARTNER: AccountantPartner = {
  id: "primos-boot",
  tenantId: "primos-boot",
  name: "Xefe partner accounting firm",
  connectionsOpen: false,
  website: "",
  email: "",
  phone: "",
  location: "Dili",
  established: 0,
  logoDarkText: "",
  logoLightText: "",
  mark: "",
};

export const ACCOUNTANT_PARTNERS = [PRIMOS_BOOT_PARTNER] as const;

export function getAccountantPartner(
  value: string | null | undefined,
): AccountantPartner | null {
  if (!value) return null;
  return ACCOUNTANT_PARTNERS.find((partner) => partner.id === value) ?? null;
}

export function rememberAccountantPartner(partnerId: AccountantPartnerId): void {
  try {
    localStorage.setItem(ACCOUNTANT_PARTNER_STORAGE_KEY, partnerId);
  } catch {
    // Storage can be unavailable in private browsing. The URL parameter still
    // carries the choice through the immediate signup path.
  }
}

export function readRememberedAccountantPartner(): AccountantPartner | null {
  try {
    return getAccountantPartner(localStorage.getItem(ACCOUNTANT_PARTNER_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function forgetAccountantPartner(): void {
  try {
    localStorage.removeItem(ACCOUNTANT_PARTNER_STORAGE_KEY);
  } catch {
    // Nothing else to clear.
  }
}

export function isAccountantPartnerTenant(tenantId: string | null | undefined): boolean {
  return ACCOUNTANT_PARTNERS.some((partner) => partner.tenantId === tenantId);
}
