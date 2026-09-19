import { prisma } from "@/lib/database/client";
import type { TeamMatchRecord } from "@/lib/analytics/team-stats";
import type { HeadToHeadMatch } from "@/lib/analytics/head-to-head";
import { listPredictionModels } from "@/lib/predictions";
import { summarizeResults, type EvaluationSummary, type PredictionResultLike } from "@/lib/predictions/evaluation-summary";
import { getEnabledLeagues } from "@/lib/config";

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

/**
 * Newest first, oriented to this team's perspective — no home/away branching
 * needed by the analytics functions that consume this. `beforeDate`, when
 * given, excludes any match at or after that moment — this is what makes
 * prediction context assembly (src/services/build-match-context.ts) actually
 * respect "never use future information" rather than just documenting the
 * intent. Existing callers (Phase 5's stat pages) don't pass it and are
 * unaffected.
 */
export async function getTeamMatchRecords(teamId: number, beforeDate?: Date): Promise<TeamMatchRecord[]> {
  const matches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      homeScore: { not: null },
      awayScore: { not: null },
      ...(beforeDate ? { scheduledAt: { lt: beforeDate } } : {}),
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

/**
 * League-wide baseline scoring rates, as of `beforeDate` — needed by the
 * Poisson model's attack/defense-strength calculation (Phase 6), computed
 * fresh from real data rather than a hardcoded constant.
 */
export async function getLeagueAverageGoals(
  competitionSlug: string,
  beforeDate?: Date
): Promise<{ avgHomeGoalsFor: number; avgAwayGoalsFor: number }> {
  const matches = await prisma.match.findMany({
    where: {
      competition: { slug: competitionSlug },
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
      ...(beforeDate ? { scheduledAt: { lt: beforeDate } } : {}),
    },
    select: { homeScore: true, awayScore: true },
  });

  if (matches.length === 0) return { avgHomeGoalsFor: 0, avgAwayGoalsFor: 0 };

  const totalHomeGoals = matches.reduce((sum, m) => sum + (m.homeScore as number), 0);
  const totalAwayGoals = matches.reduce((sum, m) => sum + (m.awayScore as number), 0);

  return {
    avgHomeGoalsFor: totalHomeGoals / matches.length,
    avgAwayGoalsFor: totalAwayGoals / matches.length,
  };
}

/** Cross-league — today's UTC calendar day, for the dashboard's "Today's Matches" section. */
export async function getTodaysMatches() {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfNextDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  return prisma.match.findMany({
    where: { scheduledAt: { gte: startOfDay, lt: startOfNextDay } },
    orderBy: { scheduledAt: "asc" },
    include: { homeTeam: true, awayTeam: true, competition: true },
  });
}

/** Cross-league version of getUpcomingFixtures — every league at once, for the dashboard and the predictions page. */
export async function getUpcomingMatchesAcrossLeagues(days: number) {
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return prisma.match.findMany({
    where: {
      status: { in: ["SCHEDULED", "TIMED"] },
      scheduledAt: { gte: now, lte: until },
    },
    orderBy: { scheduledAt: "asc" },
    include: { homeTeam: true, awayTeam: true, competition: true },
  });
}

/** Cross-league version of getRecentResults. */
export async function getRecentResultsAcrossLeagues(limit: number) {
  return prisma.match.findMany({
    where: { status: "FINISHED" },
    orderBy: { scheduledAt: "desc" },
    take: limit,
    include: { homeTeam: true, awayTeam: true, competition: true },
  });
}

export interface CompetitionDataStatus {
  slug: string;
  name: string;
  teamCount: number;
  matchCount: number;
  mostRecentMatchAt: Date | null;
}

/**
 * A descriptive freshness readout, not a fabricated "stale/fresh" verdict —
 * the spec never defines a staleness threshold, so this reports the facts
 * (team/match counts, most recent synced match) and lets the reader judge.
 */
export async function getDataStatus(): Promise<CompetitionDataStatus[]> {
  const enabled = getEnabledLeagues();

  return Promise.all(
    enabled.map(async (league) => {
      const competition = await prisma.competition.findUnique({ where: { slug: league.id } });
      if (!competition) {
        return { slug: league.id, name: league.name, teamCount: 0, matchCount: 0, mostRecentMatchAt: null };
      }

      const [teamCount, matchCount, mostRecent] = await Promise.all([
        prisma.competitionTeam.count({ where: { competitionId: competition.id } }),
        prisma.match.count({ where: { competitionId: competition.id } }),
        prisma.match.findFirst({
          where: { competitionId: competition.id },
          orderBy: { scheduledAt: "desc" },
          select: { scheduledAt: true },
        }),
      ]);

      return {
        slug: league.id,
        name: league.name,
        teamCount,
        matchCount,
        mostRecentMatchAt: mostRecent?.scheduledAt ?? null,
      };
    })
  );
}

/**
 * One prediction per match for a given model — the most recent one, since
 * generatePrediction always creates a new row rather than overwriting
 * (spec's explicit rule) and a match can accumulate more than one run.
 */
export async function getLatestPredictionsForMatches(matchIds: number[], modelId: string) {
  const predictions = await prisma.prediction.findMany({
    where: { matchId: { in: matchIds }, modelId },
    orderBy: { createdAt: "desc" },
  });

  const byMatch = new Map<number, (typeof predictions)[number]>();
  for (const prediction of predictions) {
    if (!byMatch.has(prediction.matchId)) byMatch.set(prediction.matchId, prediction);
  }
  return byMatch;
}

export interface ModelPerformanceRow {
  modelId: string;
  modelVersion: string;
  summary: EvaluationSummary;
}

/**
 * "Generated from actual stored predictions... do not hard-code statistics"
 * (spec section 13) — queries real Prediction+PredictionResult rows per
 * model and reuses Phase 8's summarizeResults, the same aggregation the
 * backtest CLI prints, rather than a second implementation.
 */
export async function getModelPerformance(): Promise<ModelPerformanceRow[]> {
  const models = listPredictionModels();

  return Promise.all(
    models.map(async (model) => {
      const predictions = await prisma.prediction.findMany({
        where: { modelId: model.id, modelVersion: model.version, result: { isNot: null } },
        include: { result: true },
      });

      const results: PredictionResultLike[] = predictions
        .map((p) => p.result)
        .filter((r): r is NonNullable<typeof r> => r !== null);

      return { modelId: model.id, modelVersion: model.version, summary: summarizeResults(results) };
    })
  );
}

export async function getTeamsWithData() {
  const teams = await prisma.team.findMany({
    where: { competitionTeams: { some: {} } },
    include: { competitionTeams: { include: { competition: true }, take: 1 } },
    orderBy: { name: "asc" },
  });
  return teams;
}
