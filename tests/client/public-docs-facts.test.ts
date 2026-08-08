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

/**
 * The six defects a five-lens fact-check of xefe.tl found on 2026-08-08.
 *
 * The money was never the problem — an agent re-ran the specimen payslip
 * through the real engine and all thirteen figures footed to the cent, with a
 * balanced journal. What was wrong was the AUTHORITY attached to the
 * arithmetic and the BEHAVIOUR attributed to the product.
 *
 * Three of the six were the same failure: a fix landed in the app and never
 * reached the public copy. That is the pattern worth guarding, not the
 * individual sentences.
 */
const engine = readFileSync(join(process.cwd(), 'client/pages/XefeEngine.tsx'), 'utf8');
const gettingStarted = docs('getting-started');

describe('/engine — article badges point at the right articles', () => {
  it('cites Art. 33(4) for sick pay, not Art. 42', () => {
    // Art. 42 is "Descontos na remuneração" — wage deductions — and the row
    // directly BELOW this one correctly cites Art. 42(3) for the 30% ceiling.
    // The page was using one article for two unrelated rules, one row apart,
    // on the one page whose whole pitch is that the statute sits next to the
    // arithmetic it governs.
    expect(engine).toContain('art: "Art. 33(4)"');
    expect(engine).not.toContain('art: "Art. 42"');
    expect(engine).toContain('art: "Art. 42(3)"'); // the correct neighbour survives
  });

  it('gives night work its own Art. 28 row', () => {
    // Art. 28 "Trabalho noturno" — 21:00 to 06:00 at +25%. Art. 27 has six
    // paragraphs and no night provision, so bundling them meant a reader who
    // opened Art. 27 could not tell which of the three rates was the bad one,
    // and discounted the two correct ones with it.
    expect(engine).toContain('art: "Art. 28"');
    expect(engine).toContain('enginePage.law.labour.night');
  });

  it('pins the overtime cap to the paragraph that contains it', () => {
    expect(engine).toContain('art: "Art. 27(4)"');
  });
});

describe('public docs — the rest day is not Sunday', () => {
  it('never attaches the double premium to Sunday alone', () => {
    // Art. 27(2) attaches it to "dia de descanso semanal"; "domingo" appears
    // nowhere in Art. 27. The engine was corrected the same day (see
    // resolveRestWeekday) — this copy was publishing a WORSE product than the
    // one we shipped, to the hospitality and retail businesses that are the
    // core market.
    expect(timeAndLeave).not.toContain('Sunday or public-holiday premiums');
    expect(timeAndLeave).not.toContain('adicionais de domingo ou feriado');
    expect(timeAndLeave).not.toContain('adisional Domingu ka feriadu');
  });

  it('says the double rate follows the company rest day', () => {
    expect(timeAndLeave).toContain('rest-day or public-holiday premiums');
    expect(timeAndLeave).toContain('dia de descanso semanal ou feriado');
    expect(timeAndLeave).toContain('loron deskansa semanál ka feriadu');
  });
});

describe('public docs — leave counts against the configured week', () => {
  it('no longer claims weekends never consume a balance', () => {
    // Art. 30(1) grants ONE rest period, and a lawful week of up to 44 hours
    // (Art. 25(1)) cannot fit into five 8-hour days — a fact this same site
    // publishes on two other pages. On a six-day week a Saturday of leave IS
    // deducted, and the old wording inflated every balance, which is then
    // CASHED OUT at termination under Art. 32.
    expect(timeAndLeave).not.toContain("weekends and public holidays don't count");
    expect(timeAndLeave).not.toContain('fins de semana e feriados não contam');
    expect(timeAndLeave).toContain('follows the working week you set in Settings');
  });

  it('states the 44 hours as the cap it is', () => {
    // Art. 25(1): "não pode ultrapassar 8 horas por dia, nem 44 horas por
    // semana". The guard caught this in my own replacement text.
    expect(timeAndLeave).toContain('may run up to 44 hours');
  });
});

describe('public docs — capability claims match the product', () => {
  it('does not claim Art. 62 paid time is handled automatically', () => {
    // TL_LAW_GAP_MATRIX F9: hour-level paid dispensations do not exist, and a
    // nursing mother on 6h days is DOCKED 2h/day. The page claimed the exact
    // opposite — "handled as ordinary worked time, never docked".
    expect(timeAndLeave).not.toContain('are handled as ordinary worked time');
    expect(timeAndLeave).toContain('does not yet track these hour-level dispensations');
  });

  it('does not invent an identity-document hiring requirement', () => {
    // "bilhete"/"identidade" appear ZERO times in all 2,835 lines of Lei
    // 4/2012. The product deliberately does not require these (all three
    // document numbers default to empty and never block), so the page was
    // arguing against our own headline advantage.
    expect(gettingStarted).not.toContain('Timorese staff need a');
    expect(gettingStarted).toContain('None of it blocks you');
  });

  it('cites the INSS enrolment deadline that settles the question', () => {
    // DL 20/2017 Art. 3(2): enrolment is due "até à data de entrega da
    // primeira declaração de remunerações que inclua o beneficiário".
    // This CLOSES an item the in-app reference had listed as open.
    expect(gettingStarted).toContain('DL 20/2017, Art. 3(2)');
    expect(gettingStarted).toContain('DL 20/2017, art. 3.º(2)');
  });
});

/**
 * The SHOULD-FIX tier from the same 2026-08-08 fact-check. None of these
 * misled about money; each was a claim an accountant would check and find
 * wrong, on a page whose credibility rests on being checkable.
 */
const en = readFileSync(join(process.cwd(), 'client/i18n/locales/en.ts'), 'utf8');
const runningPayroll = docs('running-payroll');

describe('/engine — counts and citations an accountant can check', () => {
  it('says EIGHT withholding categories, not nine', () => {
    // Taxes and Duties Act Part VI: services (a)-(d) = 4, plus Royalties,
    // Rent, Prizes and Non-resident = 8. "Nine" came from a 9-member TS enum
    // whose `dividend` member withholds NOTHING — it is exempt income under
    // Sec. 29(f). The rendered rate table on the same page has eight rows, so
    // the page contradicted itself in the one place a reader can count.
    expect(en).toContain('eight categories');
    expect(en).not.toContain('nine categories');
  });

  it('pins the wage rates to Schedule V, which is where they are printed', () => {
    // Secs. 20 and 22 both DELEGATE to Schedule V; neither states a rate. A
    // reader who opens Sec. 20-22 looking for 10% finds a cross-reference.
    expect(engine).toContain('art: "Anexo V(1)(a)"');
    expect(engine).toContain('art: "Anexo V(1)(b)"');
    expect(engine).not.toContain('art: "Art. 20–22"');
  });

  it('states the 44-hour week as the ceiling Art. 25(1) makes it', () => {
    // "não pode ultrapassar 8 horas por dia, nem 44 horas por semana", and
    // Art. 29(2) calls those "os limites máximos". Publishing it as a norm
    // invites an employer to treat 44 as a target rather than a cap.
    expect(en).toContain('Normal hours capped at 44 a week');
    expect(en).not.toContain('hours: "44-hour week, 8-hour day"');
  });
});

describe('/engine — floors read as floors', () => {
  it('calls the Art. 56 severance figure the statutory minimum', () => {
    // Our own guide records that TL employers commonly contract a month per
    // YEAR — five times the floor. The engine can only ever emit the floor
    // (there is no override path), so the page must not present it as the
    // answer.
    expect(en).toContain('the statutory minimum');
  });

  it('says the 13th month is AT LEAST one month of base salary', () => {
    // Art. 44(1): "valor não inferior a 1 salário mensal". Base salary, and a
    // floor — two qualifiers the old string carried neither of.
    expect(en).toContain("at least one month's base salary");
  });
});

describe('public docs — capability claims match the shipped defaults', () => {
  it('does not promise a bank pack to a company that pays cash', () => {
    // Cash is a first-class path in Xefe (it posts against cash on hand), and
    // it is the norm in Timor-Leste. The claim was stated universally.
    expect(runningPayroll).toContain('If you pay by bank transfer');
    expect(runningPayroll).not.toContain(
      'Marking a run paid also generates your salary bank pack.',
    );
  });

  it('describes the advanced-tax default the way the code actually behaves', () => {
    // TenantContext: `advancedTaxMode !== false`, so a tenant that has never
    // touched the setting gets advanced mode. The page said the opposite —
    // "Everyone else keeps the simple flow" — which is the inversion.
    expect(en).not.toContain('Everyone else keeps the simple flow');
    expect(en).toContain('any owner can switch them off');
  });
});
