import { describe, expect, it } from "vitest";
import { getEnabledLeagues, getLeague, SUPPORTED_LEAGUES } from "./config";

describe("league config", () => {
  it("has no duplicate league ids", () => {
    const ids = SUPPORTED_LEAGUES.map((league) => league.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getLeague finds a known league by id", () => {
    expect(getLeague("premier-league")?.name).toBe("Premier League");
  });

  it("getLeague returns undefined for an unknown id", () => {
    expect(getLeague("not-a-real-league")).toBeUndefined();
  });

  it("getEnabledLeagues excludes leagues not yet wired up", () => {
    const enabled = getEnabledLeagues();
    expect(enabled.every((league) => league.enabled)).toBe(true);
    expect(enabled.find((league) => league.id === "champions-league")).toBeUndefined();
  });

  it("every enabled league has at least one provider mapping", () => {
    for (const league of getEnabledLeagues()) {
      expect(
        league.footballDataOrgCode !== undefined || league.apiFootballId !== undefined,
        `${league.id} has no provider mapping at all`
      ).toBe(true);
    }
  });
});
