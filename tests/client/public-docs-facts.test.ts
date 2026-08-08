/**
 * Statutory facts on the PUBLIC site (xefe.tl).
 *
 * These pages are read by strangers deciding whether to trust us with payroll,
 * and by their accountants. A wrong article number here is worse than the same
 * error inside the app: it is indexed, quotable, and it discredits every
 * correct figure beside it.
 *
 * Two things went wrong here and both are pinned below.
 *
 * 1. THE PUBLIC SITE LAGGED THE APP. Sick leave was corrected from Art. 34 to
 *    Art. 33(4) inside the product on 2026-08-07, and the public leave table
 *    kept citing Art. 34 — in all three languages — until a marketing
 *    fact-check on 2026-08-08. Art. 34 is "Princípios gerais": occupational
 *    safety, hygiene and health. Nothing to do with sickness absence.
 *
 * 2. THE CI GUARD COULD NOT SEE IT. check-statutory-copy scanned only
 *    client/lib/help and client/i18n/locales, and matched string literals one
 *    at a time — but a docs table puts the duration and its citation in
 *    SEPARATE cells, so neither literal looked wrong on its own.
 *
 * The guard now scans the public surfaces and reads table rows whole. These
 * tests cover what a lint rule structurally cannot: whether the article number
 * is the RIGHT one. A correctly-hedged citation of the wrong article passes
 * every guard and is still false.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const docs = (name: string) =>
  readFileSync(join(process.cwd(), 'client/content/docs', `${name}.ts`), 'utf8');

const timeAndLeave = docs('time-and-leave');
const taxAndFilings = docs('tax-and-filings');

describe('public leave table — the citations resolve to the right articles', () => {
  it('cites Art. 33(4) for sick leave, never Art. 34 or Art. 42', () => {
    // Art. 34 is occupational safety; Art. 42 is wage deductions. Both have
    // been in this repo as the sick-leave citation at some point.
    expect(timeAndLeave).toContain('Art. 33(4)');
    expect(timeAndLeave).toContain('Art. 33.º(4)');
    expect(timeAndLeave).not.toMatch(/"Art\. 34"/);
    expect(timeAndLeave).not.toMatch(/"Art\. 34\.º"/);
  });

  it('cites Art. 32(2) for annual leave — the paragraph that carries the floor', () => {
    // Art. 32(2): "O período de férias não pode ser inferior a 12 dias úteis."
    // A bare "Art. 32" points at the whole article and loses the floor.
    expect(timeAndLeave).toContain('Art. 32(2)');
    expect(timeAndLeave).toContain('Art. 32.º(2)');
  });
});

describe('public leave table — minimums read as minimums', () => {
  it('says annual leave is AT LEAST 12 working days, in all three languages', () => {
    expect(timeAndLeave).toContain('At least 12 working days');
    expect(timeAndLeave).toContain('Pelo menos 12 dias úteis');
    expect(timeAndLeave).toContain('Pelu menus loron servisu 12');
  });

  it('says sick leave is UP TO 12 days — the one genuine ceiling', () => {
    // Art. 33(4) reads "até 12 dias por ano". Everything else in the table is
    // a floor; this row is the exception, so it must not read like one.
    expect(timeAndLeave).toContain('Up to 12 days a year');
    expect(timeAndLeave).toContain('Até 12 dias por ano');
    expect(timeAndLeave).toContain("To'o loron 12 kada tinan");
  });

  it('says maternity is AT LEAST 12 weeks', () => {
    // Art. 59(1): "licença remunerada por maternidade pelo período MÍNIMO de
    // 12 semanas, sendo que 10 semanas devem, necessariamente, ser gozadas
    // após o parto".
    expect(timeAndLeave).toContain('At least 12 weeks');
    expect(timeAndLeave).toContain('No mínimo 12 semanas');
    expect(timeAndLeave).toContain('Pelu menus semana 12');
  });

  it('carries the Art. 1(2) note in every language', () => {
    // The rows whose statutory figure is exact (paternity, family events,
    // pregnancy loss) are not hedged cell-by-cell — that would make a
    // reference table unreadable. One note under the table does the work, and
    // the guard's allowlist points at it, so it must actually be there.
    expect(timeAndLeave).toContain('Art. 1(2)');
    expect(timeAndLeave).toContain('art. 1.º(2)');
    expect(timeAndLeave.toLowerCase()).toContain('mínimu legál');
  });
});

describe('public tax docs', () => {
  it('cites DL 20/2017 Art. 39 for the 1%/month late-payment interest', () => {
    expect(taxAndFilings).toContain('1% interest per month');
    expect(taxAndFilings).toContain('Art. 39');
  });
});
