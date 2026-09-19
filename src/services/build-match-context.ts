import { getLeagueAverageGoals, getTeamMatchRecords } from "@/services/queries";
import type { MatchContext } from "@/lib/predictions/types";

/**
 * The DB-facing glue Phase 6's plan deferred to this phase — turns real
 * synced data into the plain-array shape every prediction model consumes.
 * `dataCutoff` is enforced here (via getTeamMatchRecords/getLeagueAverageGoals's
 * `beforeDate`), not just recorded — this is what actually stops a model
 * from seeing a match that happens after the one being predicted.
 */
export async function buildMatchContext(
  homeTeamId: number,
  awayTeamId: number,
  competitionSlug: string,
  dataCutoff: Date
): Promise<MatchContext> {
  const [homeTeamOverall, awayTeamOverall, leagueAverages] = await Promise.all([
    getTeamMatchRecords(homeTeamId, dataCutoff),
    getTeamMatchRecords(awayTeamId, dataCutoff),
    getLeagueAverageGoals(competitionSlug, dataCutoff),
  ]);

  return {
    homeTeamOverall,
    homeTeamHomeOnly: homeTeamOverall.filter((r) => r.isHome),
    awayTeamOverall,
    awayTeamAwayOnly: awayTeamOverall.filter((r) => !r.isHome),
    leagueAverages,
  };
}
