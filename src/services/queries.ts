import { prisma } from "@/lib/database/client";
import type { TeamMatchRecord } from "@/lib/analytics/team-stats";
import type { HeadToHeadMatch } from "@/lib/analytics/head-to-head";

/** Read-side queries used by pages — distinct from the write-side sync services in this same folder. */

export async function getLeagueWithLatestStandings(slug: string) {
  const competition = await prisma.competition.findUnique({
    where: { slug },
    include: { seasons: { where: { isCurrent: true }, take: 1 } },
  });
  if (!competition) return null;
  const season = competition.seasons[0] ?? null;
  if (!season) return { competition, season: null, matchday: null, standings: [] };

  const latest = await prisma.leagueStanding.findFirst({
    where: { seasonId: season.id },
    orderBy: { matchday: "desc" },
    select: { matchday: true },
  });
  if (!latest) return { competition, season, matchday: null, standings: [] };

  const standings = await prisma.leagueStanding.findMany({
    where: { seasonId: season.id, matchday: latest.matchday },
    orderBy: { position: "asc" },
    include: { team: true },
  });

  return { competition, season, matchday: latest.matchday, standings };
}

export async function getUpcomingFixtures(slug: string, limit = 10) {
  return prisma.match.findMany({
    where: {
      competition: { slug },
      status: { in: ["SCHEDULED", "TIMED"] },
      scheduledAt: { gte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
    include: { homeTeam: true, awayTeam: true },
  });
}

export async function getRecentResults(slug: string, limit = 10) {
  return prisma.match.findMany({
    where: { competition: { slug }, status: "FINISHED" },
    orderBy: { scheduledAt: "desc" },
    take: limit,
    include: { homeTeam: true, awayTeam: true },
  });
}

export async function getTeamWithMatches(teamId: number) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return null;

  const matches = await prisma.match.findMany({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    orderBy: { scheduledAt: "desc" },
    include: { homeTeam: true, awayTeam: true, competition: true },
    take: 20,
  });

  const now = new Date();
  return {
    team,
    upcoming: matches.filter((m) => m.scheduledAt >= now).sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()),
    recent: matches.filter((m) => m.scheduledAt < now),
  };
}

export async function getMatchDetail(matchId: number) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      competition: true,
      season: true,
      statistics: { include: { team: true } },
    },
  });
}

/** Newest first, oriented to this team's perspective — no home/away branching needed by the analytics functions that consume this. */
export async function getTeamMatchRecords(teamId: number): Promise<TeamMatchRecord[]> {
  const matches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      homeScore: { not: null },
      awayScore: { not: null },
    },
    orderBy: { scheduledAt: "desc" },
  });

  return matches.map((m) => {
    const isHome = m.homeTeamId === teamId;
    return {
      matchId: m.id,
      scheduledAt: m.scheduledAt,
      isHome,
      goalsFor: (isHome ? m.homeScore : m.awayScore) as number,
      goalsAgainst: (isHome ? m.awayScore : m.homeScore) as number,
    };
  });
}

/** Newest first — finished matches between exactly these two teams, either venue. */
export async function getHeadToHeadMatches(teamAId: number, teamBId: number): Promise<HeadToHeadMatch[]> {
  const matches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      OR: [
        { homeTeamId: teamAId, awayTeamId: teamBId },
        { homeTeamId: teamBId, awayTeamId: teamAId },
      ],
    },
    orderBy: { scheduledAt: "desc" },
  });

  return matches.map((m) => ({
    matchId: m.id,
    scheduledAt: m.scheduledAt,
    homeTeamId: m.homeTeamId,
    awayTeamId: m.awayTeamId,
    homeScore: m.homeScore as number,
    awayScore: m.awayScore as number,
  }));
}

export async function getTeamsWithData() {
  const teams = await prisma.team.findMany({
    where: { competitionTeams: { some: {} } },
    include: { competitionTeams: { include: { competition: true }, take: 1 } },
    orderBy: { name: "asc" },
  });
  return teams;
}
