import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  onDocumentWritten,
  type FirestoreEvent,
  type Change,
  type DocumentSnapshot,
} from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  requireAuth,
  requireTenantManagerOrAdmin,
  requireTenantMember,
} from "./authz";

const db = getFirestore();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// How long a copy-week lock is trusted before a new run may take it over,
// so a crashed invocation cannot block the week forever.
const COPY_LOCK_TTL_MS = 5 * 60 * 1_000;

type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

interface LeaveRequestData {
  tenantId?: string;
  employeeId?: string;
  employeeName?: string;
  departmentId?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  halfDay?: boolean;
  halfDayType?: "morning" | "afternoon";
  reason?: string;
  status?: LeaveStatus;
}

export interface BalanceContribution {
  tenantId: string;
  employeeId: string;
  departmentId?: string;
  year: number;
  leaveType: string;
  pending: number;
  used: number;
}

interface BalanceItem {
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
}

interface ShiftInput {
  employeeId?: string;
  employeeName?: string;
  department?: string;
  departmentId?: string;
  position?: string;
  role?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  start?: string;
  end?: string;
  status?: string;
  location?: string;
  notes?: string;
  slotId?: string;
  createdBy?: string;
}

// Doubles as the validity whitelist for new requests (createLeaveRequest):
// bereavement/marriage are deliberately ABSENT so new requests of those types
// are rejected — Lei 4/2012 Art. 33(3) pools them into "special" (3 paid
// days/year for marriage + family death + community/religious events).
// Existing bereavement/marriage requests remain valid data and still render.
const DEFAULT_ENTITLEMENTS: Record<string, number> = {
  annual: 12,
  sick: 12,
  maternity: 84,
  paternity: 5,
  unpaid: 30,
  special: 3,
  study: 0,
  custom: 0,
};

const ANNOUNCED_VARIABLE_HOLIDAYS: Record<number, string[]> = {
  2026: ["2026-03-20", "2026-05-27"],
};

function parseDateISO(value: string): Date {
  if (!DATE_RE.test(value)) {
    throw new HttpsError("invalid-argument", "Dates must use YYYY-MM-DD");
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpsError("invalid-argument", "Invalid calendar date");
  }
  return date;
}

function formatDateISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDaysISO(value: string, days: number): string {
  const date = parseDateISO(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateISO(date);
}

function getEasterSundayUTC(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function getTLHolidayDates(year: number): string[] {
  const fixed = [
    "01-01", "03-03", "05-01", "05-20", "08-30", "11-01", "11-02",
    "11-03", "11-12", "11-28", "12-07", "12-08", "12-25", "12-31",
  ].map((monthDay) => `${year}-${monthDay}`);
  const easter = getEasterSundayUTC(year);
  const easterDate = (days: number) => formatDateISO(
    new Date(easter.getTime() + days * 24 * 60 * 60 * 1_000),
  );
  return [
    ...fixed,
    easterDate(-2),
    easterDate(60),
    ...(ANNOUNCED_VARIABLE_HOLIDAYS[year] ?? []),
  ];
}

async function getLeaveHolidayDates(
  tenantId: string,
  startDate: string,
  endDate: string,
): Promise<Set<string>> {
  const startYear = Number(startDate.slice(0, 4));
  const endYear = Number(endDate.slice(0, 4));
  const dates = new Set<string>();
  for (let year = startYear; year <= endYear; year += 1) {
    for (const date of getTLHolidayDates(year)) dates.add(date);
  }

  const overrides = await db.collection(`tenants/${tenantId}/holidays`).get();
  for (const override of overrides.docs) {
    const data = override.data();
    const date = typeof data.date === "string" ? data.date : override.id;
    if (date < startDate || date > endDate || !DATE_RE.test(date)) continue;
    if (data.isHoliday === true) dates.add(date);
    else dates.delete(date);
  }
  return dates;
}

function calculateWorkingDays(
  startDate: string,
  endDate: string,
  holidays: ReadonlySet<string>,
): number {
  let count = 0;
  for (let date = startDate; date <= endDate; date = addDaysISO(date, 1)) {
    const weekday = parseDateISO(date).getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(date)) count += 1;
  }
  return count;
}

async function calculateCanonicalLeaveDuration(
  tenantId: string,
  data: Pick<LeaveRequestData, "startDate" | "endDate" | "halfDay">,
): Promise<number> {
  if (!data.startDate || !data.endDate) {
    throw new HttpsError("invalid-argument", "Start and end dates are required");
  }
  const start = parseDateISO(data.startDate);
  const end = parseDateISO(data.endDate);
  const calendarDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1_000)) + 1;
  if (calendarDays <= 0 || calendarDays > 366) {
    throw new HttpsError("invalid-argument", "Leave must be between 1 and 366 calendar days");
  }

  const holidays = await getLeaveHolidayDates(tenantId, data.startDate, data.endDate);
  if (data.halfDay === true) {
    if (data.startDate !== data.endDate) {
      throw new HttpsError("invalid-argument", "Half-day leave must use one date");
    }
    return calculateWorkingDays(data.startDate, data.endDate, holidays) === 1 ? 0.5 : 0;
  }
  return calculateWorkingDays(data.startDate, data.endDate, holidays);
}

function getTodayTL(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);
}

function minutesFromTime(value: string): number {
  if (!TIME_RE.test(value)) {
    throw new HttpsError("invalid-argument", "Times must use 24-hour HH:MM");
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function calculateHours(startTime: string, endTime: string): number {
  const start = minutesFromTime(startTime);
  let end = minutesFromTime(endTime);
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

function shiftInterval(date: string, startTime: string, endTime: string): [number, number] {
  const dayStartMinutes = parseDateISO(date).getTime() / 60_000;
  const start = dayStartMinutes + minutesFromTime(startTime);
  let end = dayStartMinutes + minutesFromTime(endTime);
  if (end <= start) end += 24 * 60;
  return [start, end];
}

function shiftsOverlap(
  left: { date: string; startTime: string; endTime: string },
  right: { date: string; startTime: string; endTime: string },
): boolean {
  const [leftStart, leftEnd] = shiftInterval(left.date, left.startTime, left.endTime);
  const [rightStart, rightEnd] = shiftInterval(right.date, right.startTime, right.endTime);
  return leftStart < rightEnd && rightStart < leftEnd;
}

function hasTwelveHoursRest(
  left: { date: string; startTime: string; endTime: string },
  right: { date: string; startTime: string; endTime: string },
): boolean {
  const [leftStart, leftEnd] = shiftInterval(left.date, left.startTime, left.endTime);
  const [rightStart, rightEnd] = shiftInterval(right.date, right.startTime, right.endTime);
  if (leftStart <= rightStart) return rightStart - leftEnd >= 12 * 60;
  return leftStart - rightEnd >= 12 * 60;
}

function getISOWeek(date: Date): string {
  const target = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const isoYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round(
    (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1_000),
  );
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

function getISOWeekRange(weekIso: string): { startDate: string; endDate: string } {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekIso);
  if (!match) throw new Error(`Invalid ISO week: ${weekIso}`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const januaryFourthDay = (januaryFourth.getUTCDay() + 6) % 7;
  const monday = new Date(januaryFourth);
  monday.setUTCDate(januaryFourth.getUTCDate() - januaryFourthDay + (week - 1) * 7);
  return { startDate: formatDateISO(monday), endDate: addDaysISO(formatDateISO(monday), 6) };
}

function countWeekdays(startDate: string, endDate: string): number {
  let count = 0;
  for (let date = startDate; date <= endDate; date = addDaysISO(date, 1)) {
    const day = parseDateISO(date).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export function getBalanceContribution(
  data: LeaveRequestData | undefined,
): BalanceContribution | null {
  if (!data?.tenantId || !data.employeeId || !data.leaveType || !data.startDate) return null;
  if (!DATE_RE.test(data.startDate)) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(data.leaveType)) return null;
  const duration = Number(data.duration);
  if (!Number.isFinite(duration) || duration <= 0) return null;

  const pending = data.status === "pending" ? duration : 0;
  const used = data.status === "approved" ? duration : 0;
  if (pending === 0 && used === 0) return null;

  return {
    tenantId: data.tenantId,
    employeeId: data.employeeId,
    departmentId: data.departmentId,
    year: Number(data.startDate.slice(0, 4)),
    leaveType: data.leaveType,
    pending,
    used,
  };
}

function entitlementsFromConfig(
  configData: Record<string, unknown> | undefined,
): Record<string, number> {
  const entitlements = { ...DEFAULT_ENTITLEMENTS };
  const policies = configData?.timeOffPolicies as Record<string, unknown> | undefined;
  if (!policies) return entitlements;

  const policyKeys = [
    "annualLeave",
    "sickLeave",
    "maternityLeave",
    "paternityLeave",
    "specialLeave",
    "unpaidLeave",
  ];
  for (const key of policyKeys) {
    const policy = policies[key] as Record<string, unknown> | undefined;
    const id = typeof policy?.id === "string" ? policy.id : key.replace("Leave", "");
    const days = Number(policy?.daysPerYear);
    if (Number.isFinite(days) && days >= 0) entitlements[id] = days;
  }

  const custom = Array.isArray(policies.customLeaveTypes) ? policies.customLeaveTypes : [];
  for (const raw of custom) {
    const policy = raw as Record<string, unknown>;
    const id = typeof policy.id === "string" ? policy.id : "";
    const days = Number(policy.daysPerYear);
    if (/^[a-zA-Z0-9_-]+$/.test(id) && Number.isFinite(days) && days >= 0) {
      entitlements[id] = days;
    }
  }
  return entitlements;
}

async function loadEntitlements(tenantId: string): Promise<Record<string, number>> {
  const config = await db.doc(`tenants/${tenantId}/settings/config`).get();
  return entitlementsFromConfig(config.data());
}

async function resolveBalanceRef(
  tenantId: string,
  employeeId: string,
  year: number,
) {
  const existing = await db.collection("leave_balances")
    .where("tenantId", "==", tenantId)
    .where("employeeId", "==", employeeId)
    .where("year", "==", year)
    .limit(1)
    .get();
  if (!existing.empty) return existing.docs[0].ref;
  return db.doc(`leave_balances/${tenantId}_${employeeId}_${year}`);
}

function requestYears(data: LeaveRequestData | undefined): number[] {
  if (!data?.startDate || !DATE_RE.test(data.startDate)) return [];
  const startYear = Number(data.startDate.slice(0, 4));
  const endYear = data.endDate && DATE_RE.test(data.endDate)
    ? Number(data.endDate.slice(0, 4))
    : startYear;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) return [];
  // A leave request spanning more than two calendar years is invalid product
  // data; cap here so a corrupt record cannot fan out unbounded work.
  return Array.from({ length: Math.min(endYear - startYear + 1, 2) }, (_, index) => startYear + index);
}

function requestDurationInYear(data: LeaveRequestData, year: number): number {
  return requestDurationInRange(data, `${year}-01-01`, `${year}-12-31`);
}

function requestDurationInRange(
  data: LeaveRequestData,
  rangeStart: string,
  rangeEnd: string,
): number {
  const duration = Number(data.duration);
  if (!data.startDate || !data.endDate || !Number.isFinite(duration) || duration <= 0) return 0;
  const segmentStart = data.startDate > rangeStart ? data.startDate : rangeStart;
  const segmentEnd = data.endDate < rangeEnd ? data.endDate : rangeEnd;
  if (segmentStart > segmentEnd) return 0;
  if (segmentStart === data.startDate && segmentEnd === data.endDate) return duration;
  const totalWeekdays = countWeekdays(data.startDate, data.endDate);
  const segmentWeekdays = countWeekdays(segmentStart, segmentEnd);
  if (totalWeekdays <= 0) return 0;
  return Math.round((duration * segmentWeekdays / totalWeekdays) * 100) / 100;
}

interface EntitlementBreach {
  leaveType: string;
  year: number;
  available: number;
  committed: number;
  overage: number;
}

/**
 * Total days of `leaveType` already committed (pending + approved) for an
 * employee in `year`, optionally excluding one request id (the candidate itself
 * when re-checking on approve). Mirrors recomputeLeaveBalance's pending+used
 * accounting so the guardrail and the stored balance agree on what "consumed"
 * means.
 */
function committedDaysInYear(
  requests: { id: string; data: LeaveRequestData }[],
  leaveType: string,
  year: number,
  excludeId?: string,
): number {
  let total = 0;
  for (const { id, data } of requests) {
    if (id === excludeId) continue;
    if (data.leaveType !== leaveType) continue;
    if (data.status !== "pending" && data.status !== "approved") continue;
    total += requestDurationInYear(data, year);
  }
  return total;
}

/**
 * Per-year entitlement breaches for a candidate request: the days by which it
 * would push the employee's pending+approved total for its leave type past what
 * they are entitled to (entitlement + carry-over, carry-over applying to annual
 * leave only, matching recomputeLeaveBalance). Returns [] when within
 * entitlement. The overage is surfaced rather than silently clamped to zero, so
 * unknown/0-entitlement types (e.g. "study") are caught instead of paid out.
 */
function findEntitlementBreaches(
  candidate: LeaveRequestData,
  existing: { id: string; data: LeaveRequestData }[],
  entitlements: Record<string, number>,
  carryOverByYear: Map<number, number>,
  excludeId?: string,
): EntitlementBreach[] {
  const leaveType = candidate.leaveType;
  if (!leaveType) return [];
  const breaches: EntitlementBreach[] = [];
  for (const year of requestYears(candidate)) {
    const candidateDays = requestDurationInYear(candidate, year);
    if (candidateDays <= 0) continue;
    const entitled = Number(entitlements[leaveType] ?? 0);
    const carryOver = leaveType === "annual" ? Number(carryOverByYear.get(year) ?? 0) : 0;
    const available = entitled + carryOver;
    const committed = committedDaysInYear(existing, leaveType, year, excludeId) + candidateDays;
    const overage = Math.round((committed - available) * 100) / 100;
    if (overage > 0.001) {
      breaches.push({
        leaveType,
        year,
        available: Math.round(available * 100) / 100,
        committed: Math.round(committed * 100) / 100,
        overage,
      });
    }
  }
  return breaches;
}

function entitlementBreachMessage(breaches: EntitlementBreach[]): string {
  return breaches
    .map((breach) =>
      `${breach.leaveType} ${breach.year}: ${breach.committed} day(s) requested but only ` +
      `${breach.available} entitled (over by ${breach.overage})`)
    .join("; ");
}

/**
 * Carry-over days per year for an employee, read from their stored leave
 * balance docs. Only annual leave uses carry-over, but the map is keyed by year
 * so callers can look up whichever years a request spans.
 */
async function loadCarryOverByYear(
  tenantId: string,
  employeeId: string,
  years: number[],
): Promise<Map<number, number>> {
  const map = new Map<number, number>();
  await Promise.all(years.map(async (year) => {
    const ref = await resolveBalanceRef(tenantId, employeeId, year);
    const snapshot = await ref.get();
    const carryOver = Number(snapshot.data()?.carryOver ?? 0);
    map.set(year, Number.isFinite(carryOver) ? carryOver : 0);
  }));
  return map;
}

function leavePayFraction(
  leaveType: string | undefined,
  config: Record<string, unknown> | undefined,
): number {
  if (!leaveType) return 0;
  const policies = config?.timeOffPolicies as Record<string, unknown> | undefined;
  const configured = policies
    ? [
        policies.annualLeave,
        policies.sickLeave,
        policies.maternityLeave,
        policies.paternityLeave,
        policies.specialLeave,
        policies.unpaidLeave,
        ...(Array.isArray(policies.customLeaveTypes) ? policies.customLeaveTypes : []),
      ]
      .map((policy) => policy as Record<string, unknown> | undefined)
      .find((policy) => policy?.id === leaveType)
    : undefined;
  if (configured) {
    if (configured.isPaid !== true) return 0;
    const percentage = Number(configured.paidPercentage ?? 100);
    return Number.isFinite(percentage) ? Math.min(1, Math.max(0, percentage / 100)) : 1;
  }
  return leaveType === "unpaid" ? 0 : 1;
}

async function recomputeLeaveBalance(
  tenantId: string,
  employeeId: string,
  year: number,
  fallbackDepartmentId?: string,
): Promise<void> {
  const [entitlements, balanceRef, requestSnapshot] = await Promise.all([
    loadEntitlements(tenantId),
    resolveBalanceRef(tenantId, employeeId, year),
    db.collection("leave_requests")
      .where("tenantId", "==", tenantId)
      .where("employeeId", "==", employeeId)
      .get(),
  ]);
  const currentSnapshot = await balanceRef.get();
  const current = currentSnapshot.data() ?? {};
  const totals = new Map<string, { pending: number; used: number }>();
  let employeeName = String(current.employeeName ?? "");
  let departmentId = fallbackDepartmentId ?? String(current.departmentId ?? "");

  for (const document of requestSnapshot.docs) {
    const request = document.data() as LeaveRequestData;
    if (!request.leaveType || !/^[a-zA-Z0-9_-]+$/.test(request.leaveType)) continue;
    if (request.status !== "pending" && request.status !== "approved") continue;
    const duration = requestDurationInYear(request, year);
    if (duration <= 0) continue;
    const total = totals.get(request.leaveType) ?? { pending: 0, used: 0 };
    if (request.status === "pending") total.pending += duration;
    else total.used += duration;
    totals.set(request.leaveType, total);
    if (request.employeeName) employeeName = request.employeeName;
    if (request.departmentId) departmentId = request.departmentId;
  }

  const carryOver = Number(current.carryOver ?? 0);
  const leaveTypes = new Set([
    "annual",
    "sick",
    "maternity",
    "paternity",
    "unpaid",
    ...Object.keys(entitlements),
    ...totals.keys(),
  ]);
  const items: Record<string, BalanceItem> = {};
  for (const leaveType of leaveTypes) {
    const entitled = Number(entitlements[leaveType] ?? 0);
    const total = totals.get(leaveType) ?? { pending: 0, used: 0 };
    const available = entitled + (leaveType === "annual" ? carryOver : 0);
    items[leaveType] = {
      entitled,
      pending: Math.round(total.pending * 100) / 100,
      used: Math.round(total.used * 100) / 100,
      remaining: Math.max(0, Math.round((available - total.pending - total.used) * 100) / 100),
    };
  }

  await balanceRef.set({
    tenantId,
    employeeId,
    ...(departmentId ? { departmentId } : {}),
    employeeName,
    year,
    ...items,
    carryOver,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function syncLeaveBalance(
  before: LeaveRequestData | undefined,
  after: LeaveRequestData | undefined,
): Promise<void> {
  const targets = new Map<string, {
    tenantId: string;
    employeeId: string;
    departmentId?: string;
    year: number;
  }>();
  for (const request of [before, after]) {
    if (!request?.tenantId || !request.employeeId) continue;
    for (const year of requestYears(request)) {
      targets.set(`${request.tenantId}|${request.employeeId}|${year}`, {
        tenantId: request.tenantId,
        employeeId: request.employeeId,
        departmentId: request.departmentId,
        year,
      });
    }
  }

  for (const target of targets.values()) {
    await recomputeLeaveBalance(
      target.tenantId,
      target.employeeId,
      target.year,
      target.departmentId,
    );
  }
}

async function cancelShiftsForLeave(leave: LeaveRequestData, requestId: string): Promise<void> {
  if (!leave.tenantId || !leave.employeeId || !leave.startDate || !leave.endDate) return;
  const shifts = await db.collection(`tenants/${leave.tenantId}/shifts`)
    .where("employeeId", "==", leave.employeeId)
    .where("date", ">=", leave.startDate)
    .where("date", "<=", leave.endDate)
    .get();

  let batch = db.batch();
  let count = 0;
  for (const shift of shifts.docs) {
    if (shift.data().status === "cancelled") continue;
    batch.update(shift.ref, {
      status: "cancelled",
      cancelReason: `Approved leave ${requestId}`,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    count += 1;
    if (count % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  if (count % 450 !== 0) await batch.commit();
}

export const createOrUpdateShift = onCall(async (request) => {
  const auth = requireAuth(request);
  const data = request.data as {
    tenantId?: string;
    shiftData?: ShiftInput;
    shiftId?: string;
  };
  const tenantId = data.tenantId;
  const shiftData = data.shiftData;
  if (!tenantId || !shiftData) {
    throw new HttpsError("invalid-argument", "Missing tenantId or shiftData");
  }
  const member = await requireTenantManagerOrAdmin(tenantId, auth.uid);

  const employeeId = shiftData.employeeId;
  const date = shiftData.date;
  const startTime = shiftData.startTime ?? shiftData.start;
  const endTime = shiftData.endTime ?? shiftData.end;
  if (!employeeId || !date || !startTime || !endTime) {
    throw new HttpsError("invalid-argument", "Employee, date, start, and end are required");
  }
  parseDateISO(date);
  const hours = calculateHours(startTime, endTime);
  if (hours <= 0 || hours >= 24) {
    throw new HttpsError("invalid-argument", "Invalid shift duration");
  }

  const ref = data.shiftId
    ? db.doc(`tenants/${tenantId}/shifts/${data.shiftId}`)
    : db.collection(`tenants/${tenantId}/shifts`).doc();
  const [employeeSnapshot, existingSnapshot] = await Promise.all([
    db.doc(`tenants/${tenantId}/employees/${employeeId}`).get(),
    data.shiftId ? ref.get() : Promise.resolve(null),
  ]);
  if (!employeeSnapshot.exists) {
    throw new HttpsError("not-found", "Employee not found");
  }
  if (data.shiftId && !existingSnapshot?.exists) {
    throw new HttpsError("not-found", "Shift not found");
  }
  const employee = employeeSnapshot.data() ?? {};
  const jobDetails = employee.jobDetails as Record<string, unknown> | undefined;
  const departmentId = typeof jobDetails?.departmentId === "string"
    ? jobDetails.departmentId
    : "";
  const department = typeof jobDetails?.department === "string"
    ? jobDetails.department
    : shiftData.department ?? "";
  if (member.role === "manager") {
    const existingDepartmentId = existingSnapshot?.data()?.departmentId;
    if (
      !member.departmentId ||
      departmentId !== member.departmentId ||
      (existingSnapshot && existingDepartmentId !== member.departmentId)
    ) {
      throw new HttpsError("permission-denied", "Managers can only schedule their own department");
    }
  }

  const status = shiftData.status ?? "draft";
  if (!["draft", "published", "confirmed", "cancelled"].includes(status)) {
    throw new HttpsError("invalid-argument", "Invalid shift status");
  }

  if (status !== "cancelled") {
    const nearby = await db.collection(`tenants/${tenantId}/shifts`)
      .where("employeeId", "==", employeeId)
      .where("date", ">=", addDaysISO(date, -1))
      .where("date", "<=", addDaysISO(date, 1))
      .get();
    const proposed = { date, startTime, endTime };
    for (const snapshot of nearby.docs) {
      if (data.shiftId && snapshot.id === data.shiftId) continue;
      const existing = snapshot.data();
      if (existing.status === "cancelled") continue;
      if (!existing.date || !existing.startTime || !existing.endTime) continue;
      const candidate = {
        date: String(existing.date),
        startTime: String(existing.startTime),
        endTime: String(existing.endTime),
      };
      if (shiftsOverlap(proposed, candidate)) {
        throw new HttpsError("failed-precondition", "This shift overlaps another shift");
      }
      if (!hasTwelveHoursRest(proposed, candidate)) {
        throw new HttpsError("failed-precondition", "Employees need 12 hours between shifts");
      }
    }

    const approvedLeave = await db.collection("leave_requests")
      .where("tenantId", "==", tenantId)
      .where("employeeId", "==", employeeId)
      .where("status", "==", "approved")
      .get();
    if (approvedLeave.docs.some((item) => {
      const leave = item.data();
      return leave.startDate <= date && leave.endDate >= date;
    })) {
      throw new HttpsError("failed-precondition", "This employee is on approved leave");
    }
  }

  await ref.set({
    tenantId,
    employeeId,
    employeeName: shiftData.employeeName ?? [
      employee.personalInfo?.firstName,
      employee.personalInfo?.lastName,
    ].filter(Boolean).join(" "),
    department,
    ...(departmentId ? { departmentId } : {}),
    position: shiftData.position ?? shiftData.role ?? String(jobDetails?.position ?? ""),
    date,
    startTime,
    endTime,
    hours,
    status,
    location: shiftData.location ?? "",
    notes: shiftData.notes ?? "",
    ...(shiftData.slotId ? { slotId: shiftData.slotId } : {}),
    ...(data.shiftId ? {} : {
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
    }),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: Boolean(data.shiftId) });

  return { success: true, shiftId: ref.id, hours };
});

/**
 * Clone every non-cancelled shift in one week into the following week as
 * drafts, in server-side batches. Replaces the old client loop that fired one
 * createOrUpdateShift call per shift (minutes of latency for a large roster).
 *
 * Source shifts were already validated on creation, so cloning re-checks only
 * what the target week can newly violate. It prefetches the target window once
 * and skips a source shift when
 * (a) an employee+date+start is already scheduled next week (idempotent
 *     re-copy),
 * (b) the clone would overlap or break the 12-hour rest rule against a shift
 *     already in the target week (or an earlier clone in this same run) — the
 *     same guard createOrUpdateShift enforces, so Copy Week can no longer plant
 *     a shift the normal create path would have rejected, or
 * (c) the employee is on approved leave that day.
 * A per-(tenant, target week, department) lock makes concurrent invocations
 * safe: the second one is rejected instead of duplicating the whole week.
 * Returns how many shifts were created vs skipped.
 */
export const copyWeekShifts = onCall(async (request) => {
  const auth = requireAuth(request);
  const data = request.data as {
    tenantId?: string;
    startDate?: string;
    endDate?: string;
    departmentId?: string;
  };
  const { tenantId, startDate, endDate } = data;
  if (!tenantId || !startDate || !endDate) {
    throw new HttpsError("invalid-argument", "Missing tenantId, startDate, or endDate");
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    throw new HttpsError("invalid-argument", "Dates must be YYYY-MM-DD");
  }
  const member = await requireTenantManagerOrAdmin(tenantId, auth.uid);

  const sourceSnap = await db.collection(`tenants/${tenantId}/shifts`)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();
  let source = sourceSnap.docs
    .map((document) => document.data())
    .filter((shift) => shift.status !== "cancelled" && shift.date && shift.startTime && shift.endTime);

  // Managers may only clone their own department's roster.
  if (member.role === "manager") {
    if (!member.departmentId) {
      throw new HttpsError("permission-denied", "Managers can only schedule their own department");
    }
    source = source.filter((shift) => shift.departmentId === member.departmentId);
  }
  if (source.length === 0) return { created: 0, skipped: 0 };

  const targetStart = addDaysISO(startDate, 7);
  const targetEnd = addDaysISO(endDate, 7);

  // Concurrency guard: only one copy may run per tenant + target week +
  // department scope at a time, so two racing invocations cannot both prefetch
  // an empty target week and each write the full clone (issue #14). Acquired
  // transactionally before any prefetch; a stale lock from a crashed run is
  // taken over after COPY_LOCK_TTL_MS. Released in `finally` so a failed run
  // frees the week immediately — partial re-runs are safe because the
  // exact-key dedup below skips already-written shifts.
  const copyScope = member.role === "manager" ? member.departmentId ?? "all" : "all";
  const lockId = `${targetStart}_${copyScope}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  const lockRef = db.doc(`tenants/${tenantId}/shiftCopyLocks/${lockId}`);
  const lockAcquired = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    const startedAtMs = Number(snapshot.data()?.startedAtMs);
    if (snapshot.exists && Number.isFinite(startedAtMs) && Date.now() - startedAtMs < COPY_LOCK_TTL_MS) {
      return false;
    }
    transaction.set(lockRef, {
      tenantId,
      scope: copyScope,
      targetStart,
      targetEnd,
      startedAtMs: Date.now(),
      startedBy: auth.uid,
      startedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!lockAcquired) {
    throw new HttpsError("aborted", "A copy for this week is already running. Try again in a moment.");
  }

  try {
    // Prefetch the target window once. Shifts are pulled ±1 day so the
    // 12-hour-rest check can see shifts just outside the week (mirrors
    // createOrUpdateShift's ±1 window). The leave query is bounded to leave
    // that overlaps the target week — [startDate <= targetEnd, endDate >=
    // targetStart] — served by the existing tenantId+status+startDate+endDate
    // index, so it is O(target-week leave) instead of O(all tenant leave ever).
    const [existingSnap, leaveSnap] = await Promise.all([
      db.collection(`tenants/${tenantId}/shifts`)
        .where("date", ">=", addDaysISO(targetStart, -1))
        .where("date", "<=", addDaysISO(targetEnd, 1))
        .get(),
      db.collection("leave_requests")
        .where("tenantId", "==", tenantId)
        .where("status", "==", "approved")
        .where("startDate", "<=", targetEnd)
        .where("endDate", ">=", targetStart)
        .get(),
    ]);

    const scheduledKeys = new Set<string>();
    // Existing non-cancelled target-window shifts indexed by employee, used both
    // for exact-key dedup and for the overlap / 12-hour-rest guard.
    const targetByEmployee = new Map<
      string,
      { date: string; startTime: string; endTime: string }[]
    >();
    for (const document of existingSnap.docs) {
      const shift = document.data();
      if (shift.status === "cancelled") continue;
      if (!shift.employeeId || !shift.date || !shift.startTime || !shift.endTime) continue;
      const employeeId = String(shift.employeeId);
      scheduledKeys.add(`${employeeId}|${shift.date}|${shift.startTime}`);
      const list = targetByEmployee.get(employeeId) ?? [];
      list.push({
        date: String(shift.date),
        startTime: String(shift.startTime),
        endTime: String(shift.endTime),
      });
      targetByEmployee.set(employeeId, list);
    }

    // Approved leave overlapping the target week, indexed by employee for O(1)
    // per-shift lookup instead of scanning all tenant leave per source shift.
    const leavesByEmployee = new Map<string, { startDate: string; endDate: string }[]>();
    for (const document of leaveSnap.docs) {
      const leave = document.data();
      if (typeof leave.employeeId !== "string") continue;
      if (typeof leave.startDate !== "string" || typeof leave.endDate !== "string") continue;
      const list = leavesByEmployee.get(leave.employeeId) ?? [];
      list.push({ startDate: leave.startDate, endDate: leave.endDate });
      leavesByEmployee.set(leave.employeeId, list);
    }
    const onApprovedLeave = (employeeId: string, date: string) =>
      (leavesByEmployee.get(employeeId) ?? []).some((leave) =>
        leave.startDate <= date && leave.endDate >= date);
    const conflictsWithTarget = (
      employeeId: string,
      proposed: { date: string; startTime: string; endTime: string },
    ) =>
      (targetByEmployee.get(employeeId) ?? []).some((candidate) =>
        shiftsOverlap(proposed, candidate) || !hasTwelveHoursRest(proposed, candidate));

    let batch = db.batch();
    let writes = 0;
    let created = 0;
    let skipped = 0;
    for (const shift of source) {
      const date = addDaysISO(String(shift.date), 7);
      const employeeId = String(shift.employeeId);
      const key = `${employeeId}|${date}|${shift.startTime}`;
      const proposed = {
        date,
        startTime: String(shift.startTime),
        endTime: String(shift.endTime),
      };
      if (
        scheduledKeys.has(key) ||
        onApprovedLeave(employeeId, date) ||
        conflictsWithTarget(employeeId, proposed)
      ) {
        skipped += 1;
        continue;
      }
      scheduledKeys.add(key); // guard against duplicate source rows in the same copy
      // Record the clone so later source rows are checked against it too.
      const list = targetByEmployee.get(employeeId) ?? [];
      list.push(proposed);
      targetByEmployee.set(employeeId, list);
      const ref = db.collection(`tenants/${tenantId}/shifts`).doc();
      batch.set(ref, {
        tenantId,
        employeeId: shift.employeeId,
        employeeName: shift.employeeName ?? "",
        department: shift.department ?? "",
        ...(shift.departmentId ? { departmentId: shift.departmentId } : {}),
        position: shift.position ?? "",
        date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        hours: typeof shift.hours === "number" ? shift.hours : calculateHours(String(shift.startTime), String(shift.endTime)),
        status: "draft",
        location: shift.location ?? "",
        ...(shift.slotId ? { slotId: shift.slotId } : {}),
        notes: shift.notes ?? "",
        createdBy: auth.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      created += 1;
      writes += 1;
      if (writes === 450) {
        await batch.commit();
        batch = db.batch();
        writes = 0;
      }
    }
    if (writes > 0) await batch.commit();

    return { created, skipped };
  } finally {
    // Release the lock; TTL covers the case where this delete itself fails.
    await lockRef.delete().catch(() => undefined);
  }
});

export const createLeaveRequest = onCall(async (request) => {
  const auth = requireAuth(request);
  const data = request.data as {
    tenantId?: string;
    employeeId?: string;
    leaveType?: string;
    leaveTypeLabel?: string;
    startDate?: string;
    endDate?: string;
    halfDay?: boolean;
    halfDayType?: "morning" | "afternoon";
    reason?: string;
    attachmentUrl?: string;
    certificateType?: string;
    overrideBalance?: boolean;
  };
  const tenantId = data.tenantId;
  const employeeId = data.employeeId;
  const leaveType = data.leaveType;
  const reason = data.reason?.trim() ?? "";
  if (!tenantId || !employeeId || !leaveType || !data.startDate || !data.endDate) {
    throw new HttpsError("invalid-argument", "Tenant, employee, leave type, and dates are required");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(leaveType)) {
    throw new HttpsError("invalid-argument", "Invalid leave type");
  }
  if (!reason || reason.length > 1_000) {
    throw new HttpsError("invalid-argument", "Reason must be between 1 and 1000 characters");
  }
  if (
    data.halfDay === true &&
    data.halfDayType !== "morning" &&
    data.halfDayType !== "afternoon"
  ) {
    throw new HttpsError("invalid-argument", "Select morning or afternoon for half-day leave");
  }

  const member = await requireTenantMember(tenantId, auth.uid);
  const [employeeSnapshot, configSnapshot] = await Promise.all([
    db.doc(`tenants/${tenantId}/employees/${employeeId}`).get(),
    db.doc(`tenants/${tenantId}/settings/config`).get(),
  ]);
  if (!employeeSnapshot.exists) throw new HttpsError("not-found", "Employee not found");
  const employee = employeeSnapshot.data() ?? {};
  if (typeof employee.status === "string" && employee.status !== "active") {
    throw new HttpsError("failed-precondition", "Leave can only be requested for active employees");
  }
  const jobDetails = employee.jobDetails as Record<string, unknown> | undefined;
  const personalInfo = employee.personalInfo as Record<string, unknown> | undefined;
  const departmentId = typeof jobDetails?.departmentId === "string" ? jobDetails.departmentId : "";
  const department = typeof jobDetails?.department === "string" ? jobDetails.department : "";
  const role = member.role;
  const canCreateForEmployee = role === "owner" || role === "hr-admin" || (
    role === "manager"
      ? Boolean(member.departmentId && member.departmentId === departmentId)
      : role !== "accountant" && member.employeeId === employeeId
  );
  if (!canCreateForEmployee) {
    throw new HttpsError("permission-denied", "You cannot request leave for this employee");
  }

  const policies = configSnapshot.data()?.timeOffPolicies as Record<string, unknown> | undefined;
  const configuredPolicies = policies
    ? [
        policies.annualLeave,
        policies.sickLeave,
        policies.maternityLeave,
        policies.paternityLeave,
        policies.specialLeave,
        policies.unpaidLeave,
        ...(Array.isArray(policies.customLeaveTypes) ? policies.customLeaveTypes : []),
      ].map((policy) => policy as Record<string, unknown> | undefined)
    : [];
  const configuredPolicy = configuredPolicies.find((policy) => policy?.id === leaveType);
  if (!(leaveType in DEFAULT_ENTITLEMENTS) && !configuredPolicy) {
    throw new HttpsError("invalid-argument", "Unknown leave type");
  }
  if (configuredPolicy?.isActive === false) {
    throw new HttpsError("failed-precondition", "This leave type is not active");
  }

  const canonicalLeave: LeaveRequestData = {
    startDate: data.startDate,
    endDate: data.endDate,
    halfDay: data.halfDay === true,
  };
  const duration = await calculateCanonicalLeaveDuration(tenantId, canonicalLeave);
  if (duration <= 0) {
    throw new HttpsError("invalid-argument", "Leave must include at least one working day");
  }

  const attachmentUrl = typeof data.attachmentUrl === "string" && data.attachmentUrl.length <= 2_048
    ? data.attachmentUrl
    : "";
  const configuredName = typeof configuredPolicy?.name === "string" ? configuredPolicy.name : "";
  const requestedLabel = typeof data.leaveTypeLabel === "string"
    ? data.leaveTypeLabel.trim().slice(0, 120)
    : "";

  const candidate: LeaveRequestData = {
    tenantId,
    employeeId,
    leaveType,
    startDate: data.startDate,
    endDate: data.endDate,
    duration,
    status: "pending",
  };
  // Owners / HR admins may knowingly grant leave beyond entitlement; everyone
  // else (including self-service employees) is held to the balance.
  const overrideBalance = data.overrideBalance === true
    && (role === "owner" || role === "hr-admin");
  const entitlements = entitlementsFromConfig(configSnapshot.data());
  const carryOverByYear = await loadCarryOverByYear(
    tenantId,
    employeeId,
    requestYears(candidate),
  );

  const ref = db.collection("leave_requests").doc();
  // Overlap check + entitlement check + create run in one transaction so two
  // concurrent requests cannot both pass an empty overlap query and each create
  // a booking (transaction.get holds a pessimistic lock on the matched rows).
  await db.runTransaction(async (transaction) => {
    const existingSnapshot = await transaction.get(
      db.collection("leave_requests")
        .where("tenantId", "==", tenantId)
        .where("employeeId", "==", employeeId),
    );
    const existing = existingSnapshot.docs.map((document) => ({
      id: document.id,
      data: document.data() as LeaveRequestData,
    }));

    const overlaps = existing.some(({ data: leave }) =>
      (leave.status === "pending" || leave.status === "approved") &&
      Boolean(leave.startDate && leave.endDate) &&
      leave.startDate! <= data.endDate! && leave.endDate! >= data.startDate!);
    if (overlaps) {
      throw new HttpsError("already-exists", "This employee already has overlapping leave");
    }

    if (!overrideBalance) {
      const breaches = findEntitlementBreaches(candidate, existing, entitlements, carryOverByYear);
      if (breaches.length > 0) {
        throw new HttpsError(
          "failed-precondition",
          `Leave exceeds entitlement — ${entitlementBreachMessage(breaches)}`,
        );
      }
    }

    transaction.set(ref, {
      tenantId,
      employeeId,
      employeeName: [personalInfo?.firstName, personalInfo?.lastName]
        .filter((value): value is string => typeof value === "string" && Boolean(value))
        .join(" "),
      department,
      departmentId,
      leaveType,
      leaveTypeLabel: configuredName || requestedLabel || leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      duration,
      halfDay: data.halfDay === true,
      ...(data.halfDay === true && data.halfDayType
        ? { halfDayType: data.halfDayType }
        : {}),
      reason,
      ...(attachmentUrl ? { attachmentUrl } : {}),
      hasCertificate: Boolean(attachmentUrl),
      ...(typeof data.certificateType === "string" && data.certificateType
        ? { certificateType: data.certificateType.slice(0, 120) }
        : {}),
      status: "pending",
      requestDate: getTodayTL(),
      createdBy: auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { success: true, requestId: ref.id, duration };
});

export async function recomputeWeekTotals(
  tenantId: string,
  employeeId: string,
  weekIso: string,
): Promise<void> {
  const { startDate, endDate } = getISOWeekRange(weekIso);
  const [shiftSnapshot, leaveSnapshot, configSnapshot] = await Promise.all([
    db.collection(`tenants/${tenantId}/shifts`)
      .where("employeeId", "==", employeeId)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .get(),
    db.collection("leave_requests")
      .where("tenantId", "==", tenantId)
      .where("employeeId", "==", employeeId)
      .where("status", "==", "approved")
      .get(),
    db.doc(`tenants/${tenantId}/settings/config`).get(),
  ]);

  const shifts = shiftSnapshot.docs
    .map((item) => item.data())
    .filter((shift) => shift.status !== "cancelled");
  const workHours = shifts.reduce((total, shift) => {
    const hours = Number(shift.hours);
    if (Number.isFinite(hours)) return total + hours;
    if (shift.startTime && shift.endTime) return total + calculateHours(shift.startTime, shift.endTime);
    return total;
  }, 0);
  const overtimeThreshold = Number(
    configSnapshot.data()?.payrollConfig?.maxWorkHoursPerWeek ?? 44,
  );

  let paidLeaveHours = 0;
  let unpaidLeaveHours = 0;
  for (const leaveDocument of leaveSnapshot.docs) {
    const leave = leaveDocument.data() as LeaveRequestData;
    if (!leave.startDate || !leave.endDate) continue;
    const hours = requestDurationInRange(leave, startDate, endDate) * 8;
    if (hours <= 0) continue;
    const paidFraction = leavePayFraction(leave.leaveType, configSnapshot.data());
    paidLeaveHours += hours * paidFraction;
    unpaidLeaveHours += hours * (1 - paidFraction);
  }

  const regularHours = Math.min(workHours, overtimeThreshold);
  const overtimeHours = Math.max(0, workHours - overtimeThreshold);
  const sundays = shifts.filter((shift) => parseDateISO(String(shift.date)).getUTCDay() === 0).length;
  await db.doc(`tenants/${tenantId}/timesheets/${employeeId}_${weekIso}`).set({
    tenantId,
    employeeId,
    empId: employeeId,
    weekIso,
    weekStartDate: startDate,
    weekEndDate: endDate,
    regularHours,
    overtimeHours,
    paidLeaveHours,
    unpaidLeaveHours,
    sundays,
    computedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export const approveLeaveRequest = onCall(async (request) => {
  const auth = requireAuth(request);
  const data = request.data as {
    tenantId?: string;
    requestId?: string;
    approved?: boolean;
    note?: string;
    approverName?: string;
    overrideBalance?: boolean;
  };
  if (!data.tenantId || !data.requestId || typeof data.approved !== "boolean") {
    throw new HttpsError("invalid-argument", "Missing tenantId, requestId, or decision");
  }
  const member = await requireTenantManagerOrAdmin(data.tenantId, auth.uid);
  const ref = db.doc(`leave_requests/${data.requestId}`);
  const initialSnapshot = await ref.get();
  if (!initialSnapshot.exists) throw new HttpsError("not-found", "Leave request not found");
  const initialLeave = initialSnapshot.data() as LeaveRequestData;
  if (initialLeave.tenantId !== data.tenantId) {
    throw new HttpsError("not-found", "Leave request not found");
  }
  const duration = data.approved
    ? await calculateCanonicalLeaveDuration(data.tenantId, initialLeave)
    : undefined;
  if (data.approved && (!duration || duration <= 0)) {
    throw new HttpsError("failed-precondition", "Leave no longer includes a working day");
  }

  // Only owners / HR admins may knowingly approve leave beyond entitlement.
  const overrideBalance = data.approved === true
    && data.overrideBalance === true
    && (member.role === "owner" || member.role === "hr-admin");
  let entitlements: Record<string, number> = {};
  let carryOverByYear = new Map<number, number>();
  if (data.approved && !overrideBalance && initialLeave.employeeId) {
    [entitlements, carryOverByYear] = await Promise.all([
      loadEntitlements(data.tenantId),
      loadCarryOverByYear(data.tenantId, initialLeave.employeeId, requestYears(initialLeave)),
    ]);
  }

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Leave request not found");
    const leave = snapshot.data() as LeaveRequestData;
    if (leave.tenantId !== data.tenantId) throw new HttpsError("not-found", "Leave request not found");
    if (leave.status !== "pending") {
      throw new HttpsError("failed-precondition", "Leave request is no longer pending");
    }
    if (member.role === "manager") {
      if (!member.departmentId || leave.departmentId !== member.departmentId) {
        throw new HttpsError("permission-denied", "Managers can only decide requests for their team");
      }
    }

    // Re-check overlap and entitlement inside the transaction so approve holds
    // the "no overlapping pending/approved leave, within entitlement" invariant
    // even for requests created before enforcement or racing another approval.
    if (data.approved && leave.employeeId) {
      const othersSnapshot = await transaction.get(
        db.collection("leave_requests")
          .where("tenantId", "==", data.tenantId)
          .where("employeeId", "==", leave.employeeId),
      );
      const others = othersSnapshot.docs.map((document) => ({
        id: document.id,
        data: document.data() as LeaveRequestData,
      }));

      const overlaps = others.some(({ id, data: other }) =>
        id !== data.requestId &&
        (other.status === "pending" || other.status === "approved") &&
        Boolean(other.startDate && other.endDate) &&
        Boolean(leave.startDate && leave.endDate) &&
        other.startDate! <= leave.endDate! && other.endDate! >= leave.startDate!);
      if (overlaps) {
        throw new HttpsError(
          "failed-precondition",
          "This employee has overlapping leave for these dates",
        );
      }

      if (!overrideBalance) {
        const candidate: LeaveRequestData = { ...leave, duration };
        const breaches = findEntitlementBreaches(
          candidate,
          others,
          entitlements,
          carryOverByYear,
          data.requestId,
        );
        if (breaches.length > 0) {
          throw new HttpsError(
            "failed-precondition",
            `Leave exceeds entitlement — ${entitlementBreachMessage(breaches)}`,
          );
        }
      }
    }

    transaction.update(ref, {
      status: data.approved ? "approved" : "rejected",
      ...(duration ? { duration } : {}),
      approverId: auth.uid,
      approverName: data.approverName ?? "",
      approvedDate: data.approved ? getTodayTL() : FieldValue.delete(),
      ...(data.note
        ? data.approved
          ? { approverComment: data.note }
          : { rejectionReason: data.note }
        : {}),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

export const onShiftChange = onDocumentWritten(
  "tenants/{tenantId}/shifts/{shiftId}",
  async (event) => {
    const affected = new Map<string, { employeeId: string; weekIso: string }>();
    for (const snapshot of [event.data?.before, event.data?.after]) {
      if (!snapshot?.exists) continue;
      const data = snapshot.data();
      if (!data?.employeeId || !data.date) continue;
      const employeeId = String(data.employeeId);
      const weekIso = getISOWeek(parseDateISO(String(data.date)));
      affected.set(`${employeeId}|${weekIso}`, { employeeId, weekIso });
    }
    for (const item of affected.values()) {
      await recomputeWeekTotals(event.params.tenantId, item.employeeId, item.weekIso);
    }
  },
);

export const onLeaveRequestWrite = onDocumentWritten(
  "leave_requests/{requestId}",
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { requestId: string }>) => {
    const before = event.data?.before.exists
      ? event.data.before.data() as LeaveRequestData
      : undefined;
    const after = event.data?.after.exists
      ? event.data.after.data() as LeaveRequestData
      : undefined;

    await syncLeaveBalance(before, after);

    const newlyApproved = before?.status !== "approved" && after?.status === "approved";
    if (newlyApproved && after) {
      await cancelShiftsForLeave(after, event.params.requestId);
    }

    const affected = [before, after].filter(
      (leave): leave is LeaveRequestData => Boolean(
        leave?.tenantId && leave.employeeId && leave.startDate && leave.endDate && leave.status === "approved",
      ),
    );
    const weeks = new Map<string, { tenantId: string; employeeId: string; weekIso: string }>();
    for (const leave of affected) {
      for (let date = leave.startDate!; date <= leave.endDate!; date = addDaysISO(date, 1)) {
        const weekIso = getISOWeek(parseDateISO(date));
        const key = `${leave.tenantId}|${leave.employeeId}|${weekIso}`;
        weeks.set(key, {
          tenantId: leave.tenantId!,
          employeeId: leave.employeeId!,
          weekIso,
        });
      }
    }
    for (const week of weeks.values()) {
      await recomputeWeekTotals(week.tenantId, week.employeeId, week.weekIso);
    }

    logger.info("Leave request synchronized", {
      requestId: event.params.requestId,
      beforeStatus: before?.status ?? null,
      afterStatus: after?.status ?? null,
    });
  },
);
