import type { FootballDataProvider } from "@/lib/api/provider";
import { FootballDataOrgProvider } from "@/lib/api/providers/football-data-org";
import { MockProvider } from "@/lib/api/providers/mock";
import { DEFAULT_PROVIDER, type ProviderId } from "@/lib/config";

export type { FootballDataProvider, FetchFixturesParams } from "@/lib/api/provider";
export { ProviderApiError } from "@/lib/api/errors";

/**
 * The only place that decides which concrete provider to use — callers
 * (services, scripts) ask for a provider by id, or take whatever
 * DEFAULT_PROVIDER (src/lib/config.ts) resolves to. Swapping providers later
 * never means rewriting the code that uses them.
 */
export function getProvider(id: ProviderId = DEFAULT_PROVIDER): FootballDataProvider {
  switch (id) {
    case "football-data-org":
      return new FootballDataOrgProvider();
    case "mock":
      return new MockProvider();
    case "api-football":
      throw new Error("api-football provider isn't implemented yet — see the Phase 3 plan");
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown provider id: ${exhaustive}`);
    }
  }
}
