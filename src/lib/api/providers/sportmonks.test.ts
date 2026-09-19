import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SportmonksProvider } from "./sportmonks";
import { clearCache } from "@/lib/api/cache";

// Trimmed but structurally real — captured from live Sportmonks calls on
// 2026-09-19 for Scottish Premiership (league 501, season 28275), not
// guessed from the docs (see docs/providers.md).

const SAMPLE_LEAGUE_RESPONSE = {
  data: {
    id: 501,
    currentseason: { id: 28275, is_current: true },
  },
};

const SAMPLE_STANDINGS_RESPONSE = {
  data: [
    {
      position: 1,
      points: 18,
      participant: { id: 53, name: "Celtic", short_code: "CEL", image_path: "https://cdn.sportmonks.com/images/soccer/teams/21/53.png" },
      details: [
        { value: 6, type: { code: "overall-matches-played" } },
        { value: 6, type: { code: "overall-won" } },
        { value: 0, type: { code: "overall-draw" } },
        { value: 0, type: { code: "overall-lost" } },
        { value: 14, type: { code: "overall-goals-for" } },
        { value: 3, type: { code: "overall-goals-against" } },
      ],
    },
  ],
};

const SAMPLE_FIXTURES_RESPONSE = {
  data: [
    {
      id: 19722808,
      starting_at: "2026-09-15 18:45:00",
      state: { developer_name: "FT" },
      participants: [
        { id: 273, name: "Aberdeen", short_code: "ABE", image_path: null, meta: { location: "away" } },
        { id: 309, name: "Motherwell", short_code: "MOT", image_path: null, meta: { location: "home" } },
      ],
      scores: [
        { participant_id: 273, description: "1ST_HALF", score: { goals: 1 } },
        { participant_id: 309, description: "1ST_HALF", score: { goals: 0 } },
        { participant_id: 273, description: "CURRENT", score: { goals: 4 } },
        { participant_id: 309, description: "CURRENT", score: { goals: 0 } },
      ],
    },
  ],
};

function mockFetchSequence(...bodies: unknown[]) {
  const fn = vi.fn();
  for (const body of bodies) {
    fn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "x-ratelimit-remaining": "178" }),
      json: async () => body,
      text: async () => JSON.stringify(body),
    });
  }
  return fn;
}

describe("SportmonksProvider", () => {
  beforeEach(() => {
    vi.stubEnv("SPORTMONKS_API_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    clearCache();
  });

  it("normalizes a standings response, using max games-played as the matchday proxy", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(SAMPLE_LEAGUE_RESPONSE, SAMPLE_STANDINGS_RESPONSE));
    const provider = new SportmonksProvider();

    const result = await provider.getStandings("scottish-premiership");

    expect(result.matchday).toBe(6);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      position: 1,
      points: 18,
      played: 6,
      wins: 6,
      goalsFor: 14,
      goalsAgainst: 3,
      goalDifference: 11,
      team: { externalId: "53", name: "Celtic", shortName: "CEL" },
    });
  });

  it("normalizes a fixtures response, resolving home/away by participant meta and CURRENT/1ST_HALF scores", async () => {
    vi.stubGlobal("fetch", mockFetchSequence(SAMPLE_FIXTURES_RESPONSE));
    const provider = new SportmonksProvider();

    const result = await provider.getFixtures({ competitionSlug: "scottish-premiership" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      externalId: "19722808",
      status: "FINISHED",
      homeTeam: { externalId: "309", name: "Motherwell" },
      awayTeam: { externalId: "273", name: "Aberdeen" },
      homeScore: 0,
      awayScore: 4,
      halfTimeHomeScore: 0,
      halfTimeAwayScore: 1,
    });
  });
});
