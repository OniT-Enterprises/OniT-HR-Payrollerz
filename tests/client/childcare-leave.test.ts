/**
 * Lei 4/2012 Art. 64 — falta para assistência a filhos.
 *
 *   1. "Os trabalhadores com filhos menores de 10 anos têm direito a faltar ao
 *      trabalho, até ao limite máximo de 5 dias por ano, para prestar
 *      assistência, inadiável e imprescindível, em caso de doença ou acidente
 *      daquele, devendo apresentar justificação."
 *   2. "O direito a faltar atribuído no número anterior determina APENAS a
 *      perda de remuneração relativa aos dias em causa."
 *
 * Two facts carry money and both are easy to lose silently:
 *
 *   - The days are UNPAID. A leave type that defaults to paid is how payroll
 *     quietly pays five days a year it never owed.
 *   - "Apenas" bounds the consequence. The absence costs that day's pay and
 *     NOTHING more, so it must never be drawn from annual leave nor recorded
 *     as unjustified. Xefe honours that by giving it its own entitlement
 *     bucket rather than netting it off another one.
 *
 * A new leave type also has to be added in ~10 places at once, and the two
 * that fail SILENTLY are pinned here by source: settingsService hydration
 * (miss it and every existing tenant reads `undefined`) and the entitlement
 * table inside Cloud Functions (miss it and the balance projection is 0).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TL_DEFAULT_LEAVE_POLICIES } from '../../client/types/settings';
import { TL_LEAVE_TYPES } from '../../client/services/leaveService';

const read = (rel: string) =>
  readFileSync(join(process.cwd(), rel), 'utf8');

const policy = TL_DEFAULT_LEAVE_POLICIES.childcareLeave;
const catalogue = TL_LEAVE_TYPES.find((type) => type.id === 'childcare');

describe('Art. 64 childcare leave — the statutory shape', () => {
  it('grants the 5 days the statute puts a floor under', () => {
    expect(policy.daysPerYear).toBe(5);
  });

  it('is unpaid, so payroll never pays it by default', () => {
    // Art. 64(2). An employer may still choose to pay it — that is a
    // deliberate, configured act, never what an untouched tenant gets.
    expect(policy.isPaid).toBe(false);
    expect(policy.paidPercentage).toBe(0);
  });

  it('asks for the justification the statute requires', () => {
    // "devendo apresentar justificação" — Art. 64(1), final clause.
    expect(policy.requiresCertificate).toBe(true);
  });

  it('does not carry over — the entitlement is per year', () => {
    expect(policy.carryOverAllowed).toBe(false);
  });
});

describe('Art. 64 childcare leave — the two copies agree', () => {
  it('is offered as a requestable type', () => {
    expect(catalogue).toBeDefined();
  });

  it('states the same days and the same pay as the policy default', () => {
    // The request form reads one of these and the balance engine the other.
    // When they drift, a worker is told one number and paid against another.
    expect(catalogue?.daysPerYear).toBe(policy.daysPerYear);
    expect(catalogue?.isPaid).toBe(policy.isPaid);
    expect(catalogue?.requiresCertificate).toBe(policy.requiresCertificate);
  });

  it('cites the article in the name a worker actually reads', () => {
    expect(catalogue?.name).toContain('Art. 64');
  });
});

describe('Art. 64 childcare leave — the silent-failure sync points', () => {
  it('is hydrated onto tenants saved before the type existed', () => {
    // settingsService merges each stored slice over the defaults one key at a
    // time. A type absent from that list is `undefined` for every tenant that
    // ever saved settings — which is all of them.
    expect(read('client/services/settingsService.ts')).toContain(
      'childcareLeave: {',
    );
  });

  it('has a server-side entitlement, so the balance is not zero', () => {
    const functions = read('functions/src/timeleave.ts');
    expect(functions).toContain('childcare: 5');
    expect(functions).toContain('"childcareLeave"');
  });

  it('is unpaid on the server too, even when unconfigured', () => {
    // leavePayFraction falls through to PAID for anything not named here, so
    // omission would pay the day rather than merely fail to find it.
    expect(read('functions/src/timeleave.ts')).toContain(
      'leaveType === "childcare"',
    );
  });

  it('is accepted by the mobile and bot request paths', () => {
    expect(read('server/xefe-api/index.js')).toContain("'childcare'");
    expect(read('mobile/ekipa/types/leave.ts')).toContain("'childcare'");
  });
});
