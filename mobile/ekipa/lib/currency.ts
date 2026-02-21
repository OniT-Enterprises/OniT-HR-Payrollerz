/**
 * Currency formatting helper for Ekipa surfaces.
 * Defaults to USD until tenant-specific currency is introduced.
 */

type AppLanguage = 'tet' | 'en' | 'pt' | 'id';

const LOCALE_BY_LANGUAGE: Record<AppLanguage, string> = {
  tet: 'pt-PT',
  en: 'en-US',
  pt: 'pt-PT',
  id: 'id-ID',
};

export function formatCurrency(
  amount: number,
  language: AppLanguage,
  currency: string = 'USD'
): string {
  try {
    return new Intl.NumberFormat(LOCALE_BY_LANGUAGE[language], {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
