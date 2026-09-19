import { describe, expect, it } from "vitest";
import { RecentFormModel } from "./recent-form";
import { SimpleAverageModel } from "./simple-average";
import type { MatchContext } from "@/lib/predictions/types";
import type { TeamMatchRecord } from "@/lib/analytics/team-stats";

function record(goalsFor: number, goalsAgainst: number): TeamMatchRecord {
  return { matchId: 1, scheduledAt: new Date("2026-01-01"), isHome: true, goalsFor, goalsAgainst };
}

const BASE_CONTEXT: Omit<MatchContext, "homeTeamOverall" | "awayTeamOverall"> = {
  homeTeamHomeOnly: [],
  awayTeamAwayOnly: [],
  leagueAverages: { avgHomeGoalsFor: 1.5, avgAwayGoalsFor: 1.1 },
};

describe("RecentFormModel", () => {
  it("weighs a recent scoring surge more heavily than Simple Average's flat mean", () => {
    // Newest-first: team scored a lot recently but was quiet a while back.
    // Flat average and weighted average both see the same total, but the
    // weighted one should lean toward the recent (higher-scoring) matches.
    const homeTeamOverall: TeamMatchRecord[] = [
      record(4, 0), // most recent
      record(3, 0),
      record(0, 2),
      record(0, 3), // oldest
    ];
    const context: MatchContext = { ...BASE_CONTEXT, homeTeamOverall, awayTeamOverall: [record(1, 1), record(1, 1)] };

    const weighted = new RecentFormModel().predict(context).predictedHomeGoals;
    const flat = new SimpleAverageModel().predict(context).predictedHomeGoals;

    expect(weighted).toBeGreaterThan(flat);
  });

  it("produces a valid output with no history", () => {
    const context: MatchContext = { ...BASE_CONTEXT, homeTeamOverall: [], awayTeamOverall: [] };
    const output = new RecentFormModel().predict(context);
    expect(output.predictedHomeGoals).toBe(0);
    expect(Number.isNaN(output.predictedTotalGoals)).toBe(false);
  });
});
