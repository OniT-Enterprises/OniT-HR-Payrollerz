/**
 * De-identified single-month firm payroll snapshot for the through-the-UI
 * replay (tests/e2e/month-replay.spec.ts).
 *
 * Six real base-salary rows drawn from the mail-corpus workpapers, spanning
 * below the $500/month WIT threshold ($150 -> no tax) up to $2,151.40. Each is
 * a plain monthly salary with no absence, overtime, or allowances, so the run
 * total is a clean function of salary. Names and employers are excluded; only
 * salaries and the firm's own computed gross/WIT/employee-INSS remain.
 *
 * The replay enters these salaries through the real payroll wizard and asserts
 * the run's aggregate matches the firm to the cent. Xefe's aggregate net is
 * gross - WIT - INSS; the firm's schedules add a post-tax bank "salary fee"
 * that Xefe (correctly) does not model, so net is asserted on Xefe's identity.
 */
export interface FirmMonthEmployee {
  ref: string;
  monthlySalary: number;
  firmGross: number;
  firmWit: number;
  firmInssEmployee: number;
}

export const firmMonthEmployees: readonly FirmMonthEmployee[] = [
  { ref: "emp-01", monthlySalary: 150.0, firmGross: 150.0, firmWit: 0.0, firmInssEmployee: 6.0 },
  { ref: "emp-02", monthlySalary: 409.21, firmGross: 409.21, firmWit: 0.0, firmInssEmployee: 16.37 },
  { ref: "emp-03", monthlySalary: 562.07, firmGross: 562.07, firmWit: 6.21, firmInssEmployee: 22.48 },
  { ref: "emp-04", monthlySalary: 1045.79, firmGross: 1045.79, firmWit: 54.58, firmInssEmployee: 41.83 },
  { ref: "emp-05", monthlySalary: 1979.58, firmGross: 1979.58, firmWit: 147.96, firmInssEmployee: 79.18 },
  { ref: "emp-06", monthlySalary: 2151.4, firmGross: 2151.4, firmWit: 165.14, firmInssEmployee: 86.06 },
];

export const firmMonthExpectedTotals = {
  gross: 6298.05,
  wit: 373.89,
  inssEmployee: 251.92,
  net: 5672.24,
} as const;
