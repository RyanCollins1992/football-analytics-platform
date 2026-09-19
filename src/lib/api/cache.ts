/**
 * Short-lived in-memory memoization so one sync run never fetches the same
 * URL twice. Postgres is the durable store (sync jobs write there; the app
 * never calls a provider live from a page load) — this is not a second
 * persistence layer, just avoiding redundant calls within a single process.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export async function withCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const existing = store.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value as T;
  }
  const value = await fetcher();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function clearCache() {
  store.clear();
}
