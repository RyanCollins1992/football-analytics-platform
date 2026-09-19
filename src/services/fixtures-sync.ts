import { prisma } from "@/lib/database/client";
import { getProvider } from "@/lib/api";
import { getLeague } from "@/lib/config";
import { upsertTeamByProvider } from "@/services/upsert-team";
import { logger } from "@/lib/api/logger";
import type { NormalizedFixture } from "@/types/football";

export interface SyncFixturesResult {
  competitionSlug: string;
  matchesUpserted: number;
}

export async function syncFixtures(
  competitionSlug: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<SyncFixturesResult> {
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
  logger.info("syncing fixtures", { competitionSlug, provider: provider.id, dateFrom, dateTo });
  const fixtures = await provider.getFixtures({ competitionSlug, dateFrom, dateTo });

  let matchesUpserted = 0;

  for (const fixture of fixtures) {
    const homeTeam = await upsertTeamByProvider(provider.id, fixture.homeTeam);
    const awayTeam = await upsertTeamByProvider(provider.id, fixture.awayTeam);
    await upsertMatch(provider.id, fixture, competition.id, season.id, homeTeam.id, awayTeam.id);
    matchesUpserted++;
  }

  logger.info("fixtures sync complete", { competitionSlug, matchesUpserted });
  return { competitionSlug, matchesUpserted };
}

/**
 * Explicit branches (not a dynamic `where` key) so Prisma's generated
 * WhereUniqueInput types stay fully checked — same reasoning as
 * upsertTeamByProvider.
 */
async function upsertMatch(
  providerId: ReturnType<typeof getProvider>["id"],
  fixture: NormalizedFixture,
  competitionId: number,
  seasonId: number,
  homeTeamId: number,
  awayTeamId: number
) {
  const fields = {
    competitionId,
    seasonId,
    homeTeamId,
    awayTeamId,
    matchday: fixture.matchday,
    scheduledAt: fixture.scheduledAt,
    status: fixture.status,
    homeScore: fixture.homeScore,
    awayScore: fixture.awayScore,
    halfTimeHomeScore: fixture.halfTimeHomeScore,
    halfTimeAwayScore: fixture.halfTimeAwayScore,
    venue: fixture.venue,
  };

  if (providerId === "football-data-org") {
    return prisma.match.upsert({
      where: { footballDataOrgId: fixture.externalId },
      update: fields,
      create: { footballDataOrgId: fixture.externalId, ...fields },
    });
  }
  if (providerId === "api-football") {
    return prisma.match.upsert({
      where: { apiFootballId: fixture.externalId },
      update: fields,
      create: { apiFootballId: fixture.externalId, ...fields },
    });
  }
  throw new Error(`upsertMatch: "${providerId}" is test-only and doesn't write real Match rows`);
}
