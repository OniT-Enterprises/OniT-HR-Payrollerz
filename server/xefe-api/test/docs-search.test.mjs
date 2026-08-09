import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { searchDocs } = require('../docsSearch.js');

describe('XefeBot documentation search', () => {
  it('finds the night-shift answer through a common typo', () => {
    const [result] = searchDocs('nigth shift', 'en');
    assert.equal(result.heading, 'Night shifts');
    assert.equal(result.helpPath, '/help/guide/time-and-leave#night-shifts');
    assert.match(result.content, /21:00/);
    assert.match(result.content, /25%/);
  });

  it('uses cross-language vocabulary but prefers the requested locale', () => {
    const [portuguese] = searchDocs('turnu kalan', 'pt');
    assert.equal(portuguese.locale, 'pt');
    assert.equal(portuguese.heading, 'Turnos noturnos');

    const [tetun] = searchDocs('turno noturno', 'tet');
    assert.equal(tetun.locale, 'tet');
    assert.equal(tetun.heading, 'Turnu kalan');
  });

  it('returns a bounded empty result for an unknown or blank query', () => {
    assert.deepEqual(searchDocs('', 'en'), []);
    assert.deepEqual(searchDocs('xefe-no-such-document', 'en'), []);
  });
});
