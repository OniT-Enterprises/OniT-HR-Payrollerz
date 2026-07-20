import { describe, expect, it } from 'vitest';
import { nextSortState, sortRows, type SortState } from '@/lib/table-sort';

interface Row {
  id: number;
  name: string;
  salary: number | null;
  hired?: Date;
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', salary: 200 },
  { id: 2, name: 'alice', salary: 100 },
  { id: 3, name: 'Bob', salary: null },
  { id: 4, name: 'bob', salary: 100 },
];

const accessors = {
  name: (r: Row) => r.name,
  salary: (r: Row) => r.salary,
} as const;

describe('nextSortState', () => {
  it('cycles unsorted → asc → desc → off for the same column', () => {
    const a = nextSortState<'name'>(null, 'name');
    expect(a).toEqual({ key: 'name', direction: 'asc' });
    const b = nextSortState(a, 'name');
    expect(b).toEqual({ key: 'name', direction: 'desc' });
    const c = nextSortState(b, 'name');
    expect(c).toBeNull();
  });

  it('switching to a different column starts at asc', () => {
    const prev: SortState<'name' | 'salary'> = { key: 'name', direction: 'desc' };
    expect(nextSortState(prev, 'salary')).toEqual({ key: 'salary', direction: 'asc' });
  });
});

describe('sortRows', () => {
  it('returns the input untouched when there is no sort', () => {
    expect(sortRows(rows, null, accessors)).toBe(rows);
  });

  it('sorts strings case-insensitively ascending', () => {
    const out = sortRows(rows, { key: 'name', direction: 'asc' }, accessors);
    expect(out.map((r) => r.name)).toEqual(['alice', 'Bob', 'bob', 'Charlie']);
  });

  it('reverses on descending', () => {
    const out = sortRows(rows, { key: 'name', direction: 'desc' }, accessors);
    expect(out.map((r) => r.name)).toEqual(['Charlie', 'Bob', 'bob', 'alice']);
  });

  it('sorts numbers numerically, not lexically', () => {
    const nums: Row[] = [
      { id: 1, name: 'a', salary: 9 },
      { id: 2, name: 'b', salary: 100 },
      { id: 3, name: 'c', salary: 20 },
    ];
    const out = sortRows(nums, { key: 'salary', direction: 'asc' }, accessors);
    expect(out.map((r) => r.salary)).toEqual([9, 20, 100]);
  });

  it('keeps empty/null values last in both directions', () => {
    const asc = sortRows(rows, { key: 'salary', direction: 'asc' }, accessors);
    expect(asc[asc.length - 1].salary).toBeNull();
    const desc = sortRows(rows, { key: 'salary', direction: 'desc' }, accessors);
    expect(desc[desc.length - 1].salary).toBeNull();
  });

  it('is stable: equal keys keep their original relative order', () => {
    // ids 2 and 4 both have salary 100 — id 2 comes before id 4 in the input
    const out = sortRows(rows, { key: 'salary', direction: 'asc' }, accessors);
    const hundreds = out.filter((r) => r.salary === 100).map((r) => r.id);
    expect(hundreds).toEqual([2, 4]);
  });

  it('does not mutate the input array', () => {
    const snapshot = rows.map((r) => r.id);
    sortRows(rows, { key: 'name', direction: 'asc' }, accessors);
    expect(rows.map((r) => r.id)).toEqual(snapshot);
  });

  it('leaves order untouched for an unknown key', () => {
    const out = sortRows(rows, { key: 'missing' as 'name', direction: 'asc' }, accessors);
    expect(out).toBe(rows);
  });
});
