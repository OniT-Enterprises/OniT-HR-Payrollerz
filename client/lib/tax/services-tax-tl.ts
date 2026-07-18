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
