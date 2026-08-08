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

  it('states what Xefe does today, for every single entry', () => {
    for (const entry of allEntries) {
      expect(entry.today.trim().length).toBeGreaterThan(20);
    }
  });

  it('leaves nothing open on an entry marked settled', () => {
    // "Settled" plus a dangling open question would be a contradiction the
    // reader has to resolve themselves.
    for (const entry of allEntries.filter((e) => e.status === 'settled')) {
      expect(entry.open).toBeUndefined();
    }
  });

  it('says what is still open on everything not settled', () => {
    for (const entry of allEntries.filter((e) => e.status !== 'settled')) {
      expect(entry.open?.trim().length ?? 0).toBeGreaterThan(20);
    }
  });

  it('gives every entry a unique anchor, so deep links land', () => {
    const ids = allEntries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
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

describe('getArticle', () => {
  it('resolves a known slug', () => {
    expect(getArticle('how-xefe-reads-the-law')).toBeDefined();
  });

  it('returns undefined rather than throwing on a bad slug', () => {
    expect(getArticle('nope')).toBeUndefined();
  });
});
