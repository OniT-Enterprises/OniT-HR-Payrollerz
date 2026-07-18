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

export const PRIMOS_BOOT_PARTNER: AccountantPartner = {
  id: "primos-boot",
  tenantId: "primos-boot",
  name: "Primos Bo'ot",
  connectionsOpen: false,
  website: "https://primosboot.com",
  email: "info@primosboot.com",
  phone: "+670 7831 8131",
  location: "Torreto Building, 6th Floor, Dili",
  established: 2013,
  logoDarkText: "/images/partners/primos-boot-logo-dark-text.png",
  logoLightText: "/images/partners/primos-boot-logo-light-text.png",
  mark: "/images/partners/primos-boot-mark.png",
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
