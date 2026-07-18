/**
 * De-identified firm payroll workpaper fixture.
 *
 * Provenance: 86 calculation rows from three completed payroll schedules in the
 * locally held accounting-mail corpus, matched row-for-row to the schedules'
 * source workbooks. Names, employers, identifiers, message metadata, dates, and
 * workbook hashes are intentionally excluded. These are worked calculations,
 * not evidence that Xefe processed a live payroll and not authority for a legal
 * rule.
 *
 * Input hours and the source hourly rate come from the matching workbooks.
 * Expected money outputs are the cent-displayed values sent in the emails; this
 * avoids treating hidden spreadsheet fractions of a cent as displayed amounts.
 *
 * Tuple fields, in order:
 * caseId, monthlySalary, absenceHours, overtimeHours, holidayHours,
 * absenceDays, sourceHourlyRate, annualSubsidy, expectedAbsenceDeduction,
 * expectedOvertimePay, resident, inssExempt, expectedGross, expectedWit,
 * expectedInssEmployee, expectedNet, expectedInssEmployer,
 * emailArithmeticStatus.
 */

export type FirmEmailArithmeticStatus =
  | 'exact'
  | 'source-rounding-within-0.02'
  | 'source-inconsistent';

type FirmPayrollTuple = readonly [
  caseId: string,
  monthlySalary: number,
  absenceHours: number,
  overtimeHours: number,
  holidayHours: number,
  absenceDays: number,
  sourceHourlyRate: number,
  annualSubsidy: number,
  expectedAbsenceDeduction: number,
  expectedOvertimePay: number,
  resident: boolean,
  inssExempt: boolean,
  expectedGross: number,
  expectedWit: number,
  expectedInssEmployee: number,
  expectedNet: number,
  expectedInssEmployer: number,
  emailArithmeticStatus: FirmEmailArithmeticStatus,
];

export interface DeidentifiedFirmPayrollCase {
  caseId: string;
  monthlySalary: number;
  absenceHours: number;
  overtimeHours: number;
  holidayHours: number;
  absenceDays: number;
  sourceHourlyRate: number;
  annualSubsidy: number;
  expectedAbsenceDeduction: number;
  expectedOvertimePay: number;
  resident: boolean;
  inssExempt: boolean;
  expectedGross: number;
  expectedWit: number;
  expectedInssEmployee: number;
  expectedNet: number;
  expectedInssEmployer: number;
  emailArithmeticStatus: FirmEmailArithmeticStatus;
}

const rows = [
  ["firm-period-1-01",130,0,7,5,0,0.69,0,0,14.15,true,false,144.15,0,5.2,138.95,7.8,"exact"],
  ["firm-period-1-02",130,24,7,5,0,0.69,0,16.56,14.15,true,false,127.59,0,4.54,123.05,6.81,"exact"],
  ["firm-period-1-03",250,0,29.5,0,0,1.32,0,0,58.41,true,false,308.41,0,10,298.41,15,"exact"],
  ["firm-period-1-04",130,0,29.75,0,0,0.69,0,0,30.79,true,false,160.79,0,5.2,155.59,7.8,"exact"],
  ["firm-period-1-05",120,7,55.75,0,0,0.64,0,4.48,53.52,true,false,169.04,0,4.62,164.42,6.93,"exact"],
  ["firm-period-1-06",550,0,16.25,0,0,2.9,0,0,70.69,true,false,620.69,12.07,22,586.62,33,"exact"],
  ["firm-period-1-07",140,0,10.5,0,0,0.74,0,0,11.66,true,false,151.66,0,5.6,146.06,8.4,"exact"],
  ["firm-period-1-08",120,7,5.75,0,0,0.64,0,4.48,5.52,true,false,121.04,0,4.62,116.42,6.93,"exact"],
  ["firm-period-1-09",120,7,14,0,0,0.64,0,4.48,13.44,true,false,128.96,0,4.62,124.34,6.93,"exact"],
  ["firm-period-1-10",200,7,15.75,0,0,1.06,0,7.42,25.04,true,false,217.62,0,7.7,209.92,11.55,"exact"],
  ["firm-period-1-11",200,0,58.5,0,0,1.06,0,0,93.02,true,false,293.02,0,8,285.02,12,"exact"],
  ["firm-period-1-12",120,14,14.75,0,0,0.64,0,8.96,14.16,true,false,125.2,0,4.44,120.76,6.66,"exact"],
  ["firm-period-1-13",600,0,7,5,0,3.16,0,0,64.78,true,false,664.78,16.48,24,624.3,36,"exact"],
  ["firm-period-1-14",140,0,20.25,0,0,0.74,0,0,22.48,true,false,162.48,0,5.6,156.88,8.4,"exact"],
  ["firm-period-1-15",200,0,9.75,0,0,1.06,0,0,15.5,true,false,215.5,0,8,207.5,12,"exact"],
  ["firm-period-1-16",120,7,12.75,0,0,0.64,0,4.48,12.24,true,false,127.76,0,4.62,123.14,6.93,"exact"],
  ["firm-period-1-17",120,0,22.5,0,0,0.64,0,0,21.6,true,false,141.6,0,4.8,136.8,7.2,"exact"],
  ["firm-period-1-18",120,7,10.75,0,0,0.64,0,4.48,10.32,true,false,125.84,0,4.62,121.22,6.93,"exact"],
  ["firm-period-1-19",140,0,13.25,0,0,0.74,0,0,14.71,true,false,154.71,0,5.6,149.11,8.4,"exact"],
  ["firm-period-1-20",120,0,7,5,0,0.64,0,0,13.12,true,false,133.12,0,4.8,128.32,7.2,"exact"],
  ["firm-period-1-21",250,0,25.25,0,0,1.32,0,0,50,true,false,300,0,10,290,15,"exact"],
  ["firm-period-1-22",400,0,12.75,0,0,2.11,0,0,40.35,true,false,440.35,0,16,424.35,24,"exact"],
  ["firm-period-1-23",120,8,7,5,0,0.64,0,5.12,13.12,true,false,128,0,4.6,123.4,6.89,"exact"],
  ["firm-period-1-24",120,0,7,5,0,0.64,0,0,13.12,true,false,133.12,0,4.8,128.32,7.2,"exact"],
  ["firm-period-1-25",120,0,11.25,0,0,0.64,0,0,10.8,true,false,130.8,0,4.8,126,7.2,"exact"],
  ["firm-period-1-26",120,7,8.25,0,0,0.64,0,4.48,7.92,true,false,123.44,0,4.62,118.82,6.93,"exact"],
  ["firm-period-1-27",120,0,12.25,0,0,0.64,0,0,11.76,true,false,131.76,0,4.8,126.96,7.2,"exact"],
  ["firm-period-1-28",130,183,5,0,0,0.69,0,126.27,5.18,true,false,8.9,0,0.15,8.76,0.22,"source-rounding-within-0.02"],
  ["firm-period-1-29",800,0,0,0,0,4.22,0,0,0,false,true,800,80,0,720,0,"exact"],
  ["firm-period-1-30",2375,0,0,0,0,12.5,0,0,0,false,true,2375,237.5,0,2137.5,0,"exact"],
  ["firm-period-2-01",130,16,0.5,0,0,0.69,0,11.04,0.52,true,false,119.48,0,4.76,114.72,7.14,"exact"],
  ["firm-period-2-02",150,12,0.5,0,0,0.79,0,9.48,0.59,true,false,141.11,0,5.62,135.49,8.43,"exact"],
  ["firm-period-2-03",250,0,3,24.5,0,1.32,0,0,70.62,true,false,320.62,0,10,310.62,15,"exact"],
  ["firm-period-2-04",160,0,1.5,7,0,0.85,0,0,13.81,true,false,173.81,0,6.4,167.41,9.6,"exact"],
  ["firm-period-2-05",150,29,4.5,31,0,0.79,0,22.91,54.31,true,false,181.4,0,5.08,176.32,7.63,"exact"],
  ["firm-period-2-06",700,12,0,0,0,3.69,0,44.28,0,true,false,655.72,15.57,26.23,613.92,39.34,"exact"],
  ["firm-period-2-07",175,0,1.5,0,0,0.93,0,0,2.09,true,false,177.09,0,7,170.09,10.5,"exact"],
  ["firm-period-2-08",120,15,0,31,0,0.64,0,9.6,39.68,true,false,150.08,0,4.42,145.66,6.62,"exact"],
  ["firm-period-2-09",200,13,0.5,31,0,1.06,0,13.78,66.52,true,false,252.74,0,7.45,245.29,11.17,"exact"],
  ["firm-period-2-10",250,0,6.5,31,0,1.32,0,0,94.71,true,false,344.71,0,10,334.71,15,"exact"],
  ["firm-period-2-11",120,0,0.75,7,0,0.64,0,0,9.68,true,false,129.68,0,4.8,124.88,7.2,"exact"],
  ["firm-period-2-12",700,34.5,0.5,0,0,3.69,0,127.31,2.77,true,false,575.46,7.55,22.91,545.01,34.36,"source-rounding-within-0.02"],
  ["firm-period-2-13",175,8,1,7,0,0.93,0,7.44,14.42,true,false,181.98,0,6.7,175.27,10.05,"source-rounding-within-0.02"],
  ["firm-period-2-14",180,0,0,10,0,0.95,0,0,19,true,false,199,0,7.2,191.8,10.8,"exact"],
  ["firm-period-2-15",150,0,3,24,0,0.79,0,0,41.48,true,false,191.48,0,6,185.48,9,"exact"],
  ["firm-period-2-16",150,0,0.75,7,0,0.79,0,0,11.95,true,false,161.95,0,6,155.95,9,"exact"],
  ["firm-period-2-17",120,17,0,0,0,0.64,0,10.88,0,true,false,109.12,0,4.36,104.76,6.55,"exact"],
  ["firm-period-2-18",175,0,2.5,31.5,0,0.93,0,0,62.08,true,false,237.08,0,7,230.08,10.5,"exact"],
  ["firm-period-2-19",150,0,0.5,0,0,0.79,0,0,0.59,true,false,150.59,0,6,144.59,9,"exact"],
  ["firm-period-2-20",250,3,3.5,24,0,1.32,0,3.96,70.29,true,false,316.33,0,9.84,306.49,14.76,"exact"],
  ["firm-period-2-21",400,0,3,0,0,2.11,0,0,9.5,true,false,409.5,0,16,393.5,24,"exact"],
  ["firm-period-2-22",120,8,0.5,0,0,0.64,0,5.12,0.48,true,false,115.36,0,4.6,110.76,6.89,"exact"],
  ["firm-period-2-23",120,8,1,0,0,0.64,0,5.12,0.96,true,false,115.84,0,4.6,111.24,6.89,"exact"],
  ["firm-period-2-24",120,24,0.5,0,0,0.64,0,15.36,0.48,true,false,105.12,0,4.19,100.93,6.28,"exact"],
  ["firm-period-2-25",120,0,3,7,0,0.64,0,0,11.84,true,false,131.84,0,4.8,127.04,7.2,"exact"],
  ["firm-period-2-26",120,0,0.5,0,0,0.64,0,0,0.48,true,false,120.48,0,4.8,115.68,7.2,"exact"],
  ["firm-period-2-27",800,0,0,31.5,0,4.22,0,0,265.86,false,true,1065.86,106.59,0,959.27,0,"source-inconsistent"],
  ["firm-period-2-28",2612.5,0,0,0,0,13.75,0,0,0,false,true,2612.5,261.25,0,2351.25,0,"source-inconsistent"],
  ["firm-period-3-01",130,8,7,24,0,0.69,68.77,5.52,40.37,true,false,233.62,0,7.73,225.89,11.6,"exact"],
  ["firm-period-3-02",150,8,12.5,24.5,0,0.79,150,6.32,53.52,true,false,347.2,0,11.75,335.46,17.62,"source-rounding-within-0.02"],
  ["firm-period-3-03",250,0,13,23.5,0,1.32,250,0,87.78,true,false,587.78,8.78,20,559,30,"exact"],
  ["firm-period-3-04",160,0,9,22,0,0.85,160,0,48.88,true,false,368.88,0,12.8,356.08,19.2,"exact"],
  ["firm-period-3-05",150,8,6,15,0,0.79,150,6.32,30.81,true,false,324.49,0,11.75,312.74,17.62,"exact"],
  ["firm-period-3-06",700,5,0,0,0,3.69,700,18.45,0,true,false,1381.55,88.16,55.26,1238.13,82.89,"exact"],
  ["firm-period-3-07",175,7,9.5,25.5,0,0.93,175,6.51,60.68,true,false,404.17,0,13.74,390.43,20.61,"exact"],
  ["firm-period-3-08",120,0,3,25,0,0.64,120,0,34.88,true,false,274.88,0,9.6,265.28,14.4,"exact"],
  ["firm-period-3-09",200,8,7.25,15,0,1.06,200,8.48,43.33,true,false,434.85,0,15.66,419.19,23.49,"exact"],
  ["firm-period-3-10",250,0,13.5,18.5,0,1.32,250,0,75.57,true,false,575.57,7.56,20,548.01,30,"exact"],
  ["firm-period-3-11",120,0,5.25,7,0,0.64,120,0,14,true,false,254,0,9.6,244.4,14.4,"exact"],
  ["firm-period-3-12",700,8,12.5,36,0,3.69,700,29.52,334.87,true,false,1705.35,120.53,54.82,1529.99,82.23,"source-rounding-within-0.02"],
  ["firm-period-3-13",175,0,6.75,22,0,0.93,175,0,50.34,true,false,400.34,0,14,386.34,21,"exact"],
  ["firm-period-3-14",180,8,9,22.5,0,0.95,52.71,7.6,55.58,true,false,280.69,0,9,271.68,13.51,"source-rounding-within-0.02"],
  ["firm-period-3-15",150,0,11,18,0,0.79,43.93,0,41.48,true,false,235.41,0,7.76,227.65,11.64,"exact"],
  ["firm-period-3-16",150,0,2.25,22.25,0,0.79,150,0,37.82,true,false,337.82,0,12,325.82,18,"exact"],
  ["firm-period-3-17",120,7,3.5,25.25,0,0.64,120,4.48,35.68,true,false,271.2,0,9.42,261.78,14.13,"exact"],
  ["firm-period-3-18",175,7,6.25,22.5,0,0.93,175,6.51,50.57,true,false,394.06,0,13.74,380.32,20.61,"exact"],
  ["firm-period-3-19",150,8,11.5,24.5,0,0.79,150,6.32,52.34,true,false,346.02,0,11.75,334.27,17.62,"exact"],
  ["firm-period-3-20",250,0,15.5,23.5,1,1.32,250,0,92.73,true,false,584.39,8.44,19.67,556.28,29.5,"source-inconsistent"],
  ["firm-period-3-21",400,0,17,12,0,2.11,266.67,0,104.45,true,false,771.12,27.11,26.67,717.34,40,"exact"],
  ["firm-period-3-22",120,0,12.5,33.25,0,0.64,73.83,0,54.56,true,false,248.39,0,7.75,240.64,11.63,"exact"],
  ["firm-period-3-23",120,4,8.5,24,0,0.64,73.83,2.56,38.88,true,false,230.15,0,7.65,222.5,11.48,"exact"],
  ["firm-period-3-24",120,6,12.5,32.5,0,0.64,57.42,3.84,53.6,true,false,227.18,0,6.94,220.24,10.41,"exact"],
  ["firm-period-3-25",120,7,8,9.5,0,0.64,57.42,4.48,19.84,true,false,192.78,0,6.92,185.86,10.38,"exact"],
  ["firm-period-3-26",120,9,12.5,19.5,0,0.64,57.42,5.76,36.96,true,false,208.62,0,6.87,201.75,10.3,"exact"],
  ["firm-period-3-27",800,0,0,22,0,4.22,707.15,0,185.68,false,true,1692.83,169.28,0,1523.55,0,"source-inconsistent"],
  ["firm-period-3-28",2612.5,0,11,18,0,13.75,2612.5,0,721.88,false,true,5946.88,594.69,0,5352.19,0,"source-inconsistent"],
] satisfies readonly FirmPayrollTuple[];

export const deidentifiedFirmPayrollCases: readonly DeidentifiedFirmPayrollCase[] =
  rows.map(([
    caseId,
    monthlySalary,
    absenceHours,
    overtimeHours,
    holidayHours,
    absenceDays,
    sourceHourlyRate,
    annualSubsidy,
    expectedAbsenceDeduction,
    expectedOvertimePay,
    resident,
    inssExempt,
    expectedGross,
    expectedWit,
    expectedInssEmployee,
    expectedNet,
    expectedInssEmployer,
    emailArithmeticStatus,
  ]) => ({
    caseId,
    monthlySalary,
    absenceHours,
    overtimeHours,
    holidayHours,
    absenceDays,
    sourceHourlyRate,
    annualSubsidy,
    expectedAbsenceDeduction,
    expectedOvertimePay,
    resident,
    inssExempt,
    expectedGross,
    expectedWit,
    expectedInssEmployee,
    expectedNet,
    expectedInssEmployer,
    emailArithmeticStatus,
  }));

