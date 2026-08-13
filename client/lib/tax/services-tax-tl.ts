/**
 * Timor-Leste domestic services tax under Law 8/2008, Arts. 5-8 and Annex I.
 *
 * Only hotel, restaurant/bar, and telecommunications receipts are designated
 * services. The monthly rate is 0% below $500 and 5% on all designated-service
 * receipts once the combined monthly total reaches $500.
 */

import { applyRate, roundMoney, sumMoney } from "@/lib/currency";

export const TL_SERVICES_TAX_THRESHOLD = 500;
export const TL_SERVICES_TAX_RATE = 0.05;

export interface TLDesignatedServiceReceipts {
  hotelServices: number;
  restaurantBarServices: number;
  telecommunicationsServices: number;
}

export interface TLServicesTaxResult {
  receipts: TLDesignatedServiceReceipts;
  totalDesignatedReceipts: number;
  rate: number;
  taxByService: TLDesignatedServiceReceipts;
  taxDue: number;
  legalBasis: string;
}

function validateReceipt(name: string, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(
      `${name} receipts must be a non-negative finite amount.`,
    );
  }
  return roundMoney(amount);
}

/**
 * Business sectors (client/types/settings.ts BusinessSector) whose customer
 * receipts are designated services under Law 8/2008 Annex I.
 */
export const TL_SERVICES_TAX_LIABLE_SECTORS = [
  'hotel',
  'restaurant',
  'telecommunications',
] as const;

export function isTLServicesTaxLiableSector(
  sector: string | undefined | null,
): sector is (typeof TL_SERVICES_TAX_LIABLE_SECTORS)[number] {
  return (
    typeof sector === 'string' &&
    (TL_SERVICES_TAX_LIABLE_SECTORS as readonly string[]).includes(sector)
  );
}

/**
 * Map a liable tenant's monthly customer RECEIPTS total onto the designated-
 * service bucket its sector indicates. Law 8/2008 Sec. 9 taxes consideration
 * RECEIVED (cash basis) — callers must pass payments received in the month,
 * not invoiced/accrued revenue. Non-liable sectors map to all zeros.
 *
 * The whole receipts total is mapped only after the tenant explicitly confirms
 * that ALL customer receipts are designated services. Sector alone is not
 * enough: a mixed hotel/retail or restaurant/catering business would otherwise
 * pay 5% on unrelated receipts. Manual mode therefore fails closed to zero and
 * the filing UI tells the operator to enter/review Section 3 themselves.
 */
export function mapSectorReceiptsToDesignatedServices(
  sector: string | undefined | null,
  monthlyReceiptsTotal: number,
  receiptMode: 'manual' | 'all_designated' | undefined = 'manual',
): TLDesignatedServiceReceipts {
  const receipts: TLDesignatedServiceReceipts = {
    hotelServices: 0,
    restaurantBarServices: 0,
    telecommunicationsServices: 0,
  };
  const total = validateReceipt('Designated-service', monthlyReceiptsTotal);
  if (
    !isTLServicesTaxLiableSector(sector) ||
    receiptMode !== 'all_designated'
  ) return receipts;
  if (sector === 'hotel') {
    receipts.hotelServices = total;
  } else if (sector === 'restaurant') {
    receipts.restaurantBarServices = total;
  } else {
    receipts.telecommunicationsServices = total;
  }
  return receipts;
}

/** Calculate one month's domestic services tax without inferring service type. */
export function calculateTLServicesTax(
  input: TLDesignatedServiceReceipts,
): TLServicesTaxResult {
  const receipts: TLDesignatedServiceReceipts = {
    hotelServices: validateReceipt("Hotel-service", input.hotelServices),
    restaurantBarServices: validateReceipt(
      "Restaurant/bar-service",
      input.restaurantBarServices,
    ),
    telecommunicationsServices: validateReceipt(
      "Telecommunications-service",
      input.telecommunicationsServices,
    ),
  };
  const totalDesignatedReceipts = sumMoney(Object.values(receipts));
  const rate =
    totalDesignatedReceipts >= TL_SERVICES_TAX_THRESHOLD
      ? TL_SERVICES_TAX_RATE
      : 0;
  const taxByService: TLDesignatedServiceReceipts = {
    hotelServices: applyRate(receipts.hotelServices, rate),
    restaurantBarServices: applyRate(receipts.restaurantBarServices, rate),
    telecommunicationsServices: applyRate(
      receipts.telecommunicationsServices,
      rate,
    ),
  };

  return {
    receipts,
    totalDesignatedReceipts,
    rate,
    taxByService,
    taxDue: applyRate(totalDesignatedReceipts, rate),
    legalBasis: "Law 8/2008 Arts. 5-8 and Annex I",
  };
}
