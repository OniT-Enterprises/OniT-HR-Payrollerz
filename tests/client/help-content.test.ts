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
import {
  HELP_ARTICLES,
  articlesFor,
  getArticle,
  searchHelp,
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
