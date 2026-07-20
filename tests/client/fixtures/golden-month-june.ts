/**
 * Golden-month fixture - a single real Timor-Leste client-month (de-identified)
 * whose THREE government filings were recovered together and reconcile to the
 * cent: the payroll workbook, the INSS DR (declaracao de remuneracoes), and the
 * ATTL Consolidated Monthly Taxes Form (wage income tax) actually filed.
 *
 * De-identified per the corpus provenance policy: no names, TIN, NISS, or client
 * identity - only numeric figures (same class as deidentified-firm-payroll.ts).
 * The real->label mapping lives only in the gitignored mail-corpus mining dir.
 *
 * Modeling nuance this month proves: the INSS declared base is ORDINARY pay
 * (excludes OT / holiday / leave), while gross wages and WIT use full pay.
 */
export interface GoldenMonthEmployee {
  id: string;
  isResident: boolean;
  filedOrdinary: number;
  filedOvertime: number;
  filedHoliday: number;
  filedAnnualLeave: number;
  filedGross: number;
  filedInssBase: number;
  filedInssEmployee: number;
  filedInssEmployer: number;
  filedWit: number;
  filedNet: number;
}

export const GOLDEN_MONTH_PERIOD = "2024-06";

export const goldenMonthEmployees: GoldenMonthEmployee[] = [
  { id: "EMP-01", isResident: false, filedOrdinary: 500.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 500.0, filedInssBase: 500.0, filedInssEmployee: 20.0, filedInssEmployer: 30.0, filedWit: 50.0, filedNet: 430.0 },
  { id: "EMP-02", isResident: false, filedOrdinary: 500.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 500.0, filedInssBase: 500.0, filedInssEmployee: 20.0, filedInssEmployer: 30.0, filedWit: 50.0, filedNet: 430.0 },
  { id: "EMP-03", isResident: true, filedOrdinary: 158.0, filedOvertime: 11.42, filedHoliday: 12.33, filedAnnualLeave: 0.0, filedGross: 182.0, filedInssBase: 158.0, filedInssEmployee: 6.32, filedInssEmployer: 9.48, filedWit: 0.0, filedNet: 175.68 },
  { id: "EMP-04", isResident: false, filedOrdinary: 500.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 500.0, filedInssBase: 500.0, filedInssEmployee: 20.0, filedInssEmployer: 30.0, filedWit: 50.0, filedNet: 430.0 },
  { id: "EMP-05", isResident: true, filedOrdinary: 150.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 150.0, filedInssBase: 150.0, filedInssEmployee: 6.0, filedInssEmployer: 9.0, filedWit: 0.0, filedNet: 144.0 },
  { id: "EMP-06", isResident: true, filedOrdinary: 150.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 150.0, filedInssBase: 150.0, filedInssEmployee: 6.0, filedInssEmployer: 9.0, filedWit: 0.0, filedNet: 144.0 },
  { id: "EMP-07", isResident: true, filedOrdinary: 135.16, filedOvertime: 22.79, filedHoliday: 4.84, filedAnnualLeave: 0.0, filedGross: 162.79, filedInssBase: 135.16, filedInssEmployee: 5.41, filedInssEmployer: 8.11, filedWit: 0.0, filedNet: 157.38 },
  { id: "EMP-08", isResident: true, filedOrdinary: 200.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 200.0, filedInssBase: 200.0, filedInssEmployee: 8.0, filedInssEmployer: 12.0, filedWit: 0.0, filedNet: 192.0 },
  { id: "EMP-09", isResident: true, filedOrdinary: 149.33, filedOvertime: 19.14, filedHoliday: 10.67, filedAnnualLeave: 0.0, filedGross: 179.14, filedInssBase: 149.33, filedInssEmployee: 5.97, filedInssEmployer: 8.96, filedWit: 0.0, filedNet: 173.17 },
  { id: "EMP-10", isResident: true, filedOrdinary: 172.5, filedOvertime: 80.08, filedHoliday: 7.5, filedAnnualLeave: 20.0, filedGross: 280.08, filedInssBase: 172.5, filedInssEmployee: 6.9, filedInssEmployer: 10.35, filedWit: 0.0, filedNet: 273.18 },
  { id: "EMP-11", isResident: true, filedOrdinary: 193.33, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 7.0, filedGross: 200.0, filedInssBase: 193.33, filedInssEmployee: 7.73, filedInssEmployer: 11.6, filedWit: 0.0, filedNet: 192.27 },
  { id: "EMP-12", isResident: true, filedOrdinary: 140.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 140.0, filedInssBase: 140.0, filedInssEmployee: 5.6, filedInssEmployer: 8.4, filedWit: 0.0, filedNet: 134.4 },
  { id: "EMP-13", isResident: true, filedOrdinary: 138.87, filedOvertime: 14.1, filedHoliday: 5.13, filedAnnualLeave: 16.0, filedGross: 174.1, filedInssBase: 138.87, filedInssEmployee: 5.55, filedInssEmployer: 8.33, filedWit: 0.0, filedNet: 168.55 },
  { id: "EMP-14", isResident: true, filedOrdinary: 350.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 350.0, filedInssBase: 350.0, filedInssEmployee: 14.0, filedInssEmployer: 21.0, filedWit: 0.0, filedNet: 336.0 },
  { id: "EMP-15", isResident: false, filedOrdinary: 500.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 500.0, filedInssBase: 500.0, filedInssEmployee: 20.0, filedInssEmployer: 30.0, filedWit: 50.0, filedNet: 430.0 },
  { id: "EMP-16", isResident: false, filedOrdinary: 500.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 500.0, filedInssBase: 500.0, filedInssEmployee: 20.0, filedInssEmployer: 30.0, filedWit: 50.0, filedNet: 430.0 },
  { id: "EMP-17", isResident: true, filedOrdinary: 145.19, filedOvertime: 19.97, filedHoliday: 4.81, filedAnnualLeave: 0.0, filedGross: 169.97, filedInssBase: 145.19, filedInssEmployee: 5.81, filedInssEmployer: 8.71, filedWit: 0.0, filedNet: 164.16 },
  { id: "EMP-18", isResident: false, filedOrdinary: 500.0, filedOvertime: 0.0, filedHoliday: 0.0, filedAnnualLeave: 0.0, filedGross: 500.0, filedInssBase: 500.0, filedInssEmployee: 20.0, filedInssEmployer: 30.0, filedWit: 50.0, filedNet: 430.0 },
  { id: "EMP-19", isResident: true, filedOrdinary: 142.31, filedOvertime: 0.0, filedHoliday: 7.69, filedAnnualLeave: 0.0, filedGross: 150.0, filedInssBase: 142.31, filedInssEmployee: 5.69, filedInssEmployer: 8.54, filedWit: 0.0, filedNet: 144.31 },
];

/** Totals exactly as they appear on the filed DR and ATTL form for this month. */
export const FILED_TOTALS = {
  workers: 19,
  grossWages: 5488.08,
  witWithheld: 300.0,
  netPay: 4979.1,
  inssDeclaredBase: 5224.69,
  inssEmployee: 208.98,
  inssEmployer: 313.48,
} as const;
