/**
 * Recurring journal templates — pure date & validation logic
 * (client/lib/accounting/recurring.ts) PLUS the scheduler's real posting flow
 * (functions/src/accounting.ts: templateIsDue, evaluateRecurringTemplate,
 * runRecurringTemplateOnce) driven through in-memory ports, so the code under
 * test is the exact code the nightly Cloud Function executes.
 */
import { describe, it, expect, vi } from 'vitest';

// functions/src/money.ts calls getFirestore() at module scope; stub it so the
// scheduler module can be imported without an initialized Admin app. Only the
// pure exports are exercised here — none of these stubs ever run.
vi.mock('../../functions/src/money', () => ({
  TL_TIMEZONE: 'Asia/Dili',
  getTodayTL: () => '2026-07-19',
  fiscalPeriodIsOpenOrMissing: async () => true,
  allocateNextJournalEntryNumber: async () => 'JE-STUB',
}));

import {
  advanceMonthlyRunDate,
  clampDayToMonth,
  clampNextRunAfterLastPosting,
  daysInMonth,
  firstRunDate,
  validateRecurringTemplate,
} from '@/lib/accounting/recurring';
import {
  evaluateRecurringTemplate,
  runRecurringTemplateOnce,
  templateIsDue,
  type RecurringJournalDoc,
  type RecurringPostingPorts,
  type RecurringPostingWrite,
  type TemplateLine,
} from '../../functions/src/accounting';

describe('recurring run-date math', () => {
  it('advances one month keeping the day', () => {
    expect(advanceMonthlyRunDate('2026-03-15', 15)).toBe('2026-04-15');
  });

  it('clamps a day-31 template in short months and springs back', () => {
    expect(advanceMonthlyRunDate('2026-01-31', 31)).toBe('2026-02-28');
    // sticky dayOfMonth: after the clamped Feb posting, March returns to 31
    expect(advanceMonthlyRunDate('2026-02-28', 31)).toBe('2026-03-31');
  });

  it('handles leap February', () => {
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(advanceMonthlyRunDate('2028-01-30', 30)).toBe('2028-02-29');
  });

  it('rolls December into January of the next year', () => {
    expect(advanceMonthlyRunDate('2026-12-05', 5)).toBe('2027-01-05');
  });

  it('clampDayToMonth bounds the day into [1, days-in-month]', () => {
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);
    expect(clampDayToMonth(2026, 2, 0)).toBe(1);
    expect(clampDayToMonth(2026, 7, 12)).toBe(12);
  });
});

describe('firstRunDate', () => {
  it('runs this month when the day is still ahead', () => {
    expect(firstRunDate('2026-07-10', 25)).toBe('2026-07-25');
  });

  it('runs today when the day is today', () => {
    expect(firstRunDate('2026-07-25', 25)).toBe('2026-07-25');
  });

  it('rolls to next month when the day has passed', () => {
    expect(firstRunDate('2026-07-26', 25)).toBe('2026-08-25');
  });

  it('clamps within the starting month', () => {
    expect(firstRunDate('2026-02-10', 31)).toBe('2026-02-28');
  });
});

describe('clampNextRunAfterLastPosting (updateSchedule guard)', () => {
  it('passes a candidate through when the template never posted', () => {
    expect(clampNextRunAfterLastPosting('2026-07-25', undefined, 25)).toBe('2026-07-25');
  });

  it('keeps a candidate already in a later month than the last posting', () => {
    expect(clampNextRunAfterLastPosting('2026-08-25', '2026-07-31', 25)).toBe('2026-08-25');
  });

  it('pushes a candidate in the last-posted month to the following month', () => {
    expect(clampNextRunAfterLastPosting('2026-07-25', '2026-07-01', 25)).toBe('2026-08-25');
  });

  it('pushes a candidate before the last-posted month forward, day clamped', () => {
    expect(clampNextRunAfterLastPosting('2026-02-28', '2026-03-15', 31)).toBe('2026-04-30');
  });
});

describe('templateIsDue (scheduler due-check)', () => {
  it('is due when nextRunDate has arrived and not past endDate', () => {
    expect(templateIsDue('2026-07-01', '2026-07-19')).toBe(true);
    expect(templateIsDue('2026-07-19', '2026-07-19')).toBe(true);
  });

  it('is not due before nextRunDate, without one, or past endDate', () => {
    expect(templateIsDue('2026-08-01', '2026-07-19')).toBe(false);
    expect(templateIsDue(undefined, '2026-07-19')).toBe(false);
    expect(templateIsDue('2026-07-01', '2026-07-19', '2026-06-30')).toBe(false);
  });
});

describe('validateRecurringTemplate', () => {
  const line = (accountId: string, debit: number, credit: number) => ({ accountId, debit, credit });

  it('accepts a balanced two-line template', () => {
    expect(
      validateRecurringTemplate({
        name: 'Rent accrual',
        dayOfMonth: 1,
        lines: [line('a', 650, 0), line('b', 0, 650)],
      }),
    ).toEqual([]);
  });

  it('rejects unbalanced, empty-name, bad-day and two-sided lines', () => {
    expect(
      validateRecurringTemplate({ name: '', dayOfMonth: 0, lines: [line('a', 100, 0)] }),
    ).toEqual(expect.arrayContaining(['nameRequired', 'dayOfMonthInvalid', 'twoLinesRequired', 'unbalanced']));
    expect(
      validateRecurringTemplate({
        name: 'x',
        dayOfMonth: 5,
        lines: [line('a', 100, 50), line('b', 0, 50)],
      }),
    ).toContain('oneSidedLines');
    expect(
      validateRecurringTemplate({
        name: 'x',
        dayOfMonth: 5,
        lines: [line('', 100, 0), line('b', 0, 100)],
      }),
    ).toContain('accountRequired');
  });

  it('is cent-exact on balance comparison', () => {
    expect(
      validateRecurringTemplate({
        name: 'x',
        dayOfMonth: 5,
        lines: [line('a', 0.1, 0), line('b', 0.2, 0), line('c', 0, 0.3)],
      }),
    ).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Scheduler posting flow — the Cloud Function's own decision code
// (runRecurringTemplateOnce is the transaction body of postDueTemplate),
// run against an in-memory Firestore stand-in.
// ──────────────────────────────────────────────────────────────────────────

const TODAY = '2026-07-19';

const tplLine = (
  lineNumber: number,
  accountId: string,
  debit: number,
  credit: number,
): TemplateLine => ({
  lineNumber,
  accountId,
  accountCode: `AC-${accountId}`,
  accountName: `Account ${accountId}`,
  debit,
  credit,
});

function rentTemplate(overrides: Partial<RecurringJournalDoc> = {}): RecurringJournalDoc {
  return {
    name: 'Rent accrual',
    lines: [tplLine(1, 'exp', 650, 0), tplLine(2, 'pay', 0, 650)],
    totalDebit: 650,
    totalCredit: 650,
    dayOfMonth: 1,
    nextRunDate: '2026-07-01',
    active: true,
    postedCount: 0,
    ...overrides,
  };
}

interface MemoryState {
  template: RecurringJournalDoc | null;
  guards: Set<string>;
  postings: RecurringPostingWrite[];
  /** Defaults to every period open. */
  periodIsOpen?: (dateISO: string) => boolean;
}

function memoryState(template: RecurringJournalDoc | null): MemoryState {
  return { template, guards: new Set(), postings: [] };
}

function memoryPorts(state: MemoryState): RecurringPostingPorts {
  let entrySeq = 0;
  return {
    getTemplate: async () => state.template,
    guardExists: async (guardId) => state.guards.has(guardId),
    fiscalPeriodIsOpen: async (dateISO) =>
      state.periodIsOpen ? state.periodIsOpen(dateISO) : true,
    allocateEntryNumber: async (year) => `JE-${year}-${String(++entrySeq).padStart(3, '0')}`,
    writePosting: (posting) => {
      state.guards.add(posting.guardId);
      state.postings.push(posting);
    },
    updateTemplate: (fields) => {
      state.template = { ...(state.template as RecurringJournalDoc), ...fields };
    },
  };
}

describe('runRecurringTemplateOnce (CF poster)', () => {
  it('posts a balanced entry and records the (template, period) guard', async () => {
    const state = memoryState(rentTemplate());
    const outcome = await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(state));

    expect(outcome).toBe('posted');
    expect(state.postings).toHaveLength(1);
    const posting = state.postings[0];

    // The generated entry balances, line-sum and totals alike.
    const debits = posting.lines.reduce((s, l) => s + l.debit, 0);
    const credits = posting.lines.reduce((s, l) => s + l.credit, 0);
    expect(debits).toBe(credits);
    expect(posting.totalDebit).toBe(650);
    expect(posting.totalCredit).toBe(650);
    expect(posting.postDate).toBe('2026-07-01');
    expect(posting.fiscalYear).toBe(2026);
    expect(posting.fiscalPeriod).toBe(7);
    expect(posting.description).toBe('Rent accrual');
    expect(posting.entryNumber).toBe('JE-2026-001');

    // Guard doc claimed for exactly this template + period.
    expect(posting.guardId).toBe('tpl1_2026-07');
    expect(state.guards.has('tpl1_2026-07')).toBe(true);

    // Posting trail advanced.
    expect(state.template?.nextRunDate).toBe('2026-08-01');
    expect(state.template?.lastRunDate).toBe('2026-07-01');
    expect(state.template?.lastEntryNumber).toBe('JE-2026-001');
    expect(state.template?.postedCount).toBe(1);
  });

  it('drops zero-amount lines from the posted entry', async () => {
    const state = memoryState(
      rentTemplate({
        lines: [tplLine(1, 'exp', 650, 0), tplLine(2, 'pay', 0, 650), tplLine(3, 'memo', 0, 0)],
      }),
    );
    const outcome = await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(state));
    expect(outcome).toBe('posted');
    expect(state.postings[0].lines).toHaveLength(2);
  });

  it('never double-posts the same period: a second run is not due, and a rewound nextRunDate hits the guard', async () => {
    const state = memoryState(rentTemplate());
    const ports = memoryPorts(state);

    expect(await runRecurringTemplateOnce('tpl1', TODAY, ports)).toBe('posted');
    // Natural re-run the same night: nextRunDate already moved to August.
    expect(await runRecurringTemplateOnce('tpl1', TODAY, ports)).toBe('not_due');
    expect(state.postings).toHaveLength(1);

    // A schedule edit rewinds nextRunDate into the already-posted month
    // (the exact bug the guard exists for) — the guard blocks the duplicate
    // and the pointer is pushed forward past the posted period.
    state.template = { ...(state.template as RecurringJournalDoc), nextRunDate: '2026-07-15' };
    expect(await runRecurringTemplateOnce('tpl1', TODAY, ports)).toBe('already_posted');
    expect(state.postings).toHaveLength(1);
    expect(state.guards.size).toBe(1);
    expect(state.template?.nextRunDate).toBe('2026-08-01');
    expect(state.template?.postedCount).toBe(1);
  });

  it('rejects a template whose line carries both a debit and a credit (false balance) and deactivates it', async () => {
    // Both totals inflate equally (150 == 150) so a plain totals check passes,
    // but no real journal has two-sided lines.
    const twoSided = rentTemplate({
      lines: [tplLine(1, 'a', 100, 100), tplLine(2, 'b', 50, 50)],
    });
    // Parity: the client validator refuses the same shape.
    expect(
      validateRecurringTemplate({
        name: 'x',
        dayOfMonth: 1,
        lines: twoSided.lines!.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit })),
      }),
    ).toContain('oneSidedLines');

    const state = memoryState(twoSided);
    const outcome = await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(state));
    expect(outcome).toBe('invalid');
    expect(state.postings).toHaveLength(0);
    expect(state.guards.size).toBe(0);
    expect(state.template?.active).toBe(false);
  });

  it('rejects an unbalanced template and deactivates it', async () => {
    const state = memoryState(
      rentTemplate({ lines: [tplLine(1, 'a', 100, 0), tplLine(2, 'b', 0, 90)] }),
    );
    expect(await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(state))).toBe('invalid');
    expect(state.postings).toHaveLength(0);
    expect(state.template?.active).toBe(false);
  });

  it('does not post into a closed fiscal period — skips past it instead', async () => {
    const state = memoryState(rentTemplate());
    state.periodIsOpen = (dateISO) => !dateISO.startsWith('2026-07');

    const outcome = await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(state));
    expect(outcome).toBe('period_locked');
    expect(state.postings).toHaveLength(0);
    expect(state.guards.size).toBe(0);
    expect(state.template?.nextRunDate).toBe('2026-08-01');
    // Not deactivated — it posts again once past the lock.
    expect(state.template?.active).toBe(true);
  });

  it('does not post a paused template', async () => {
    const state = memoryState(rentTemplate({ active: false }));
    expect(await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(state))).toBe('inactive');
    expect(state.postings).toHaveLength(0);
    expect(state.template?.nextRunDate).toBe('2026-07-01'); // untouched
  });

  it('does not post an ended template and deactivates it', async () => {
    const state = memoryState(rentTemplate({ endDate: '2026-06-30' }));
    expect(await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(state))).toBe('ended');
    expect(state.postings).toHaveLength(0);
    expect(state.template?.active).toBe(false);
  });

  it('reports not_due before nextRunDate and missing when the template is gone', async () => {
    const notDue = memoryState(rentTemplate({ nextRunDate: '2026-08-01' }));
    expect(await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(notDue))).toBe('not_due');
    expect(notDue.postings).toHaveLength(0);

    const missing = memoryState(null);
    expect(await runRecurringTemplateOnce('tpl1', TODAY, memoryPorts(missing))).toBe('missing');
  });
});

describe('evaluateRecurringTemplate', () => {
  it('derives period, guard id and the advanced (sticky-day) nextRunDate', () => {
    const evaln = evaluateRecurringTemplate(
      'tplX',
      rentTemplate({ dayOfMonth: 31, nextRunDate: '2026-01-31' }),
      '2026-02-01',
    );
    expect(evaln.outcome).toBe('due');
    if (evaln.outcome === 'due') {
      expect(evaln.period).toBe('2026-01');
      expect(evaln.guardId).toBe('tplX_2026-01');
      expect(evaln.nextRunDate).toBe('2026-02-28'); // clamped, springs back later
    }
  });

  it('is cent-exact on the balance check', () => {
    const evaln = evaluateRecurringTemplate(
      'tplX',
      rentTemplate({
        lines: [tplLine(1, 'a', 0.1, 0), tplLine(2, 'b', 0.2, 0), tplLine(3, 'c', 0, 0.3)],
      }),
      TODAY,
    );
    expect(evaln.outcome).toBe('due');
    if (evaln.outcome === 'due') {
      expect(evaln.totalDebit).toBe(0.3);
      expect(evaln.totalCredit).toBe(0.3);
    }
  });
});
