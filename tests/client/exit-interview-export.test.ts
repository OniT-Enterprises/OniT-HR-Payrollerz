import { describe, expect, it } from 'vitest';
import {
  EXIT_INTERVIEW_CSV_COLUMNS,
  hasExitInterviewAnswers,
  toExitInterviewRows,
  type ExitInterviewCaseSource,
} from '@/lib/hiring/exit-interview-export';

/**
 * Exit-interview export — pure row mapping behind the Offboarding page's
 * "Exit interviews" read-only list + CSV export. Answers are captured live
 * per-field by the page; this module only flattens what is stored.
 */

const fullCase: ExitInterviewCaseSource = {
  employeeName: 'Maria Soares',
  department: 'Kitchen',
  departureReason: 'contract_end',
  lastWorkingDay: '2026-06-30',
  exitInterview: {
    overallSatisfaction: 'very-satisfied',
    managerRelationship: 'good',
    primaryReason: '  Moving to Baucau  ',
    suggestions: 'More training',
    wouldRecommend: 'yes',
    additionalComments: 'Thanks for everything',
  },
};

describe('hasExitInterviewAnswers', () => {
  it('is false when the interview is missing or null', () => {
    expect(hasExitInterviewAnswers({})).toBe(false);
    expect(hasExitInterviewAnswers({ exitInterview: null })).toBe(false);
  });

  it('is false when every answer is empty or whitespace-only', () => {
    expect(
      hasExitInterviewAnswers({
        exitInterview: {
          overallSatisfaction: '',
          managerRelationship: '',
          primaryReason: '   ',
          suggestions: '',
          wouldRecommend: '',
          additionalComments: '',
        },
      }),
    ).toBe(false);
  });

  it('is true as soon as any single answer is recorded', () => {
    expect(
      hasExitInterviewAnswers({ exitInterview: { wouldRecommend: 'maybe' } }),
    ).toBe(true);
    expect(
      hasExitInterviewAnswers({ exitInterview: { primaryReason: 'Better pay' } }),
    ).toBe(true);
  });
});

describe('toExitInterviewRows', () => {
  it('drops cases without answers and preserves input order', () => {
    const rows = toExitInterviewRows([
      { ...fullCase, employeeName: 'First' },
      { employeeName: 'No Interview', exitInterview: null },
      { ...fullCase, employeeName: 'Second' },
    ]);
    expect(rows.map((r) => r.employeeName)).toEqual(['First', 'Second']);
  });

  it('maps stored slugs to readable labels and trims free text', () => {
    const [row] = toExitInterviewRows([fullCase]);
    expect(row).toEqual({
      employeeName: 'Maria Soares',
      department: 'Kitchen',
      lastWorkingDay: '2026-06-30',
      departureReason: 'Contract end',
      overallSatisfaction: 'Very satisfied',
      managerRelationship: 'Good',
      primaryReason: 'Moving to Baucau',
      wouldRecommend: 'Yes',
      additionalComments: 'Thanks for everything — More training',
    });
  });

  it('passes unknown slugs through unchanged instead of dropping them', () => {
    const [row] = toExitInterviewRows([
      {
        employeeName: 'X',
        departureReason: 'sabbatical',
        exitInterview: { overallSatisfaction: 'ambivalent', wouldRecommend: 'ask-me-later' },
      },
    ]);
    expect(row.departureReason).toBe('sabbatical');
    expect(row.overallSatisfaction).toBe('ambivalent');
    expect(row.wouldRecommend).toBe('ask-me-later');
  });

  it('renders missing fields as empty strings, never undefined', () => {
    const [row] = toExitInterviewRows([
      { exitInterview: { wouldRecommend: 'no' } },
    ]);
    expect(row.employeeName).toBe('');
    expect(row.department).toBe('');
    expect(row.lastWorkingDay).toBe('');
    expect(row.departureReason).toBe('');
    expect(row.primaryReason).toBe('');
    expect(row.additionalComments).toBe('');
    expect(row.wouldRecommend).toBe('No');
  });
});

describe('EXIT_INTERVIEW_CSV_COLUMNS', () => {
  it('every column key exists on the produced rows (no dead CSV headers)', () => {
    const [row] = toExitInterviewRows([fullCase]);
    for (const col of EXIT_INTERVIEW_CSV_COLUMNS) {
      expect(row).toHaveProperty(col.key);
    }
  });

  it('covers every row field (no captured answer is silently un-exported)', () => {
    const [row] = toExitInterviewRows([fullCase]);
    const columnKeys = EXIT_INTERVIEW_CSV_COLUMNS.map((c) => c.key as string).sort();
    expect(Object.keys(row).sort()).toEqual(columnKeys);
  });
});
