import type { NormalizedFixture, NormalizedStandings } from "@/types/football";
import type { ProviderId } from "@/lib/config";

export interface FetchFixturesParams {
  competitionSlug: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Every method returns normalized types (src/types/football.ts), never raw
 * provider JSON. Methods a provider can't serve at all (see docs/providers.md
 * for which of the two real providers covers what) are optional — callers
 * check `if (provider.getInjuries)` rather than catching a "not supported"
 * exception. That makes "handle missing data gracefully" a type-level
 * guarantee instead of a runtime hope.
 */
export interface FootballDataProvider {
  readonly id: ProviderId;

  getStandings(competitionSlug: string): Promise<NormalizedStandings>;
  getFixtures(params: FetchFixturesParams): Promise<NormalizedFixture[]>;

  // Not implemented by football-data.org's free tier — API-Football's
  // adapter (next phase) is the one that actually fills these in.
  getMatchStatistics?(externalMatchId: string): Promise<unknown>;
  getLineups?(externalMatchId: string): Promise<unknown>;
  getInjuries?(competitionSlug: string): Promise<unknown>;
}
