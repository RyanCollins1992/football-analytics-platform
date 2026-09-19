/**
 * Shared explanation for the 0.00-0.00 degenerate prediction (Phase 9's
 * finding): at least one team has no finished matches synced yet, so every
 * model's average-goals computation returns 0. Shown instead of a wall of
 * meaningless 0%/100% markets, on both /predictions and /matches/[id].
 */
export function NoHistoryCaveat() {
  return (
    <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
      At least one of these teams has no finished matches synced yet — every model needs real prior
      results to work from, so this comes back 0.00–0.00 rather than a meaningful prediction. This
      resolves as more history is synced (<code className="rounded bg-black/5 px-1 dark:bg-white/10">npm run sync:fixtures</code>),
      not by switching models.
    </p>
  );
}
