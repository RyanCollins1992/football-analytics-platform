import type { ZodType } from "zod";
import { ProviderApiError } from "@/lib/api/errors";
import { logger } from "@/lib/api/logger";
import { withCache } from "@/lib/api/cache";
import type { RateLimiter } from "@/lib/api/rate-limiter";

export interface HttpClientConfig {
  provider: string;
  baseUrl: string;
  headers: Record<string, string>;
  rateLimiter?: RateLimiter;
  maxRetries?: number;
  cacheTtlMs?: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — one sync run, not a durable cache

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches `path`, validates the JSON body against `schema`, and throws a
 * descriptive ProviderApiError on anything else — a malformed response fails
 * loudly here, not as a confusing TypeError three functions later.
 *
 * Retries on network errors and 5xx only. A 4xx (bad request, bad auth, rate
 * limited) is never transient, so it fails immediately instead of burning
 * retry budget and quota on a request that will never succeed.
 */
export async function fetchJson<T>(config: HttpClientConfig, path: string, schema: ZodType<T>): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  return withCache(url, cacheTtlMs, async () => {
    if (config.rateLimiter && !config.rateLimiter.canProceed()) {
      throw new ProviderApiError(
        `${config.provider} rate limit exhausted for this run (0 requests remaining)`,
        config.provider
      );
    }

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let response: Response;
      try {
        response = await fetch(url, { headers: config.headers });
      } catch (error) {
        lastError = error;
        logger.warn("network error, will retry", { provider: config.provider, url, attempt, error: String(error) });
        await sleep(2 ** attempt * 500);
        continue;
      }

      config.rateLimiter?.recordResponseHeaders(response.headers);

      if (response.status >= 500) {
        lastError = new ProviderApiError(`${config.provider} returned ${response.status}`, config.provider, response.status);
        logger.warn("server error, will retry", { provider: config.provider, url, attempt, status: response.status });
        await sleep(2 ** attempt * 500);
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "<unreadable body>");
        throw new ProviderApiError(
          `${config.provider} request failed: ${response.status} ${response.statusText}`,
          config.provider,
          response.status,
          body
        );
      }

      const json = await response.json();
      const parsed = schema.safeParse(json);
      if (!parsed.success) {
        logger.error("response failed schema validation", { provider: config.provider, url, issues: parsed.error.issues });
        throw new ProviderApiError(
          `${config.provider} response did not match the expected shape — see logged issues`,
          config.provider,
          response.status,
          parsed.error
        );
      }

      return parsed.data;
    }

    throw new ProviderApiError(
      `${config.provider} request failed after ${maxRetries + 1} attempts`,
      config.provider,
      undefined,
      lastError
    );
  });
}
