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
  // Short trading name for a bank credit description, which BNU truncates —
  // see formatAttlCreditDescription in client/lib/tlBanking.ts.
  const shortName =
    settings?.companyDetails?.tradingName ||
    settings?.companyDetails?.legalName ||
    "";
  const incomeTaxInstallmentFrequency =
    settings?.companyDetails?.incomeTaxInstallmentFrequency;
  const employerNiss = settings?.companyDetails?.employerNiss || "";
  const activeAccounts = (settings?.paymentStructure?.bankAccounts ?? []).filter(
    (account) => account.isActive && Boolean(account.accountNumber?.trim()),
  );
  const debitAccount =
    (activeAccounts.find((account) => account.purpose === "payroll") || activeAccounts[0])
      ?.accountNumber || "";

  return {
    ...query,
    companyName,
    shortName,
    tin,
    employerNiss,
    debitAccount,
    incomeTaxInstallmentFrequency,
  };
}
