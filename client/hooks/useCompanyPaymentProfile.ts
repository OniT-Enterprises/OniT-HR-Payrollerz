/**
 * Company identity + debit account for generated bank payment orders
 * (docs/BANK_PAYMENTS.md). Thin derivation over the canonical useSettings
 * query so every page agrees on which account pays.
 */
import { useSettings } from "@/hooks/useSettings";

export function useCompanyPaymentProfile() {
  const query = useSettings();

  const settings = query.data;
  const companyName =
    settings?.companyDetails?.legalName ||
    settings?.companyDetails?.tradingName ||
    "";
  const tin = settings?.companyDetails?.tinNumber || "";
  const employerNiss = settings?.companyDetails?.employerNiss || "";
  const activeAccounts = (settings?.paymentStructure?.bankAccounts ?? []).filter(
    (account) => account.isActive && Boolean(account.accountNumber?.trim()),
  );
  const debitAccount =
    (activeAccounts.find((account) => account.purpose === "payroll") || activeAccounts[0])
      ?.accountNumber || "";

  return { ...query, companyName, tin, employerNiss, debitAccount };
}
