export type AgingBucketKey =
  | "current"
  | "days30"
  | "days60"
  | "days90"
  | "days90Plus";

/** Canonical inclusive boundaries for receivable and payable aging. */
export function getAgingBucketKey(daysPastDue: number): AgingBucketKey {
  if (daysPastDue <= 0) return "current";
  if (daysPastDue <= 30) return "days30";
  if (daysPastDue <= 60) return "days60";
  if (daysPastDue <= 90) return "days90";
  return "days90Plus";
}
