/**
 * The in-app documentation.
 *
 * Two things are pinned here and neither is cosmetic.
 *
 * ANONYMITY. The source these articles were written from names a specific
 * Timor-Leste practitioner and their firm, and cites their client worksheets.
 * The published version must not — this is a page every signed-in user can
 * read. It is the kind of leak that is invisible in review because the name
 * looks like ordinary prose, so it is asserted rather than remembered.
 *
 * DISCLOSURE. Every entry must say what Xefe does TODAY. An article that
 * explains a legal debate without stating which side the product took is
 * decoration; the whole point is that a reader can check our arithmetic
 * against their accountant's.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HELP_ARTICLES,
  articlesFor,
  getArticle,
  searchHelp,
  searchHelpArticles,
} from '../../client/lib/help/content';

/** Everything a reader can see, as one string. */
const allText = HELP_ARTICLES.flatMap((article) => [
  article.title,
  article.summary,
  ...article.intro,
  ...article.keywords,
  ...article.groups.flatMap((group) => [
    group.heading,
    group.blurb,
    ...group.entries.flatMap((entry) => [
      entry.heading,
      ...entry.body,
      entry.today,
      entry.impact ?? '',
      entry.open ?? '',
      entry.quote ?? '',
      entry.quoteCite ?? '',
    ]),
  ]),
]).join('\n');

const allEntries = HELP_ARTICLES.flatMap((article) =>
  article.groups.flatMap((group) => group.entries),
);

/** Positions articles are the ones that must disclose a side. */
const positionEntries = HELP_ARTICLES.filter(
  (article) => article.kind === 'positions',
).flatMap((article) => article.groups.flatMap((group) => group.entries));

describe('help content — names nobody agreed to publish', () => {
  // Both the person and the firm. Lower-cased so a mid-sentence or possessive
  // form ("Nico's reading") is caught too.
  it.each(['nico', 'primos', 'primosboot'])(
    'never mentions %s',
    (name) => {
      expect(allText.toLowerCase()).not.toContain(name);
    },
  );

  it('does not attribute anything to "your firm"', () => {
    // The source doc is addressed TO the reviewer, so it says "your firm's
    // advisories" throughout. Copied across unedited, that reads as if the
    // tenant's own accountant wrote it.
    expect(allText.toLowerCase()).not.toContain('your firm');
  });

  it('does not leak repository paths or internal filenames', () => {
    expect(allText).not.toMatch(/docs\/[A-Z_]+\.md/);
    expect(allText.toLowerCase()).not.toContain('gap_matrix');
  });
});

describe('help content — every position is disclosed', () => {
  it('has entries at all', () => {
    expect(allEntries.length).toBeGreaterThan(10);
  });

  it('states what Xefe does today, for every position it takes', () => {
    for (const entry of positionEntries) {
      expect(entry.today?.trim().length ?? 0).toBeGreaterThan(20);
    }
  });

  it('leaves nothing open on an entry marked settled', () => {
    // "Settled" plus a dangling open question would be a contradiction the
    // reader has to resolve themselves.
    for (const entry of positionEntries.filter((e) => e.status === 'settled')) {
      expect(entry.open).toBeUndefined();
    }
  });

  it('says what is still open on everything not settled', () => {
    for (const entry of positionEntries.filter((e) => e.status !== 'settled')) {
      expect(entry.open?.trim().length ?? 0).toBeGreaterThan(20);
    }
  });

  it('gives every position entry a status badge', () => {
    for (const entry of positionEntries) {
      expect(entry.status).toBeTruthy();
    }
  });

  it('gives every anchor in an article a unique id — groups included', () => {
    // Groups and entries both render as DOM ids on the same page, so they
    // share one namespace even though they are separate arrays in the data.
    // Written after doing exactly this: a group and one of its own entries
    // both called "not-advice", which is invalid HTML and makes the contents
    // link jump to whichever the browser saw first.
    for (const article of HELP_ARTICLES) {
      const ids = article.groups.flatMap((g) => [
        g.id,
        ...g.entries.map((e) => e.id),
      ]);
      expect(new Set(ids).size, article.slug).toBe(ids.length);
    }
  });

  it('never renders an empty group blurb', () => {
    for (const article of HELP_ARTICLES) {
      for (const group of article.groups) {
        expect(group.blurb.trim().length, `${article.slug}/${group.id}`)
          .toBeGreaterThan(0);
      }
    }
  });

  it('cites a source whenever it quotes one', () => {
    for (const entry of allEntries.filter((e) => e.quote)) {
      expect(entry.quoteCite).toBeTruthy();
    }
  });
});

describe('searchHelp', () => {
  it('finds an entry by the word a reader would actually type', () => {
    // The statute calls it "compensação por tempo de serviço" and so does the
    // article. Nobody searches for that. This is what `synonyms` exists for,
    // and the search is useless without it.
    const ids = searchHelp('severance').map((hit) => hit.entry.id);
    expect(ids).toContain('severance-cause');
    expect(ids).toContain('severance-blocks');
  });

  it('finds an entry by a word only its body contains', () => {
    expect(searchHelp('hospitality').length).toBeGreaterThan(0);
  });

  it('requires every term, not any of them', () => {
    // "maternity" and "wage" both appear somewhere in the article, but an
    // any-term search would return half the page for a two-word query.
    const both = searchHelp('maternity subsidy');
    const first = searchHelp('maternity');
    expect(both.length).toBeLessThanOrEqual(first.length);
    for (const hit of both) {
      const text = [hit.entry.heading, ...hit.entry.body].join(' ').toLowerCase();
      expect(text).toContain('subsidy');
    }
  });

  it('ranks a heading match above a body-only match', () => {
    const hits = searchHelp('leave');
    const headingHit = hits.findIndex((h) =>
      h.entry.heading.toLowerCase().includes('leave'),
    );
    expect(headingHit).toBe(0);
  });

  it('returns nothing for a blank or one-character query', () => {
    expect(searchHelp('')).toEqual([]);
    expect(searchHelp('   ')).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(searchHelp('INSS').length).toBe(searchHelp('inss').length);
  });

  it('is accent-insensitive for phone keyboards', () => {
    expect(searchHelp('compensacao', 'pt').length).toBeGreaterThan(0);
  });

  it('searches article titles, summaries and keywords', () => {
    expect(searchHelpArticles('monthly cycle').map((article) => article.slug))
      .toContain('your-month');
  });
});

describe('translated guides', () => {
  const LOCALES = ['pt', 'tet'] as const;

  it('translates every guide, and does not pretend to translate the law article', () => {
    // The split is deliberate: guides are for the Timor-Leste owner doing the
    // work, the positions article is for a reviewer checking our reading. If
    // someone adds a guide, this fails until it is translated — which is the
    // point, because an untranslated guide silently serves English to the
    // people it was written for.
    for (const locale of LOCALES) {
      for (const article of articlesFor(locale)) {
        if (article.kind === 'guide') {
          expect(article.locale, `${article.slug} in ${locale}`).toBe(locale);
        } else {
          expect(article.locale).toBe('en');
        }
      }
    }
  });

  it('keeps the same articles, in the same order, in every language', () => {
    // The index must not reshuffle when someone switches language, and a
    // missing translation must fall back rather than drop the row.
    const spine = HELP_ARTICLES.map((a) => a.slug);
    for (const locale of LOCALES) {
      expect(articlesFor(locale).map((a) => a.slug)).toEqual(spine);
    }
  });

  it('keeps entry anchors identical across languages, so deep links survive', () => {
    // Search results and any link we ever paste carry #entry-id. If the Tetun
    // copy renames an anchor, those links land on the top of the page instead
    // of the answer — with no error anywhere.
    for (const article of HELP_ARTICLES) {
      const spine = article.groups.flatMap((g) => g.entries.map((e) => e.id));
      for (const locale of LOCALES) {
        const translated = getArticle(article.slug, locale);
        if (!translated || translated.locale === 'en') continue;
        const ids = translated.groups.flatMap((g) => g.entries.map((e) => e.id));
        expect(ids, `${article.slug} / ${locale}`).toEqual(spine);
      }
    }
  });

  it('states a deadline in every language wherever English states one', () => {
    // A missing `when` is how a translated guide quietly loses the only line
    // on the page that costs money.
    for (const article of HELP_ARTICLES) {
      const englishWhen = article.groups.flatMap((g) =>
        g.entries.filter((e) => e.when).map((e) => e.id),
      );
      for (const locale of LOCALES) {
        const translated = getArticle(article.slug, locale);
        if (!translated || translated.locale === 'en') continue;
        const localeWhen = translated.groups.flatMap((g) =>
          g.entries.filter((e) => e.when).map((e) => e.id),
        );
        expect(localeWhen, `${article.slug} / ${locale}`).toEqual(englishWhen);
      }
    }
  });

  it('falls back to English for an unknown locale rather than emptying the page', () => {
    expect(articlesFor('xx' as never).map((a) => a.slug)).toEqual(
      HELP_ARTICLES.map((a) => a.slug),
    );
  });
});

describe('the guides say the deadlines that cost money', () => {
  const month = getArticle('your-month')!;
  const monthText = JSON.stringify(month);

  it('gives the wage income tax date', () => {
    expect(monthText).toContain('15th');
  });

  it('gives both INSS dates — declaring and paying are not the same day', () => {
    expect(monthText).toContain('first 10 days');
    expect(monthText).toContain('20th');
  });

  it('gives the thirteenth-month date', () => {
    expect(monthText).toContain('20 December');
  });

  it('warns that an undeclared leaver keeps accruing contributions', () => {
    const leaver = JSON.stringify(getArticle('when-someone-leaves'));
    expect(leaver).toContain('presumed to still exist');
    expect(leaver).toContain('10th of the month after');
  });

  // Each of these was WRONG or vague in the first draft and was corrected
  // against the mined corpus — real filed returns and a practitioner's written
  // advisories, which outrank a careful reading of the statute.
  it('says the thirteenth month is base salary, and a floor', () => {
    // "One extra month of salary" reads as a month of TOTAL pay. Art. 39(4)
    // keeps overtime and allowances out of remuneração, so an owner following
    // the loose wording would overpay.
    expect(monthText).toContain('base salary');
    expect(monthText).toContain('at least');
  });

  it('says service compensation is the legal minimum, not the answer', () => {
    // The mined corpus has a real employer accruing a month per YEAR — five
    // times the statutory floor. Presenting the floor as the figure is how a
    // reader underpays somebody whose contract promised more.
    const leaver = JSON.stringify(getArticle('when-someone-leaves'));
    expect(leaver).toContain('legal minimum, not the answer');
    expect(leaver).toContain('does not know your contract');
  });

  it('gives the actual notice periods rather than gesturing at them', () => {
    const leaver = JSON.stringify(getArticle('when-someone-leaves'));
    expect(leaver).toContain('15 days up to two years');
    expect(leaver).toContain('two paid days a week');
  });

  // From the 2026-08-08 statutory sweep. Each of these was a confident
  // sentence that primary text does not support.
  it('does not cite Art. 2(y) — Art. 2 has no lettered paragraphs at all', () => {
    // Art. 2 is "Âmbito de aplicação", four numbered paragraphs about
    // territorial scope. The trabalho extraordinário definition is Art. 5(y).
    // A wrong pin is worse than no pin: it survives exactly until an
    // accountant opens the statute, and then it discredits every other number
    // on the page.
    expect(allText).not.toContain('Art. 2(y)');
    expect(allText).toContain('Art. 5(y)');
  });

  it('does not claim the INSS premium exclusion is the safe side', () => {
    // It lowers this month's contribution. If the reading is wrong the
    // employer owes the arrears — and carries the employee's 4% too, because
    // it cannot be recovered from wages already paid.
    const inss = JSON.stringify(
      getArticle('how-xefe-reads-the-law')!
        .groups.flatMap((g) => g.entries)
        .find((e) => e.id === 'inss-premiums'),
    );
    expect(inss).not.toContain('conservative side');
    expect(inss).toContain('not** the safe side');
  });

  it('never claims nothing here can cause under-remittance', () => {
    // The intro used to promise exactly that, which the INSS premiums entry
    // contradicts on the same page.
    expect(allText).not.toContain('nothing on this page can be causing you');
  });

  it('does not state the minimum wage as a settled legal figure', () => {
    // No Jornal da República instrument was found for $115 — only a
    // government communique. Aggregator sites are not evidence.
    const wage = JSON.stringify(
      getArticle('how-xefe-reads-the-law')!
        .groups.flatMap((g) => g.entries)
        .find((e) => e.id === 'minimum-wage'),
    );
    expect(wage).toContain('cannot point you at a law');
    expect(wage).toContain('SEFOPE');
  });

  it('states the two real limits of the working-week setting', () => {
    // The premium now follows the configured rest day (Art. 27(2) attaches to
    // "dia de descanso semanal" and never says "domingo"). Two limits remain
    // and both change what someone is paid, so both must be on the page:
    //   - a seven-day company gets NO automatic rest day, because Art. 30(1)
    //     grants one rest period and nothing identifies which day it is;
    //   - a five-day week rests on SUNDAY, and Saturday is an ordinary day
    //     off — treating both as rest days would double Saturday pay.
    const week = getArticle('how-xefe-reads-the-law')!
      .groups.flatMap((g) => g.entries)
      .find((e) => e.id === 'working-week')!;
    expect(week.status).not.toBe('settled'); // per-employee rest days still open
    expect(week.today).toContain('will not guess');
    expect(week.today).toContain('Sunday');
    expect(week.open).toContain('per-employee');
  });

  it('says plainly that a generated file is not a filed one', () => {
    // The single most expensive misunderstanding available: an INSS export
    // sitting in a downloads folder looks exactly like a submitted return.
    const boundaries = JSON.stringify(getArticle('what-xefe-does-not-do'));
    expect(boundaries).toContain('nothing was filed');
    expect(boundaries).toContain('does not move money');
  });
});

describe('getArticle', () => {
  it('resolves a known slug', () => {
    expect(getArticle('how-xefe-reads-the-law')).toBeDefined();
  });

  it('returns undefined rather than throwing on a bad slug', () => {
    expect(getArticle('nope')).toBeUndefined();
  });
});

/**
 * The help page must not fall behind the open-questions doc.
 *
 * `docs/NICO_OPEN_QUESTIONS.md` is where a question gets written down first;
 * `/help` is where a CUSTOMER can actually read it. On 2026-08-08 two
 * questions raised that same day — B16 (may a notice shortfall be set off
 * against the final wage?) and B17 (which Art. 55 routes should Xefe surface?)
 * — existed only in the doc. The customer-facing page silently lagged.
 *
 * That is the same propagation failure that put a wrong sick-leave citation on
 * the public site for a day: a correction landing in one surface and not its
 * twin. This asserts the mapping so the next question added to the doc has to
 * be answered here too, or deliberately exempted with a reason.
 */
describe('the help page covers every open question we have written down', () => {
  const nico = readFileSync(
    join(process.cwd(), 'docs/NICO_OPEN_QUESTIONS.md'),
    'utf8',
  );

  /**
   * Question id -> the help entry that carries it. Exempt entries state WHY,
   * because an unexplained exemption is how a page quietly stops being
   * complete.
   */
  const MAPPING: Record<string, string | { exempt: string }> = {
    A1: 'severance-cause',
    A2: 'severance-blocks',
    A3: 'leave-cash-out',
    A4: 'rehire',
    A5: 'inss-premiums',
    A6: 'working-week',
    A7: 'childcare-floor',
    A8: 'leave-year',
    B6: 'wit-month',
    B7: 'job-search-credit',
    B8: 'minimum-wage',
    B9: 'small-employer-inss',
    B10: 'maternity-fallback',
    B11: 'identifiers',
    B12: 'identifiers',
    B13: 'sick-certificate',
    B14: 'leave-waiting-period',
    B15: 'worker-student-minor',
    B16: 'notice-setoff',
    B17: 'art55-routes',
  };

  const entryIds = new Set(
    HELP_ARTICLES.flatMap((a) => a.groups.flatMap((g) => g.entries.map((e) => e.id))),
  );

  it('has an entry for every question the doc raises', () => {
    for (const [question, target] of Object.entries(MAPPING)) {
      if (typeof target !== 'string') continue;
      expect(entryIds.has(target), `${question} -> ${target}`).toBe(true);
    }
  });

  it('maps every question heading in the doc, so a new one cannot slip past', () => {
    // Headings look like "### B16. May a notice shortfall be set off…".
    const raised = [...nico.matchAll(/^### ([AB]\d+)\./gm)].map((m) => m[1]);
    const unique = [...new Set(raised)];
    expect(unique.length).toBeGreaterThan(15); // sanity: the doc parsed

    const unmapped = unique.filter((q) => !(q in MAPPING));
    expect(
      unmapped,
      `Questions in NICO_OPEN_QUESTIONS.md with no /help entry: ${unmapped.join(', ')}. ` +
        'Add an entry, or add an { exempt: "reason" } to MAPPING.',
    ).toEqual([]);
  });
});
