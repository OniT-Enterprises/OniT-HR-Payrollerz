/**
 * Pure, framework-free table sorting helpers.
 *
 * Kept Firebase-free and React-free so CI unit tests can import it directly
 * (see the CI/deploy gotcha: the unit-test step has no VITE_FIREBASE_* env).
 * The React wrapper lives in `client/hooks/useTableSort.ts`; the header UI in
 * `client/components/ui/SortableColumnHeader.tsx`.
 */

export type SortDirection = "asc" | "desc";

export interface SortState<K extends string = string> {
  key: K;
  direction: SortDirection;
}

/** Returns the value a column sorts by. May be missing/empty — those sort last. */
export type SortAccessor<T> = (item: T) => string | number | Date | null | undefined;

export type SortAccessors<T, K extends string> = Record<K, SortAccessor<T>>;

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

/** Compare two non-empty values; strings use locale-aware, numeric-aware ordering. */
function compareNonEmpty(a: NonNullable<unknown>, b: NonNullable<unknown>): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Cycle a header's sort state on click: unsorted → asc → desc → unsorted.
 * `prev` is the current sort (or null when nothing is sorted).
 */
export function nextSortState<K extends string>(
  prev: SortState<K> | null,
  key: K,
): SortState<K> | null {
  if (!prev || prev.key !== key) return { key, direction: "asc" };
  if (prev.direction === "asc") return { key, direction: "desc" };
  return null; // desc → off
}

/**
 * Return a new, sorted copy of `items`. Stable (equal rows keep input order),
 * empty/missing values always sort last regardless of direction, and an unknown
 * or null sort key leaves the input order untouched.
 */
export function sortRows<T, K extends string>(
  items: T[],
  sort: SortState<K> | null,
  accessors: SortAccessors<T, K>,
): T[] {
  if (!sort) return items;
  const accessor = accessors[sort.key];
  if (!accessor) return items;

  const dir = sort.direction === "asc" ? 1 : -1;
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const av = accessor(a.item);
      const bv = accessor(b.item);
      const aEmpty = isEmpty(av);
      const bEmpty = isEmpty(bv);
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return a.index - b.index; // stable
        return aEmpty ? 1 : -1; // empties last, unaffected by direction
      }
      const cmp = compareNonEmpty(av as NonNullable<unknown>, bv as NonNullable<unknown>);
      return cmp !== 0 ? cmp * dir : a.index - b.index; // stable tiebreak
    })
    .map(({ item }) => item);
}
