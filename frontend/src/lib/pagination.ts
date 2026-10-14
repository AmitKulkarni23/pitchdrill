/** Appends a fetched page, dropping items whose key is already present (a page can overlap after new data arrives). */
export function appendPage<T>(existing: T[], page: T[], key: (item: T) => string): T[] {
  const seen = new Set(existing.map(key));
  return [...existing, ...page.filter((item) => !seen.has(key(item)))];
}
