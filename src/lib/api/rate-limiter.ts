import { logger } from "@/lib/api/logger";

/**
 * Tracks remaining request quota for one process run, from the provider's
 * own response headers — never a hardcoded assumption of the limit. There's
 * no scheduled/cron sync yet (every sync is a manual `npm run sync:...`
 * invocation), so per-run, in-memory tracking is correct for now; persisting
 * quota across process restarts only matters once scheduled jobs exist.
 */
export class RateLimiter {
  private remaining: number | null = null;

  constructor(
    private readonly provider: string,
    /** Header name(s) to check, in order, for the remaining-requests count. */
    private readonly remainingHeaderNames: string[]
  ) {}

  /** Call after every response, whether or not the request succeeded. */
  recordResponseHeaders(headers: Headers) {
    for (const name of this.remainingHeaderNames) {
      const value = headers.get(name);
      if (value !== null) {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          this.remaining = parsed;
          logger.info("rate limit remaining", { provider: this.provider, remaining: parsed, header: name });
        }
        return;
      }
    }
  }

  /** True unless a response has told us we're out of quota. Unknown quota (no header seen yet) is optimistically allowed. */
  canProceed(): boolean {
    return this.remaining === null || this.remaining > 0;
  }

  getRemaining(): number | null {
    return this.remaining;
  }
}
