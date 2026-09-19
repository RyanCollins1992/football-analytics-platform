import { describe, expect, it } from "vitest";
import { PoissonModel } from "./poisson-model";
import type { TeamMatchRecord } from "@/lib/analytics/team-stats";

function record(goalsFor: number, goalsAgainst: number, isHome: boolean): TeamMatchRecord {
  return { matchId: 1, scheduledAt: new Date("2026-01-01"), isHome, goalsFor, goalsAgainst };
}

const LEAGUE_AVERAGES = { avgHomeGoalsFor: 1.5, avgAwayGoalsFor: 1.1 };

describe("PoissonModel", () => {
  it("gives a team with exactly league-average home stats a lambda equal to the league average", () => {
    // Home attack = 1.5 (== avgHomeGoalsFor -> strength 1.0), home defense = 1.1 (== avgAwayGoalsFor -> strength 1.0)
    const homeTeamHomeOnly: TeamMatchRecord[] = [record(1.5, 1.1, true)];
    // Away attack = 1.1 (== avgAwayGoalsFor -> strength 1.0), away defense = 1.5 (== avgHomeGoalsFor -> strength 1.0)
    const awayTeamAwayOnly: TeamMatchRecord[] = [record(1.1, 1.5, false)];

    const output = new PoissonModel().predict({
      homeTeamOverall: homeTeamHomeOnly,
      homeTeamHomeOnly,
      awayTeamOverall: awayTeamAwayOnly,
      awayTeamAwayOnly,
      leagueAverages: LEAGUE_AVERAGES,
    });

    expect(output.predictedHomeGoals).toBeCloseTo(LEAGUE_AVERAGES.avgHomeGoalsFor, 5);
    expect(output.predictedAwayGoals).toBeCloseTo(LEAGUE_AVERAGES.avgAwayGoalsFor, 5);
  });

  it("gives a strong home attack facing a weak away defense a lambda well above league average", () => {
    const strongAttackHome: TeamMatchRecord[] = [record(3, 0, true), record(3, 1, true)];
    const weakAwayDefense: TeamMatchRecord[] = [record(1, 3, false), record(0, 4, false)];

    const output = new PoissonModel().predict({
      homeTeamOverall: strongAttackHome,
      homeTeamHomeOnly: strongAttackHome,
      awayTeamOverall: weakAwayDefense,
      awayTeamAwayOnly: weakAwayDefense,
      leagueAverages: LEAGUE_AVERAGES,
    });

    expect(output.predictedHomeGoals).toBeGreaterThan(LEAGUE_AVERAGES.avgHomeGoalsFor);
  });

  it("defaults strength ratios to league-average (1.0) rather than dividing by zero when league averages are unknown", () => {
    const someRecords: TeamMatchRecord[] = [record(2, 1, true)];
    const output = new PoissonModel().predict({
      homeTeamOverall: someRecords,
      homeTeamHomeOnly: someRecords,
      awayTeamOverall: someRecords,
      awayTeamAwayOnly: someRecords,
      leagueAverages: { avgHomeGoalsFor: 0, avgAwayGoalsFor: 0 },
    });
    expect(Number.isNaN(output.predictedHomeGoals)).toBe(false);
    expect(output.predictedHomeGoals).toBe(0); // avgHomeGoalsFor(0) * strength(1) * strength(1) = 0, not NaN
  });
});
