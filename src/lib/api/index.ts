import type { FootballDataProvider } from "@/lib/api/provider";
import { FootballDataOrgProvider } from "@/lib/api/providers/football-data-org";
import { SportmonksProvider } from "@/lib/api/providers/sportmonks";
import { MockProvider } from "@/lib/api/providers/mock";
import { DEFAULT_PROVIDER, type ProviderId } from "@/lib/config";

export type { FootballDataProvider, FetchFixturesParams } from "@/lib/api/provider";
export { ProviderApiError } from "@/lib/api/errors";

/**
 * The only place that decides which concrete provider to use — callers
 * (services, scripts) ask for a provider by id, or take whatever
 * DEFAULT_PROVIDER (src/lib/config.ts) resolves to. Swapping providers later
 * never means rewriting the code that uses them. For per-league routing
 * (which provider actually has current data for THIS league), see
 * resolveProviderForLeague in src/lib/config.ts — that's what services call,
 * not this function directly with a hardcoded id.
 */
export function getProvider(id: ProviderId = DEFAULT_PROVIDER): FootballDataProvider {
  switch (id) {
    case "football-data-org":
      return new FootballDataOrgProvider();
    case "sportmonks":
      return new SportmonksProvider();
    case "mock":
      return new MockProvider();
    case "api-football":
      throw new Error(
        "api-football's free tier is historical-only (2022-2024) — not usable for live sync. See docs/providers.md."
      );
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown provider id: ${exhaustive}`);
    }
  }
}
