/**
 * Recurring-deduction wiring for payroll runs (pure, Firebase-free).
 *
 * The Deductions & Advances register (top-level `recurringDeductions`
 * collection, see client/pages/payroll/DeductionsAdvances.tsx) holds
 * advances, loans, court orders and other recurring deductions. This module
 * turns those docs into the engine's per-employee deduction inputs
 * (`loanRepayment` / `advanceRepayment` / `courtOrders` / `otherDeductions`,
 * see TLPayrollInput in calculations-tl.ts) and, after a run is PAID, into
 * the register updates that settle it (decrement `remainingBalance`, stamp
 * `lastAppliedPeriod`, complete exhausted advances).
 *
 * Invariants:
 * - A deduction is taken at most once per PERIOD MONTH ('YYYY-MM' of the
 *   run's periodStart), not once per run — `lastAppliedPeriod` is the guard,
 *   stamped only when a run that actually withheld it is marked paid.
 * - A balance-tracked deduction (an advance created with a total amount)
 *   never withholds more than its remaining balance, and its balance never
 *   goes below zero.
 * - Settlement decrements by what the run's frozen records actually withheld
 *   (post 30%-cap), never by the scheduled installment.
 *
 * Kept Firebase-free so vitest can run it in CI (no VITE_FIREBASE env).
 */

import { addMoney, multiplyMoney, subtractMoney } from "@/lib/currency";

/** Structural subset of RecurringDeduction (client/types/payroll.ts). */
export interface RecurringDeductionLike {
  id?: string;
  employeeId: string;
  type: string;
  /** Flat installment per period month (0 when percentage-based). */
  amount: number;
  isPercentage?: boolean;
  /** Percent of monthly salary, when isPercentage. */
  percentage?: number;
  startDate?: string;
  endDate?: string;
  /** Outstanding balance for advances created with a total amount. */
  remainingBalance?: number;
  /** Original advance total; > 0 marks the doc as balance-tracked. */
  totalAmount?: number;
  status: string;
  /** 'YYYY-MM' of the last paid run that took this deduction. */
  lastAppliedPeriod?: string;
}

/** One register doc resolved to the amount scheduled for this run. */
export interface ScheduledDeduction {
  id: string;
  employeeId: string;
  type: string;
  /** min(installment, remainingBalance) — may be Infinity for percentage
   * docs resolved without a salary base (settlement mode). */
  amount: number;
  /** True when remainingBalance is authoritative (advance with a total). */
  tracksBalance: boolean;
  /** Pre-run balance, present when tracksBalance. */
  remainingBalance?: number;
}

/** The four engine input slots fed by the register. */
export interface EmployeeRecurringInputs {
  loanRepayment: number;
  advanceRepayment: number;
  courtOrders: number;
  otherDeductions: number;
}

export interface ResolveOptions {
  /** Run period, ISO dates. periodStart's 'YYYY-MM' is the period month. */
  periodStart: string;
  periodEnd: string;
  /** Monthly salary per employeeId — the base for percentage docs. When a
   * percentage doc's employee is missing here the doc is SKIPPED (input
   * building must never guess a base), unless `unboundedPercentages`. */
  salaryByEmployee?: Record<string, number>;
  /** Settlement mode: percentage docs resolve to an Infinity ceiling instead
   * of being skipped — the actually-withheld pool (from the run's records)
   * bounds them, so no salary base is needed at paid time. */
  unboundedPercentages?: boolean;
}

/** Engine slot for a register doc type; null = never fed from the register
 * (statutory/attendance types are engine-computed — feeding them again via
 * `otherDeductions` would double-deduct). */
export function engineSlotForType(
  type: string,
): keyof EmployeeRecurringInputs | null {
  switch (type) {
    case "loan_repayment":
      return "loanRepayment";
    case "advance_repayment":
      return "advanceRepayment";
    case "court_order":
      return "courtOrders";
    case "income_tax":
    case "inss_employee":
    case "inss_employer":
    case "absence":
    case "late_arrival":
      return null;
    default:
      // health_insurance, life_insurance, other, unknown custom types
      return "otherDeductions";
  }
}

const PERIOD_MONTH_RE = /^\d{4}-\d{2}$/;

export function periodMonthOf(periodStart: string): string {
  return (periodStart || "").slice(0, 7);
}

/**
 * Filter the register down to the deductions this run should take, each with
 * its scheduled amount. Rules: active status only; skip docs already taken
 * this period month (lastAppliedPeriod); skip docs whose start/end window
 * misses the period; balance-tracked docs take min(installment, remaining)
 * and are skipped once exhausted. Deterministic order (employeeId, then
 * balance-tracked first, then id) so cap allocation and settlement agree.
 */
export function resolveScheduledDeductions(
  deductions: RecurringDeductionLike[],
  options: ResolveOptions,
): ScheduledDeduction[] {
  const periodMonth = periodMonthOf(options.periodStart);
  if (!PERIOD_MONTH_RE.test(periodMonth)) return [];

  const scheduled: ScheduledDeduction[] = [];
  for (const doc of deductions) {
    if (!doc.id || !doc.employeeId) continue;
    if (doc.status !== "active") continue;
    if (engineSlotForType(doc.type) === null) continue;
    // Once per period month — not once per run.
    if (doc.lastAppliedPeriod === periodMonth) continue;
    // Date window: not started yet / already ended.
    if (doc.startDate && doc.startDate > options.periodEnd) continue;
    if (doc.endDate && doc.endDate < options.periodStart) continue;

    // Balance tracking: only docs created with a total amount (advances) have
    // an authoritative balance. The register UI writes remainingBalance: 0
    // for every other type, so a bare 0 does NOT mean "exhausted" there —
    // those docs are open-ended installments until paused/ended.
    const tracksBalance =
      typeof doc.remainingBalance === "number" && (doc.totalAmount ?? 0) > 0;
    const remaining = tracksBalance ? (doc.remainingBalance as number) : undefined;
    if (tracksBalance && (remaining as number) <= 0) continue; // fully repaid

    let installment: number;
    if (doc.isPercentage && (doc.percentage ?? 0) > 0) {
      const base = options.salaryByEmployee?.[doc.employeeId];
      if (typeof base === "number" && base > 0) {
        installment = multiplyMoney(base, (doc.percentage as number) / 100);
      } else if (options.unboundedPercentages) {
        installment = Number.POSITIVE_INFINITY;
      } else {
        continue; // no base to compute against — never guess
      }
    } else {
      installment = doc.amount;
    }
    if (!(installment > 0)) continue;

    const amount = tracksBalance
      ? Math.min(installment, remaining as number)
      : installment;
    if (!(amount > 0)) continue;

    scheduled.push({
      id: doc.id,
      employeeId: doc.employeeId,
      type: doc.type,
      amount,
      tracksBalance,
      remainingBalance: remaining,
    });
  }

  scheduled.sort((a, b) => {
    if (a.employeeId !== b.employeeId)
      return a.employeeId < b.employeeId ? -1 : 1;
    // Balance-tracked docs first: their ceilings are exact, so they allocate
    // before open-ended/percentage docs at settlement time.
    if (a.tracksBalance !== b.tracksBalance) return a.tracksBalance ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return scheduled;
}

/** Sum scheduled deductions into the engine's four input slots, per employee. */
export function aggregateRecurringInputs(
  scheduled: ScheduledDeduction[],
): Record<string, EmployeeRecurringInputs> {
  const byEmployee: Record<string, EmployeeRecurringInputs> = {};
  for (const item of scheduled) {
    const slot = engineSlotForType(item.type);
    if (!slot) continue;
    if (!Number.isFinite(item.amount)) continue; // settlement-mode Infinity
    const entry = (byEmployee[item.employeeId] ??= {
      loanRepayment: 0,
      advanceRepayment: 0,
      courtOrders: 0,
      otherDeductions: 0,
    });
    entry[slot] = addMoney(entry[slot], item.amount);
  }
  return byEmployee;
}

/** A record's recurring-relevant deduction lines summed per engine slot. */
export type WithheldBySlot = Partial<
  Record<keyof EmployeeRecurringInputs, number>
>;

/** Register update settling one deduction after a run is paid. */
export interface DeductionSettlement {
  id: string;
  /** Amount the run actually withheld toward this doc (post 30%-cap). */
  appliedAmount: number;
  lastAppliedPeriod: string;
  /** New balance (only for balance-tracked docs). */
  remainingBalance?: number;
  /** 'completed' when the balance reaches zero. */
  status?: "completed";
}

/**
 * Allocate what the run's frozen records ACTUALLY withheld (post 30%-cap)
 * back to register docs and produce their settlement updates.
 *
 * The engine emits ONE line per slot per employee, so a cap reduction cannot
 * be attributed per doc; allocation is deterministic instead: docs are
 * processed in resolveScheduledDeductions order (balance-tracked first) and
 * each takes min(scheduled, remaining pool). Docs that end up with nothing
 * withheld are NOT stamped — they stay eligible for the next period month.
 */
export function buildSettlementPlan(
  scheduled: ScheduledDeduction[],
  withheldByEmployee: Record<string, WithheldBySlot>,
  periodMonth: string,
): DeductionSettlement[] {
  if (!PERIOD_MONTH_RE.test(periodMonth)) return [];

  const pools: Record<string, number> = {};
  const poolKey = (employeeId: string, slot: string) => `${employeeId} ${slot}`;
  for (const [employeeId, slots] of Object.entries(withheldByEmployee)) {
    for (const [slot, amount] of Object.entries(slots)) {
      if (typeof amount === "number" && amount > 0) {
        pools[poolKey(employeeId, slot)] = amount;
      }
    }
  }

  const settlements: DeductionSettlement[] = [];
  for (const item of scheduled) {
    const slot = engineSlotForType(item.type);
    if (!slot) continue;
    const key = poolKey(item.employeeId, slot);
    const pool = pools[key] ?? 0;
    if (pool <= 0) continue;
    const applied = Math.min(item.amount, pool);
    if (!(applied > 0)) continue;
    pools[key] = subtractMoney(pool, applied);

    const settlement: DeductionSettlement = {
      id: item.id,
      appliedAmount: applied,
      lastAppliedPeriod: periodMonth,
    };
    if (item.tracksBalance) {
      const newBalance = Math.max(
        0,
        subtractMoney(item.remainingBalance ?? 0, applied),
      );
      settlement.remainingBalance = newBalance;
      if (newBalance <= 0) settlement.status = "completed";
    }
    settlements.push(settlement);
  }
  return settlements;
}

/**
 * Per-employee withheld amounts for the recurring slots, read off saved
 * payroll records' deduction lines (the post-cap source of truth).
 */
export function withheldRecurringByEmployee(
  records: Array<{
    employeeId: string;
    deductions: Array<{ type: string; amount: number }>;
  }>,
): Record<string, WithheldBySlot> {
  const result: Record<string, WithheldBySlot> = {};
  for (const record of records) {
    for (const line of record.deductions || []) {
      const slot = engineSlotForType(line.type);
      if (!slot || !(line.amount > 0)) continue;
      const entry = (result[record.employeeId] ??= {});
      entry[slot] = addMoney(entry[slot] ?? 0, line.amount);
    }
  }
  return result;
}
