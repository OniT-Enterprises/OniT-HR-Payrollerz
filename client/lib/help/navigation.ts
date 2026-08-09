/** Keep a Help search attached to the answer it opened. */
export function helpSearchQuery(search: string): string {
  return new URLSearchParams(search).get("q")?.trim() ?? "";
}

export function helpCenterPath(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "/help";
  return `/help?${new URLSearchParams({ q: trimmed }).toString()}`;
}

export function helpResultPath(
  path: string,
  query: string,
  anchor?: string,
): string {
  const trimmed = query.trim();
  const base = trimmed
    ? `${path}?${new URLSearchParams({ q: trimmed }).toString()}`
    : path;
  return anchor ? `${base}#${encodeURIComponent(anchor)}` : base;
}

export function helpHashTarget(hash: string): string {
  if (!hash.startsWith("#")) return "";
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return "";
  }
}
