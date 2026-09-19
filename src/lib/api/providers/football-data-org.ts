import { z } from "zod";
import { fetchJson } from "@/lib/api/http-client";
import { RateLimiter } from "@/lib/api/rate-limiter";
import type { FetchFixturesParams, FootballDataProvider } from "@/lib/api/provider";
import type { NormalizedFixture, NormalizedStandings, NormalizedTeam } from "@/types/football";
import { getLeague } from "@/lib/config";
import type { MatchStatus } from "@/generated/prisma/client";

// Response shapes confirmed against the live API on 2026-09-19 (see
// docs/providers.md) — not guessed from the docs page alone, which uses
// slightly different header names than what the API actually sends.

const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  shortName: z.string().nullable(),
  tla: z.string().nullable(),
  crest: z.string().nullable(),
});

const standingRowSchema = z.object({
  position: z.number(),
  team: teamSchema,
  playedGames: z.number(),
  won: z.number(),
  draw: z.number(),
  lost: z.number(),
  points: z.number(),
  goalsFor: z.number(),
  goalsAgainst: z.number(),
  goalDifference: z.number(),
});

const standingsResponseSchema = z.object({
  season: z.object({ currentMatchday: z.number().nullable() }),
  standings: z.array(
    z.object({
      type: z.string(),
      table: z.array(standingRowSchema),
    })
  ),
});

// Same 11 values as the Prisma MatchStatus enum (prisma/schema.prisma) and
// football-data.org's own documented vocabulary (docs/providers.md) — kept
// as its own schema so this API layer doesn't depend on the ORM's generated
// enum object.
const matchStatusSchema = z.enum([
  "SCHEDULED",
  "TIMED",
  "IN_PLAY",
  "PAUSED",
  "EXTRA_TIME",
  "PENALTY_SHOOTOUT",
  "FINISHED",
  "SUSPENDED",
  "POSTPONED",
  "CANCELLED",
  "AWARDED",
]);

const matchSchema = z.object({
  id: z.number(),
  utcDate: z.string(),
  status: matchStatusSchema,
  matchday: z.number().nullable(),
  venue: z.string().nullable().optional(),
  homeTeam: teamSchema,
  awayTeam: teamSchema,
  score: z.object({
    fullTime: z.object({ home: z.number().nullable(), away: z.number().nullable() }),
    halfTime: z.object({ home: z.number().nullable(), away: z.number().nullable() }),
  }),
});

const fixturesResponseSchema = z.object({
  matches: z.array(matchSchema),
});

function normalizeTeam(team: z.infer<typeof teamSchema>): NormalizedTeam {
  return {
    externalId: String(team.id),
    name: team.name,
    shortName: team.shortName ?? undefined,
    logo: team.crest ?? undefined,
  };
}

export class FootballDataOrgProvider implements FootballDataProvider {
  readonly id = "football-data-org" as const;

  private readonly rateLimiter = new RateLimiter("football-data-org", ["x-requests-available-minute"]);

  private clientConfig() {
    const apiKey = process.env.FOOTBALL_DATA_ORG_API_KEY;
    if (!apiKey) {
      throw new Error("FOOTBALL_DATA_ORG_API_KEY is not set");
    }
    return {
      provider: "football-data-org",
      baseUrl: process.env.FOOTBALL_DATA_ORG_BASE_URL ?? "https://api.football-data.org/v4",
      headers: { "X-Auth-Token": apiKey },
      rateLimiter: this.rateLimiter,
    };
  }

  private competitionCode(competitionSlug: string): string {
    const league = getLeague(competitionSlug);
    if (!league?.footballDataOrgCode) {
      throw new Error(`No football-data.org code configured for "${competitionSlug}" (src/lib/config.ts)`);
    }
    return league.footballDataOrgCode;
  }

  async getStandings(competitionSlug: string): Promise<NormalizedStandings> {
    const code = this.competitionCode(competitionSlug);
    const data = await fetchJson(this.clientConfig(), `/competitions/${code}/standings`, standingsResponseSchema);

    const total = data.standings.find((s) => s.type === "TOTAL") ?? data.standings[0];
    if (!total) {
      throw new Error(`football-data.org returned no standings table for ${competitionSlug}`);
    }

    return {
      competitionSlug,
      matchday: data.season.currentMatchday,
      rows: total.table.map((row) => ({
        team: normalizeTeam(row.team),
        position: row.position,
        played: row.playedGames,
        wins: row.won,
        draws: row.draw,
        losses: row.lost,
        goalsFor: row.goalsFor,
        goalsAgainst: row.goalsAgainst,
        goalDifference: row.goalDifference,
        points: row.points,
      })),
    };
  }

  async getFixtures(params: FetchFixturesParams): Promise<NormalizedFixture[]> {
    const code = this.competitionCode(params.competitionSlug);
    const query = new URLSearchParams();
    if (params.dateFrom) query.set("dateFrom", params.dateFrom.toISOString().slice(0, 10));
    if (params.dateTo) query.set("dateTo", params.dateTo.toISOString().slice(0, 10));
    const qs = query.size > 0 ? `?${query.toString()}` : "";

    const data = await fetchJson(this.clientConfig(), `/competitions/${code}/matches${qs}`, fixturesResponseSchema);

    return data.matches.map((match) => ({
      externalId: String(match.id),
      competitionSlug: params.competitionSlug,
      matchday: match.matchday,
      scheduledAt: new Date(match.utcDate),
      status: match.status as MatchStatus,
      homeTeam: normalizeTeam(match.homeTeam),
      awayTeam: normalizeTeam(match.awayTeam),
      homeScore: match.score.fullTime.home,
      awayScore: match.score.fullTime.away,
      halfTimeHomeScore: match.score.halfTime.home,
      halfTimeAwayScore: match.score.halfTime.away,
      venue: match.venue ?? null,
    }));
  }
}
