/** Read-only retrieval over the Help content generated from the client. */

const { documents } = require('./docs-index.json');

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function searchDocs(query, locale = 'en', requestedLimit = 4) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const limit = Math.min(6, Math.max(1, Number(requestedLimit) || 4));
  const normalizedPhrase = terms.join(' ');

  return documents
    .map((document) => {
      if (!terms.every((term) => document.searchText.includes(term))) return null;
      const heading = normalize(document.heading);
      const title = normalize(document.title);
      const headingMatches = terms.filter((term) => heading.includes(term)).length;
      const titleMatches = terms.filter((term) => title.includes(term)).length;
      return {
        document,
        score:
          (document.locale === locale ? 0 : 20) +
          (heading.includes(normalizedPhrase) ? 0 : 4) +
          (terms.length - headingMatches) * 3 +
          (terms.length - titleMatches),
      };
    })
    .filter(Boolean)
    .sort((left, right) =>
      left.score - right.score || left.document.key.localeCompare(right.document.key))
    .slice(0, limit)
    .map(({ document }) => ({
      title: document.title,
      heading: document.heading,
      locale: document.locale,
      helpPath: document.helpPath,
      content: document.text.slice(0, 6_000),
    }));
}

module.exports = { searchDocs };
