import { describe, expect, it } from 'vitest';
import {
  art55Indemnity,
  art55IndemnityMonths,
} from '@/lib/payroll/leaver-final-pay';

/**
 * Lei 4/2012 Art. 55(3) unlawful-dismissal indemnity — REFERENCE calculator.
 *
 * COURT-AWARDED money only: a court must first declare the dismissal unlawful
 * (Arts. 54(2)-(3), 55(1)) and reinstatement must be declined/refused before
 * Art. 55(3) money exists at all. Xefe never pays this through payroll; the
 * offboarding screen shows it purely as an exposure figure.
 *
 * Band table (months of salary by CONTRACT DURATION):
 *   ≤ 1 month            → 0   (below band (a)'s "superior a 1 mês")
 *   > 1 mo  – < 6 mo     → 0.5 (a)
 *   6 mo    – < 1 yr     → 1   (b)
 *   1 yr    – < 2 yr     → 2   (c)
 *   2 yr    – < 3 yr     → 3   (d)
 *   3 yr    – < 4 yr     → 4   (e)
 *   4 yr    – < 5 yr     → 5   (f)
 *   ≥ 5 yr               → 6   (g)
 * Exact interior boundaries (6mo, 1..5yr) are a literal statutory gap
 * ("superior a X mas inferior a Y", both strict) — assigned to the HIGHER
 * band (pro-worker reading).
 *
 * Art. 49(5): the worker's OWN just-cause rescission for employer misconduct
 * (Art. 49(3)(a)-(c)) entitles the worker to DOUBLE the Art. 55 values.
 */

describe('art55IndemnityMonths: Lei 4/2012 Art. 55(3) duration bands', () => {
  it('exactly 1 month of contract → 0 (band (a) requires "superior a 1 mês")', () => {
    expect(art55IndemnityMonths('2025-01-15', '2025-02-15')).toBe(0);
  });

  it('1 month + 1 day → 0.5 (band a)', () => {
    expect(art55IndemnityMonths('2025-01-15', '2025-02-16')).toBe(0.5);
  });

  it('5 months 29 days → 0.5 (still inside band a)', () => {
    expect(art55IndemnityMonths('2025-01-01', '2025-06-30')).toBe(0.5);
  });

  it('exactly 6 months → 1 (boundary gap assigned to the higher band b)', () => {
    expect(art55IndemnityMonths('2025-01-01', '2025-07-01')).toBe(1);
  });

  it('11 months → 1 (band b)', () => {
    expect(art55IndemnityMonths('2025-01-01', '2025-12-01')).toBe(1);
  });

  it('exactly 1 year → 2 (boundary gap assigned to the higher band c)', () => {
    expect(art55IndemnityMonths('2025-01-01', '2026-01-01')).toBe(2);
  });

  it('exactly 2 years → 3 (band d), exactly 3 years → 4 (band e), exactly 4 years → 5 (band f)', () => {
    expect(art55IndemnityMonths('2022-03-10', '2024-03-10')).toBe(3);
    expect(art55IndemnityMonths('2022-03-10', '2025-03-10')).toBe(4);
    expect(art55IndemnityMonths('2022-03-10', '2026-03-10')).toBe(5);
  });

  it('4 years 11 months → 5 (band f)', () => {
    expect(art55IndemnityMonths('2021-01-01', '2025-12-01')).toBe(5);
  });

  it('5 years + 1 day → 6 (band g)', () => {
    expect(art55IndemnityMonths('2020-01-01', '2025-01-02')).toBe(6);
  });

  it('exactly 5 years → 6 (boundary gap assigned to the higher band g)', () => {
    expect(art55IndemnityMonths('2020-01-01', '2025-01-01')).toBe(6);
  });

  it('month-end anniversaries clamp: hired 31 Jan, one month later is end of Feb', () => {
    // 2024 is a leap year: 31 Jan + 1 month clamps to 29 Feb.
    expect(art55IndemnityMonths('2024-01-31', '2024-02-29')).toBe(0); // exactly 1 month
    expect(art55IndemnityMonths('2024-01-31', '2024-03-01')).toBe(0.5); // 1 month + 1 day
  });

  it('invalid or missing dates → 0', () => {
    expect(art55IndemnityMonths('', '2025-06-01')).toBe(0);
    expect(art55IndemnityMonths('2025-01-01', '')).toBe(0);
    expect(art55IndemnityMonths('not-a-date', '2025-06-01')).toBe(0);
    expect(art55IndemnityMonths('2025-02-30', '2025-06-01')).toBe(0); // impossible day
    expect(art55IndemnityMonths('2025-6-1', '2025-12-01')).toBe(0); // not strict YYYY-MM-DD
  });

  it('end on or before hire → 0', () => {
    expect(art55IndemnityMonths('2025-01-01', '2025-01-01')).toBe(0);
    expect(art55IndemnityMonths('2025-06-01', '2025-01-01')).toBe(0);
  });
});

describe('art55Indemnity: money math + Art. 49(5) doubling', () => {
  it('whole-band money: $600 salary, 6-month band → $3,600', () => {
    expect(art55Indemnity(600, '2020-01-01', '2025-06-01')).toBe(3600);
  });

  it('half-month band: $600 salary → $300', () => {
    expect(art55Indemnity(600, '2025-01-01', '2025-04-01')).toBe(300);
  });

  it('doubled (Art. 49(5) worker just-cause rescission) = exactly 2× each band', () => {
    // 0.5-month band → 1 month when doubled
    expect(art55Indemnity(600, '2025-01-01', '2025-04-01', true)).toBe(600);
    // 6-month band → 12 months when doubled
    expect(art55Indemnity(600, '2020-01-01', '2025-06-01', true)).toBe(7200);
  });

  it('cents salary rounds half-up to cents: $543.21 × 0.5 = $271.61', () => {
    expect(art55Indemnity(543.21, '2025-01-01', '2025-04-01')).toBe(271.61);
  });

  it('cents salary, exact multiple: $543.21 × 3 = $1,629.63', () => {
    expect(art55Indemnity(543.21, '2022-01-01', '2024-06-01')).toBe(1629.63);
  });

  it('half-up at the third decimal: $333.33 × 0.5 = $166.67 (not $166.66)', () => {
    expect(art55Indemnity(333.33, '2025-01-01', '2025-04-01')).toBe(166.67);
  });

  it('doubling a cents salary stays exact: $333.33 half-band doubled = $333.33', () => {
    expect(art55Indemnity(333.33, '2025-01-01', '2025-04-01', true)).toBe(333.33);
  });

  it('invalid dates → $0 regardless of salary', () => {
    expect(art55Indemnity(600, '', '2025-06-01')).toBe(0);
    expect(art55Indemnity(600, 'bogus', '2025-06-01', true)).toBe(0);
  });

  it('duration ≤ 1 month → $0', () => {
    expect(art55Indemnity(600, '2025-01-15', '2025-02-15')).toBe(0);
    expect(art55Indemnity(600, '2025-01-15', '2025-02-15', true)).toBe(0);
  });
});

/**
 * The Art. 55 scale is not court-only.
 *
 * The module used to assert, and the customer-facing copy used to repeat,
 * that this money "exists only when a court declares the dismissal unlawful".
 * That is contradicted four times over in Lei 4/2012, each verified verbatim
 * against the Ministry of Justice text:
 *
 *   Art. 15(9)  "tendo o trabalhador direito ao pagamento da indemnização
 *                prevista no artigo 55.º"  — cessation agreed after a
 *                suspension. A handshake, not a dismissal.
 *   Art. 17(3)  "com direito a indemnização, nos termos previstos no artigo
 *                55.º"  — the WORKER rescinds after a harmful transfer.
 *   Art. 45(3)  "conferindo ao trabalhador o direito a ser indemnizado nos
 *                termos do disposto no artigo 55.º"  — dismissal on a
 *                prohibited ground, which is NULO, a different category from
 *                the "ilícito" of Arts. 51/54.
 *   Art. 49(5)  "tendo o trabalhador direito ao DOBRO dos valores indicados
 *                naquele artigo"  — resignation for just cause.
 *
 * A worker told the money is unreachable without a court never asks for what
 * Art. 15(9) gives them by agreement. These assert on source, because the
 * claim lives in prose rather than in a computable value.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

describe('Art. 55 — the court-only claim is gone from code and copy', () => {
  const module = read('client/lib/payroll/leaver-final-pay.ts');

  it('no longer says the indemnity exists only on a court ruling', () => {
    expect(module).not.toContain('it exists only when a court declares');
  });

  it('names all four non-court routes where the same scale is imported', () => {
    for (const article of ['Art. 15(9)', 'Art. 17(3)', 'Art. 45(3)', 'Art. 49(5)']) {
      expect(module, article).toContain(article);
    }
  });

  it('records that the Art. 49(5) doubling is contingent, not settled', () => {
    // Art. 49(6) lets the employer challenge within 60 days and Art. 49(7)
    // can invert the claim onto the worker. Presenting the doubled figure as
    // a settled liability would overstate it.
    expect(module).toContain('Art. 49(6)');
  });

  it('explains why the doubled path is deliberately unreached', () => {
    // Reaching it means rendering the card for a RESIGNATION, and an ordinary
    // resignation is owed nothing — Art. 49(8) carries no indemnity and
    // Art. 49(9) runs the money the other way. Wiring it without gating
    // visibility on the just-cause attestation would invite an employer to
    // pay money that is not owed.
    expect(module).toContain('DELIBERATELY UNREACHED');
    expect(module).toContain('Art. 49(8)');
  });

  it('does not repeat the court-only claim in customer-facing copy', () => {
    for (const locale of ['en', 'pt', 'tet']) {
      const text = read(`client/i18n/locales/${locale}.ts`);
      expect(text, locale).not.toContain('court-awarded if dismissal is ruled unlawful');
    }
    expect(read('client/pages/hiring/Offboarding.tsx')).not.toContain(
      'Not payable through payroll — a court fixes it.',
    );
  });
});
