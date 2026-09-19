import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FootballDataOrgProvider } from "./football-data-org";
import { ProviderApiError } from "@/lib/api/errors";
import { clearCache } from "@/lib/api/cache";

// Trimmed but structurally real — captured from a live football-data.org
// call on 2026-09-19 (see docs/providers.md), not guessed from the docs page.
const SAMPLE_STANDINGS_RESPONSE = {
  season: { currentMatchday: 5 },
  standings: [
    {
      type: "TOTAL",
      table: [
        {
          position: 1,
          team: { id: 57, name: "Arsenal FC", shortName: "Arsenal", tla: "ARS", crest: "https://crests.football-data.org/57.png" },
          playedGames: 4,
          won: 4,
          draw: 0,
          lost: 0,
          points: 12,
          goalsFor: 8,
          goalsAgainst: 1,
          goalDifference: 7,
        },
        {
          position: 2,
          team: { id: 65, name: "Manchester City FC", shortName: "Man City", tla: "MCI", crest: "https://crests.football-data.org/65.png" },
          playedGames: 4,
          won: 4,
          draw: 0,
          lost: 0,
          points: 12,
          goalsFor: 8,
          goalsAgainst: 2,
          goalDifference: 6,
        },
      ],
    },
  ],
};

const SAMPLE_FIXTURES_RESPONSE = {
  matches: [
    {
      id: 560587,
      utcDate: "2026-09-19T11:30:00Z",
      status: "FINISHED",
      matchday: 5,
      venue: null,
      homeTeam: { id: 73, name: "Tottenham Hotspur FC", shortName: "Tottenham", tla: "TOT", crest: "https://crests.football-data.org/73.png" },
      awayTeam: { id: 58, name: "Aston Villa FC", shortName: "Aston Villa", tla: "AVL", crest: "https://crests.football-data.org/58.png" },
      score: {
        fullTime: { home: 2, away: 3 },
        halfTime: { home: 0, away: 1 },
      },
    },
  ],
};

function mockFetchReturning(body: unknown, headers: Record<string, string> = {}) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

describe("FootballDataOrgProvider", () => {
  beforeEach(() => {
    vi.stubEnv("FOOTBALL_DATA_ORG_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearCache(); // the http client memoizes by URL — clear between tests or they'd see each other's mocked response
  });

  it("normalizes a standings response into NormalizedStandings", async () => {
    vi.stubGlobal("fetch", mockFetchReturning(SAMPLE_STANDINGS_RESPONSE));
    const provider = new FootballDataOrgProvider();

    const result = await provider.getStandings("premier-league");

    expect(result.matchday).toBe(5);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      position: 1,
      points: 12,
      goalDifference: 7,
      team: { externalId: "57", name: "Arsenal FC", shortName: "Arsenal" },
    });
  });

  it("normalizes a fixtures response into NormalizedFixture[]", async () => {
    vi.stubGlobal("fetch", mockFetchReturning(SAMPLE_FIXTURES_RESPONSE));
    const provider = new FootballDataOrgProvider();

    const result = await provider.getFixtures({ competitionSlug: "premier-league" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      externalId: "560587",
      status: "FINISHED",
      homeScore: 2,
      awayScore: 3,
      halfTimeHomeScore: 0,
      halfTimeAwayScore: 1,
      homeTeam: { externalId: "73", name: "Tottenham Hotspur FC" },
      awayTeam: { externalId: "58", name: "Aston Villa FC" },
    });
    expect(result[0].scheduledAt).toEqual(new Date("2026-09-19T11:30:00Z"));
  });

  it("throws ProviderApiError when the response doesn't match the expected shape", async () => {
    vi.stubGlobal("fetch", mockFetchReturning({ unexpected: "shape" }));
    const provider = new FootballDataOrgProvider();

    await expect(provider.getStandings("premier-league")).rejects.toThrow(ProviderApiError);
  });
});
