import { prisma } from "@/lib/database/client";
import { getProvider } from "@/lib/api";
import { getLeague } from "@/lib/config";
import { upsertTeamByProvider } from "@/services/upsert-team";
import { logger } from "@/lib/api/logger";

export interface SyncStandingsResult {
  competitionSlug: string;
  teamsUpserted: number;
  standingsWritten: number;
}

export async function syncStandings(competitionSlug: string): Promise<SyncStandingsResult> {
  const league = getLeague(competitionSlug);
  if (!league) {
    throw new Error(`Unknown league slug: "${competitionSlug}" — check src/lib/config.ts`);
  }

  const competition = await prisma.competition.findUnique({ where: { slug: competitionSlug } });
  if (!competition) {
    throw new Error(`Competition "${competitionSlug}" isn't seeded yet — run npm run seed first`);
  }

  const season = await prisma.season.findFirst({ where: { competitionId: competition.id, isCurrent: true } });
  if (!season) {
    throw new Error(`No current season for "${competitionSlug}" — run npm run seed first`);
  }

  const provider = getProvider();
  logger.info("syncing standings", { competitionSlug, provider: provider.id });
  const standings = await provider.getStandings(competitionSlug);

  // Prisma's compound unique index (seasonId, teamId, matchday) can't match
  // against null — and a standings snapshot with no known matchday isn't
  // meaningfully storable anyway (there's nothing to distinguish it from a
  // future snapshot). This only happens before a season's first matchday,
  // in which case there's genuinely nothing worth syncing yet.
  if (standings.matchday === null) {
    throw new Error(`${competitionSlug}: provider returned no current matchday — season hasn't started yet?`);
  }
  const matchday = standings.matchday;

  let teamsUpserted = 0;
  let standingsWritten = 0;

  for (const row of standings.rows) {
    const team = await upsertTeamByProvider(provider.id, row.team);
    teamsUpserted++;

    await prisma.competitionTeam.upsert({
      where: { seasonId_teamId: { seasonId: season.id, teamId: team.id } },
      update: {},
      create: { competitionId: competition.id, seasonId: season.id, teamId: team.id },
    });

    await prisma.leagueStanding.upsert({
      where: {
        seasonId_teamId_matchday: { seasonId: season.id, teamId: team.id, matchday: matchday },
      },
      update: {
        position: row.position,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
        snapshotDate: new Date(),
      },
      create: {
        competitionId: competition.id,
        seasonId: season.id,
        teamId: team.id,
        matchday: matchday,
        position: row.position,
        played: row.played,
        wins: row.wins,
        draws: row.draws,
        losses: row.losses,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
      },
    });
    standingsWritten++;
  }

  logger.info("standings sync complete", { competitionSlug, teamsUpserted, standingsWritten });
  return { competitionSlug, teamsUpserted, standingsWritten };
}
