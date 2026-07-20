import { useCallback, useMemo, useRef, useState } from "react";
import {
  nextSortState,
  sortRows,
  type SortAccessors,
  type SortState,
} from "@/lib/table-sort";

export type { SortDirection, SortState } from "@/lib/table-sort";

/**
 * Reusable column sorting for any table (custom grid or shadcn `<Table>`).
 *
 * Clicking a column cycles asc → desc → off. Pass one accessor per sortable
 * column key; accessors may return strings, numbers, Dates, or null/undefined
 * (empties sort last). The returned `sorted` array is a stable, sorted copy.
 *
 *   const { sorted, sort, toggleSort } = useTableSort(rows, {
 *     name: (r) => r.name,
 *     salary: (r) => r.salary,
 *   });
 */
export function useTableSort<T, K extends string>(
  items: T[],
  accessors: SortAccessors<T, K>,
  initial: SortState<K> | null = null,
) {
  const [sort, setSort] = useState<SortState<K> | null>(initial);

  // Accessors are typically defined inline (new identity each render). Hold them
  // in a ref so re-sorting depends only on `items` and `sort`, never on the
  // accessor object's identity — otherwise the useMemo would run every render.
  const accessorsRef = useRef(accessors);
  accessorsRef.current = accessors;

  const toggleSort = useCallback((key: K) => {
    setSort((prev) => nextSortState(prev, key));
  }, []);

  const sorted = useMemo(
    () => sortRows(items, sort, accessorsRef.current),
    [items, sort],
  );

  return { sorted, sort, toggleSort, setSort };
}
