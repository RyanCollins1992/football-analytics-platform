/**
 * Root-level Suspense fallback — Next.js wraps every route under this
 * automatically, so one file covers every force-dynamic page's data fetch
 * instead of each page blocking with a blank screen.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="h-7 w-40 animate-pulse rounded bg-black/10 dark:bg-white/10" />
      <div className="mt-4 h-4 w-72 animate-pulse rounded bg-black/5 dark:bg-white/5" />
      <div className="mt-10 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
        ))}
      </div>
    </div>
  );
}
