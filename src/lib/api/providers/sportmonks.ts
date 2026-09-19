import { z } from "zod";
import { fetchJson } from "@/lib/api/http-client";
import { RateLimiter } from "@/lib/api/rate-limiter";
import type { FetchFixturesParams, FootballDataProvider } from "@/lib/api/provider";
import type { NormalizedFixture, NormalizedStandings, NormalizedTeam } from "@/types/football";
import { getLeague } from "@/lib/config";
import type { MatchStatus } from "@/generated/prisma/client";

// Response shapes confirmed against the live API on 2026-09-19 (see
// docs/providers.md) — Sportmonks' free tier is genuinely current-season
// for its two covered leagues, unlike API-Football's free tier (which
// looked the same on paper but turned out to be 2022-2024-only; verified
// live this time before writing any schema).

const participantSchema = z.object({
  id: z.number(),
  name: z.string(),
  short_code: z.string().nullable(),
  image_path: z.string().nullable(),
});

const participantWithMetaSchema = participantSchema.extend({
  meta: z.object({
    location: z.enum(["home", "away"]),
  }),
});

const leagueWithCurrentSeasonSchema = z.object({
  data: z.object({
    id: z.number(),
    currentseason: z.object({
      id: z.number(),
      is_current: z.boolean(),
    }),
  }),
});

const standingDetailSchema = z.object({
  value: z.number(),
  type: z.object({ code: z.string() }),
});

const standingRowSchema = z.object({
  position: z.number(),
  points: z.number(),
  participant: participantSchema,
  details: z.array(standingDetailSchema),
});

const standingsResponseSchema = z.object({
  data: z.array(standingRowSchema),
});

const scoreEntrySchema = z.object({
  participant_id: z.number(),
  description: z.string(),
  score: z.object({ goals: z.number() }),
});

// Sportmonks' full fixture-state vocabulary (26 values, confirmed live via
// GET /states) is finer-grained than our MatchStatus enum — this is a
// best-effort many-to-one mapping, not a 1:1 correspondence.
const STATE_TO_MATCH_STATUS: Record<string, MatchStatus> = {
  NS: "SCHEDULED",
  PENDING: "SCHEDULED",
  TBA: "SCHEDULED",
  DELAYED: "TIMED",
  INPLAY_1ST_HALF: "IN_PLAY",
  INPLAY_2ND_HALF: "IN_PLAY",
  AWAITING_UPDATES: "IN_PLAY",
  HT: "PAUSED",
  BREAK: "PAUSED",
  EXTRA_TIME_BREAK: "PAUSED",
  PEN_BREAK: "PAUSED",
  INPLAY_ET: "EXTRA_TIME",
  INPLAY_ET_SECOND_HALF: "EXTRA_TIME",
  INPLAY_PENALTIES: "PENALTY_SHOOTOUT",
  FT: "FINISHED",
  AET: "FINISHED",
  FT_PEN: "FINISHED",
  SUSPENDED: "SUSPENDED",
  INTERRUPTED: "SUSPENDED",
  ABANDONED: "SUSPENDED",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
  DELETED: "CANCELLED",
  AWARDED: "AWARDED",
  WO: "AWARDED",
};

const fixtureSchema = z.object({
  id: z.number(),
  starting_at: z.string(),
  participants: z.array(participantWithMetaSchema),
  scores: z.array(scoreEntrySchema),
  state: z.object({ developer_name: z.string() }),
});

const fixturesResponseSchema = z.object({
  data: z.array(fixtureSchema),
});

function normalizeTeam(participant: z.infer<typeof participantSchema>): NormalizedTeam {
  return {
    externalId: String(participant.id),
    name: participant.name,
    shortName: participant.short_code ?? undefined,
    logo: participant.image_path ?? undefined,
  };
}

function extractStat(details: z.infer<typeof standingDetailSchema>[], code: string): number {
  const detail = details.find((d) => d.type.code === code);
  if (!detail) {
    throw new Error(`Sportmonks standings row is missing expected stat "${code}" — response shape may have changed`);
  }
  return detail.value;
}

/** "CURRENT" is the authoritative current/final score; "1ST_HALF" is the half-time score. */
function scoreFor(scores: z.infer<typeof scoreEntrySchema>[], participantId: number, description: string): number | null {
  const entry = scores.find((s) => s.participant_id === participantId && s.description === description);
  return entry ? entry.score.goals : null;
}

export class SportmonksProvider implements FootballDataProvider {
  readonly id = "sportmonks" as const;

  private readonly rateLimiter = new RateLimiter("sportmonks", ["x-ratelimit-remaining"]);

  private get apiToken(): string {
    const token = process.env.SPORTMONKS_API_TOKEN;
    if (!token) throw new Error("SPORTMONKS_API_TOKEN is not set");
    return token;
  }

  private get baseUrl(): string {
    return process.env.SPORTMONKS_BASE_URL ?? "https://api.sportmonks.com/v3/football";
  }

  // Sportmonks accepts either a header or ?api_token= query param (both count
  // toward the same rate limit, per their docs); query param is used here
  // since it's the form actually confirmed working during live verification.
  private clientConfig() {
    return {
      provider: "sportmonks",
      baseUrl: this.baseUrl,
      headers: {},
      rateLimiter: this.rateLimiter,
    };
  }

  private leagueId(competitionSlug: string): number {
    const league = getLeague(competitionSlug);
    if (!league?.sportmonksLeagueId) {
      throw new Error(`No Sportmonks league id configured for "${competitionSlug}" (src/lib/config.ts)`);
    }
    return league.sportmonksLeagueId;
  }

  /** Looked up dynamically (never hardcoded) — a season id is only valid for one season and would go stale every year. */
  private async currentSeasonId(leagueId: number): Promise<number> {
    const data = await fetchJson(
      this.clientConfig(),
      `/leagues/${leagueId}?api_token=${this.apiToken}&include=currentSeason`,
      leagueWithCurrentSeasonSchema
    );
    if (!data.data.currentseason.is_current) {
      throw new Error(`Sportmonks league ${leagueId}: returned season is not marked as current`);
    }
    return data.data.currentseason.id;
  }

  async getStandings(competitionSlug: string): Promise<NormalizedStandings> {
    const leagueId = this.leagueId(competitionSlug);
    const seasonId = await this.currentSeasonId(leagueId);

    const data = await fetchJson(
      this.clientConfig(),
      `/standings/seasons/${seasonId}?api_token=${this.apiToken}&include=participant;details.type`,
      standingsResponseSchema
    );

    const rows = data.data.map((row) => {
      const goalsFor = extractStat(row.details, "overall-goals-for");
      const goalsAgainst = extractStat(row.details, "overall-goals-against");
      const played = extractStat(row.details, "overall-matches-played");
      return {
        team: normalizeTeam(row.participant),
        position: row.position,
        played,
        wins: extractStat(row.details, "overall-won"),
        draws: extractStat(row.details, "overall-draw"),
        losses: extractStat(row.details, "overall-lost"),
        goalsFor,
        goalsAgainst,
        goalDifference: goalsFor - goalsAgainst,
        points: row.points,
      };
    });

    // Sportmonks' standings endpoint doesn't expose a matchday number the
    // way football-data.org does — the max games-played across rows is a
    // reasonable proxy for "which round is this snapshot as of" (most teams
    // share the same count barring postponements), and LeagueStanding's
    // (seasonId, teamId, matchday) unique constraint needs a real number.
    const matchday = Math.max(...rows.map((row) => row.played));

    return { competitionSlug, matchday, rows };
  }

  async getFixtures(params: FetchFixturesParams): Promise<NormalizedFixture[]> {
    const leagueId = this.leagueId(params.competitionSlug);
    const from = (params.dateFrom ?? new Date()).toISOString().slice(0, 10);
    const to = (params.dateTo ?? new Date()).toISOString().slice(0, 10);

    const data = await fetchJson(
      this.clientConfig(),
      `/fixtures/between/${from}/${to}?api_token=${this.apiToken}&filters=fixtureLeagues:${leagueId}&include=participants;scores;state`,
      fixturesResponseSchema
    );

    return data.data.map((fixture) => {
      const home = fixture.participants.find((p) => p.meta.location === "home");
      const away = fixture.participants.find((p) => p.meta.location === "away");
      if (!home || !away) {
        throw new Error(`Sportmonks fixture ${fixture.id} is missing a home or away participant`);
      }

      const status = STATE_TO_MATCH_STATUS[fixture.state.developer_name];
      if (!status) {
        throw new Error(`Sportmonks fixture ${fixture.id}: unmapped state "${fixture.state.developer_name}"`);
      }

      return {
        externalId: String(fixture.id),
        competitionSlug: params.competitionSlug,
        matchday: null, // not requested via includes this pass — round/matchday needs the `round` include if needed later
        scheduledAt: new Date(fixture.starting_at.replace(" ", "T") + "Z"),
        status,
        homeTeam: normalizeTeam(home),
        awayTeam: normalizeTeam(away),
        homeScore: scoreFor(fixture.scores, home.id, "CURRENT"),
        awayScore: scoreFor(fixture.scores, away.id, "CURRENT"),
        halfTimeHomeScore: scoreFor(fixture.scores, home.id, "1ST_HALF"),
        halfTimeAwayScore: scoreFor(fixture.scores, away.id, "1ST_HALF"),
        venue: null,
      };
    });
  }
}
