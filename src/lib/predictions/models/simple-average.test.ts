import { describe, expect, it } from "vitest";
import { SimpleAverageModel } from "./simple-average";
import type { MatchContext } from "@/lib/predictions/types";
import type { TeamMatchRecord } from "@/lib/analytics/team-stats";

function record(goalsFor: number, goalsAgainst: number, isHome = true): TeamMatchRecord {
  return { matchId: 1, scheduledAt: new Date("2026-01-01"), isHome, goalsFor, goalsAgainst };
}

const EMPTY_CONTEXT: MatchContext = {
  homeTeamOverall: [],
  homeTeamHomeOnly: [],
  awayTeamOverall: [],
  awayTeamAwayOnly: [],
  leagueAverages: { avgHomeGoalsFor: 1.5, avgAwayGoalsFor: 1.1 },
};

describe("SimpleAverageModel", () => {
  it("gives a higher-scoring team a higher predicted lambda than a lower-scoring one", () => {
    const model = new SimpleAverageModel();
    const highScoringHome: MatchContext = {
      ...EMPTY_CONTEXT,
      homeTeamOverall: [record(3, 0), record(2, 1), record(3, 1)],
      awayTeamOverall: [record(0, 2), record(1, 1), record(0, 3)],
    };

    const output = model.predict(highScoringHome);
    expect(output.predictedHomeGoals).toBeGreaterThan(output.predictedAwayGoals);
    expect(output.predictedHomeWinProbability).toBeGreaterThan(output.predictedAwayWinProbability);
  });

  it("produces a valid (non-negative, non-NaN) output with no history at all", () => {
    const model = new SimpleAverageModel();
    const output = model.predict(EMPTY_CONTEXT);
    expect(output.predictedHomeGoals).toBe(0);
    expect(output.predictedAwayGoals).toBe(0);
    expect(Number.isNaN(output.predictedHomeWinProbability)).toBe(false);
  });

  it("applies the home advantage factor even to two evenly-matched teams", () => {
    const model = new SimpleAverageModel();
    const evenContext: MatchContext = {
      ...EMPTY_CONTEXT,
      homeTeamOverall: [record(1, 1), record(1, 1)],
      awayTeamOverall: [record(1, 1), record(1, 1)],
    };
    const output = model.predict(evenContext);
    expect(output.predictedHomeGoals).toBeGreaterThan(output.predictedAwayGoals);
  });
});
