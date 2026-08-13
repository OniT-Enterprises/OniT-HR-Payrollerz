/**
 * Effective-dated salary history, and the retroactive differential a back-dated
 * raise owes.
 *
 * WHY THIS EXISTS. Lei 4/2012 says nothing about recording pay changes, but two
 * things in the field demand it:
 *
 * 1. Auditors ask for it by name. A year-end request list from a real TL audit
 *    asks for "detalhe dos aumentos salariais por colaborador e indicação do mês
 *    em que ocorreu o aumento" — a per-employee schedule of increases WITH the
 *    month each one took effect. `salaryIncreaseSchedule` is that deliverable.
 *
 * 2. Raises are routinely back-dated. A client instructs "os valores contam com
 *    os retroativos a março" — the April run pays April at the new rate plus the
 *    March shortfall. "Retroativos" is a standing column in real TL payroll
 *    registers, not an exception.
 *
 * WHAT THIS DOES NOT DO. `compensation.monthlySalary` stays the CURRENT salary
 * and remains the only figure every existing money path reads. Nothing here
 * changes what a payroll run pays today, and in particular the Art. 44 subsídio
 * and the Art. 32 leave payout still price at the current salary. Whether they
 * SHOULD price at a time-weighted average after a mid-year raise is an open
 * reading — `timeWeightedMonthlySalary` computes it so the question can be
 * answered with a number, but no caller uses it for money yet. See
 * docs/NICO_OPEN_QUESTIONS.md A11.
 *
 * Money uses the decimal.js helpers in lib/currency; dates are plain
 * YYYY-MM-DD strings compared lexically, never Date objects, so a timezone can
 * never move a raise across a month boundary.
 */

import { multiplyMoney, subtractMoney, sumMoney } from '@/lib/currency';

/** A single recorded pay change. Append-only, like `jobDetails.contractRenewals`. */
export interface SalaryChange {
  /** Inclusive date the new salary takes effect (YYYY-MM-DD). */
  effectiveFrom: string;
  /** Monthly salary from `effectiveFrom` onwards. */
  monthlySalary: number;
  /**
   * The salary this change replaced, captured when the change was recorded.
   * Stored rather than derived so a later correction to an earlier entry can
   * never silently re-price a differential that was already paid.
   */
  previousMonthlySalary?: number;
  /** Free text: promotion, annual review, minimum-wage uplift. */
  reason?: string;
  /**
   * When the change was RECORDED. Later than `effectiveFrom` for a back-dated
   * raise, which is exactly the case that owes a retroactive differential.
   */
  recordedAt: string;
  recordedBy?: string;
  /**
   * 'YYYY-MM' period month of the PAID run that settled this change's
   * retroactive differential. Once stamped, the differential is never suggested
   * again. This is the once-only guard MONEY_CHAIN requires of any new earning —
   * without it, two runs over the same period would each pay the same arrears.
   */
  retroSettledPeriod?: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function assertISODate(value: string, fieldName: string): void {
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new RangeError(`${fieldName} must use YYYY-MM-DD format.`);
  }
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`${fieldName} is not a valid calendar date.`);
  }
}

/** 'YYYY-MM-DD' -> 'YYYY-MM'. */
export function monthKey(isoDate: string): string {
  assertISODate(isoDate, 'Date');
  return isoDate.slice(0, 7);
}

/** True when the date is the first day of its month — the only shape whole-month retro is safe for. */
export function isFirstOfMonth(isoDate: string): boolean {
  assertISODate(isoDate, 'Date');
  return isoDate.slice(8, 10) === '01';
}

/** Whole calendar months from `fromMonth` up to but EXCLUDING `toMonth`. Never negative. */
export function monthsBetween(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split('-').map(Number);
  const [ty, tm] = toMonth.split('-').map(Number);
  return Math.max(0, (ty - fy) * 12 + (tm - fm));
}

/**
 * History sorted oldest-first by effective date. Ties break on `recordedAt` so
 * two changes effective the same day resolve to the one recorded later —
 * a correction supersedes what it corrects.
 */
export function sortedSalaryHistory(
  history: readonly SalaryChange[] | undefined | null,
): SalaryChange[] {
  if (!history || history.length === 0) return [];
  return [...history].sort((a, b) => {
    if (a.effectiveFrom !== b.effectiveFrom) {
      return a.effectiveFrom < b.effectiveFrom ? -1 : 1;
    }
    return (a.recordedAt || '') < (b.recordedAt || '') ? -1 : 1;
  });
}

export type SalaryBasisSource =
  /** A recorded change covers this date. */
  | 'recorded'
  /** No history at all — the current salary is everything we know. */
  | 'current'
  /** The date precedes every recorded change, so the earliest rate was assumed. */
  | 'before_history';

export interface SalaryBasis {
  monthlySalary: number;
  source: SalaryBasisSource;
  /** Effective date of the change that supplied the figure, when one did. */
  effectiveFrom?: string;
}

/**
 * The monthly salary in effect on `isoDate`.
 *
 * `source` is part of the answer, not decoration: 'current' and 'before_history'
 * both mean "this is the best we hold, not a recorded fact", and any screen that
 * prices a past period off this must say so rather than presenting it as
 * history. Xefe never infers a compliance value silently (MONEY_CHAIN
 * invariant 6) and a salary for an unrecorded month is exactly that.
 */
export function salaryOnDate(
  history: readonly SalaryChange[] | undefined | null,
  currentMonthlySalary: number,
  isoDate: string,
): SalaryBasis {
  assertISODate(isoDate, 'Date');
  const sorted = sortedSalaryHistory(history);
  if (sorted.length === 0) {
    return { monthlySalary: currentMonthlySalary, source: 'current' };
  }

  let match: SalaryChange | undefined;
  for (const change of sorted) {
    if (change.effectiveFrom <= isoDate) match = change;
    else break;
  }

  if (!match) {
    // The date precedes every recorded change, so the best evidence is what the
    // EARLIEST change says it replaced — not that change's new salary, which had
    // not started yet. Falling back to `monthlySalary` here reported a raise as
    // if it had always been in force, which over-stated every period before it.
    const earliest = sorted[0];
    return {
      monthlySalary:
        typeof earliest.previousMonthlySalary === 'number'
          ? earliest.previousMonthlySalary
          : earliest.monthlySalary,
      source: 'before_history',
      effectiveFrom: earliest.effectiveFrom,
    };
  }
  return {
    monthlySalary: match.monthlySalary,
    source: 'recorded',
    effectiveFrom: match.effectiveFrom,
  };
}

export interface SalarySegment {
  /** Inclusive. */
  from: string;
  /** Inclusive. */
  to: string;
  monthlySalary: number;
  source: SalaryBasisSource;
}

/**
 * The period split into runs of constant salary. One segment when nothing
 * changed mid-period, which is the ordinary case.
 */
export function salarySegmentsInPeriod(
  history: readonly SalaryChange[] | undefined | null,
  currentMonthlySalary: number,
  periodStart: string,
  periodEnd: string,
): SalarySegment[] {
  assertISODate(periodStart, 'Period start');
  assertISODate(periodEnd, 'Period end');
  if (periodEnd < periodStart) return [];

  const boundaries = sortedSalaryHistory(history)
    .map((c) => c.effectiveFrom)
    .filter((d) => d > periodStart && d <= periodEnd);

  const starts = [periodStart, ...boundaries];
  return starts.map((start, index) => {
    const basis = salaryOnDate(history, currentMonthlySalary, start);
    const nextStart = starts[index + 1];
    return {
      from: start,
      to: nextStart ? previousDay(nextStart) : periodEnd,
      monthlySalary: basis.monthlySalary,
      source: basis.source,
    };
  });
}

function previousDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}

/** Inclusive day count between two ISO dates. */
function inclusiveDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.floor((b - a) / 86400000) + 1;
}

/**
 * Calendar-day-weighted average monthly salary across a window.
 *
 * Provided so the "which salary does a mid-year subsídio use" question can be
 * answered with a real number instead of an argument. NOT wired to any money
 * path — see the module header and docs/NICO_OPEN_QUESTIONS.md A11.
 */
export function timeWeightedMonthlySalary(
  history: readonly SalaryChange[] | undefined | null,
  currentMonthlySalary: number,
  windowStart: string,
  windowEnd: string,
): number {
  const segments = salarySegmentsInPeriod(
    history,
    currentMonthlySalary,
    windowStart,
    windowEnd,
  );
  if (segments.length === 0) return 0;
  const totalDays = inclusiveDays(windowStart, windowEnd);
  if (totalDays <= 0) return 0;

  const weighted = segments.map((segment) =>
    multiplyMoney(segment.monthlySalary, inclusiveDays(segment.from, segment.to) / totalDays),
  );
  return sumMoney(weighted);
}

export interface SalaryIncreaseRow {
  /** 'YYYY-MM' the change took effect — the column the auditor asks for. */
  month: string;
  effectiveFrom: string;
  from: number | null;
  to: number;
  /** Positive for a rise, negative for a cut, null when the prior salary was never recorded. */
  delta: number | null;
  reason?: string;
  recordedAt: string;
  /** True when the change was recorded after it took effect. */
  backdated: boolean;
}

/**
 * The audit deliverable: every recorded pay change with the month it took
 * effect. `from` is null for the earliest entry when no prior salary was
 * captured — reported as unknown rather than guessed.
 */
export function salaryIncreaseSchedule(
  history: readonly SalaryChange[] | undefined | null,
): SalaryIncreaseRow[] {
  const sorted = sortedSalaryHistory(history);
  return sorted.map((change, index) => {
    const previous =
      typeof change.previousMonthlySalary === 'number'
        ? change.previousMonthlySalary
        : index > 0
          ? sorted[index - 1].monthlySalary
          : null;
    return {
      month: monthKey(change.effectiveFrom),
      effectiveFrom: change.effectiveFrom,
      from: previous,
      to: change.monthlySalary,
      delta: previous === null ? null : subtractMoney(change.monthlySalary, previous),
      reason: change.reason,
      recordedAt: change.recordedAt,
      backdated: Boolean(change.recordedAt) && change.recordedAt.slice(0, 10) > change.effectiveFrom,
    };
  });
}

export interface RetroactiveLine {
  /** 'YYYY-MM' the arrears belong to. */
  month: string;
  /** What was payable under the change. */
  newMonthlySalary: number;
  /** What the month was actually paid at. */
  previousMonthlySalary: number;
  amount: number;
}

export interface RetroactiveSuggestion {
  /** Total suggested arrears. Zero when nothing is owed. */
  amount: number;
  lines: RetroactiveLine[];
  /** Changes this suggestion covers, so the caller can stamp them once paid. */
  settles: SalaryChange[];
  /**
   * Effective dates that fall mid-month. The whole months after them ARE
   * included; the part-month is deliberately not computed — see below.
   */
  partialMonths: string[];
}

/**
 * Arrears owed by raises that took effect before this run's period and have not
 * been settled by a paid run.
 *
 * WHOLE MONTHS ONLY, and that is deliberate. The engine pro-rates a partial
 * month of employment by WORKING days (`calculateProRataSalary`), which today
 * assumes a Mon–Fri week — wrong for the many TL employers on the statutory
 * 44-hour six-day week. Rather than inherit that error into a money line, a
 * mid-month effective date reports its whole months and lists the part-month in
 * `partialMonths` for the operator to enter by hand. The corpus instruction this
 * feature exists for is itself whole-month ("retroativos a março").
 *
 * A change already stamped with `retroSettledPeriod` is skipped: paid once,
 * never again.
 */
export function suggestRetroactivePay(
  history: readonly SalaryChange[] | undefined | null,
  currentMonthlySalary: number,
  periodStart: string,
): RetroactiveSuggestion {
  assertISODate(periodStart, 'Period start');
  const empty: RetroactiveSuggestion = {
    amount: 0,
    lines: [],
    settles: [],
    partialMonths: [],
  };

  const sorted = sortedSalaryHistory(history);
  if (sorted.length === 0) return empty;

  const periodMonth = monthKey(periodStart);
  const lines: RetroactiveLine[] = [];
  const settles: SalaryChange[] = [];
  const partialMonths: string[] = [];

  sorted.forEach((change, index) => {
    if (change.retroSettledPeriod) return;
    // Only a change that took effect BEFORE this period can owe arrears; one
    // effective inside the period is simply paid at the new rate.
    if (change.effectiveFrom >= periodStart) return;

    const previous =
      typeof change.previousMonthlySalary === 'number'
        ? change.previousMonthlySalary
        : index > 0
          ? sorted[index - 1].monthlySalary
          : null;
    // No prior salary recorded means no known shortfall. Never assume one.
    if (previous === null) return;

    const delta = subtractMoney(change.monthlySalary, previous);
    if (delta <= 0) {
      // A pay cut owes nothing back, and Xefe never claws pay back
      // automatically. Settled so it stops being re-examined every run.
      settles.push(change);
      return;
    }

    // A mid-month effective date leaves a part-month this function will not
    // price (see the doc comment). Such a change is NEVER stamped settled —
    // stamping it would bury the operator's outstanding part-month.
    const wholeMonthsOnly = isFirstOfMonth(change.effectiveFrom);
    const firstWholeMonth = wholeMonthsOnly
      ? monthKey(change.effectiveFrom)
      : addMonths(monthKey(change.effectiveFrom), 1);
    if (!wholeMonthsOnly) {
      partialMonths.push(change.effectiveFrom);
    }

    const count = monthsBetween(firstWholeMonth, periodMonth);
    for (let i = 0; i < count; i += 1) {
      lines.push({
        month: addMonths(firstWholeMonth, i),
        newMonthlySalary: change.monthlySalary,
        previousMonthlySalary: previous,
        amount: delta,
      });
    }
    if (wholeMonthsOnly) settles.push(change);
  });

  if (lines.length === 0) {
    return { ...empty, settles, partialMonths };
  }

  return {
    amount: sumMoney(lines.map((line) => line.amount)),
    lines,
    settles,
    partialMonths,
  };
}

/** 'YYYY-MM' + n months. */
export function addMonths(month: string, count: number): string {
  const [y, m] = month.split('-').map(Number);
  const zeroBased = (y * 12 + (m - 1)) + count;
  const year = Math.floor(zeroBased / 12);
  const monthNumber = (zeroBased % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(monthNumber).padStart(2, '0')}`;
}

/**
 * Append a change, keeping the array sorted and capturing the salary it
 * replaced. Returns a NEW array — callers write it back on the employee doc in
 * the same update that moves `compensation.monthlySalary`, so the current salary
 * and its history can never disagree.
 */
export function appendSalaryChange(
  history: readonly SalaryChange[] | undefined | null,
  change: Omit<SalaryChange, 'previousMonthlySalary'> & {
    previousMonthlySalary?: number;
  },
  currentMonthlySalary: number,
): SalaryChange[] {
  assertISODate(change.effectiveFrom, 'Effective date');
  const sorted = sortedSalaryHistory(history);
  const priorBasis = salaryOnDate(sorted, currentMonthlySalary, change.effectiveFrom);
  const previous =
    typeof change.previousMonthlySalary === 'number'
      ? change.previousMonthlySalary
      : priorBasis.source === 'recorded'
        ? priorBasis.monthlySalary
        : currentMonthlySalary;

  return sortedSalaryHistory([
    ...sorted,
    { ...change, previousMonthlySalary: previous },
  ]);
}

/**
 * Decide whether an employee-form save is a pay change, and return the new
 * history if it is.
 *
 * Returns null — meaning "leave the existing history alone" — when this is a
 * first-time set, an unchanged salary, or a missing effective date. Deliberately
 * the same shape as `appendContractRenewal` in lib/probation.ts, so both
 * append-only histories on the employee doc behave identically: the caller
 * spreads the result only when it is non-null.
 *
 * A pay CUT is recorded too. The history is a record of what was agreed, not a
 * list of good news, and an auditor asking for "detalhe dos aumentos salariais"
 * still needs the year's movements to reconcile.
 */
export function recordSalaryChange(
  existing: readonly SalaryChange[] | undefined | null,
  previousMonthlySalary: number | undefined,
  newMonthlySalary: number,
  effectiveFrom: string,
  recordedAt: string,
  options?: { recordedBy?: string; reason?: string },
): SalaryChange[] | null {
  if (typeof previousMonthlySalary !== 'number' || !Number.isFinite(previousMonthlySalary)) {
    return null;
  }
  if (!Number.isFinite(newMonthlySalary)) return null;
  if (newMonthlySalary === previousMonthlySalary) return null;
  if (!effectiveFrom || !ISO_DATE.test(effectiveFrom)) return null;

  return appendSalaryChange(
    existing,
    {
      effectiveFrom,
      monthlySalary: newMonthlySalary,
      previousMonthlySalary,
      recordedAt,
      ...(options?.recordedBy ? { recordedBy: options.recordedBy } : {}),
      ...(options?.reason ? { reason: options.reason } : {}),
    },
    previousMonthlySalary,
  );
}

/**
 * 'YYYY-MM' keys of the changes a paid run settled, ready to stamp back onto the
 * matching history entries. Keyed by effective date because that is unique per
 * change within an employee's history.
 */
export function settledEffectiveDates(suggestion: RetroactiveSuggestion): string[] {
  return suggestion.settles.map((change) => change.effectiveFrom);
}

/**
 * Stamp `retroSettledPeriod` on the changes a run settled. Pure, so the caller
 * writes the result inside whatever transaction marks the run paid.
 */
export function stampRetroSettled(
  history: readonly SalaryChange[] | undefined | null,
  effectiveDates: readonly string[],
  periodMonth: string,
): SalaryChange[] {
  const settle = new Set(effectiveDates);
  return sortedSalaryHistory(history).map((change) =>
    settle.has(change.effectiveFrom) && !change.retroSettledPeriod
      ? { ...change, retroSettledPeriod: periodMonth }
      : change,
  );
}
