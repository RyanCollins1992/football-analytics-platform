import { describe, expect, it } from "vitest";
import { computeTeamStats, computeWeightedForm, type TeamMatchRecord } from "./team-stats";
import { linearWeights } from "./weighting";

function record(overrides: Partial<TeamMatchRecord>): TeamMatchRecord {
  return {
    matchId: 1,
    scheduledAt: new Date("2026-01-01"),
    isHome: true,
    goalsFor: 0,
    goalsAgainst: 0,
    ...overrides,
  };
}

describe("computeTeamStats", () => {
  it("returns all-zero stats for an empty record set (no divide-by-zero)", () => {
    const stats = computeTeamStats([]);
    expect(stats.played).toBe(0);
    expect(stats.winPercentage).toBe(0);
    expect(stats.pointsPerGame).toBe(0);
    expect(Number.isNaN(stats.winPercentage)).toBe(false);
  });

  it("computes a normal mixed W/D/L record correctly", () => {
    // 2 wins, 1 draw, 1 loss
    const records = [
      record({ goalsFor: 3, goalsAgainst: 1 }), // W
      record({ goalsFor: 1, goalsAgainst: 1 }), // D
      record({ goalsFor: 2, goalsAgainst: 0 }), // W, clean sheet
      record({ goalsFor: 0, goalsAgainst: 3 }), // L, failed to score
    ];

    const stats = computeTeamStats(records);
    expect(stats.played).toBe(4);
    expect(stats.wins).toBe(2);
    expect(stats.draws).toBe(1);
    expect(stats.losses).toBe(1);
    expect(stats.winPercentage).toBe(50);
    expect(stats.pointsPerGame).toBe((2 * 3 + 1) / 4); // 1.75
    expect(stats.goalsFor).toBe(3 + 1 + 2 + 0);
    expect(stats.goalsAgainst).toBe(1 + 1 + 0 + 3);
    expect(stats.goalDifference).toBe(stats.goalsFor - stats.goalsAgainst);
    expect(stats.cleanSheetPercentage).toBe(25); // only the 2-0 win
    expect(stats.failedToScorePercentage).toBe(25); // only the 0-3 loss
  });

  it("computes an all-wins record correctly", () => {
    const records = [
      record({ goalsFor: 2, goalsAgainst: 0 }),
      record({ goalsFor: 3, goalsAgainst: 1 }),
      record({ goalsFor: 1, goalsAgainst: 0 }),
    ];
    const stats = computeTeamStats(records);
    expect(stats.wins).toBe(3);
    expect(stats.winPercentage).toBe(100);
    expect(stats.pointsPerGame).toBe(3);
    expect(stats.cleanSheetPercentage).toBeCloseTo((2 / 3) * 100);
  });
});

describe("computeWeightedForm", () => {
  it("returns 0 for no matches", () => {
    expect(computeWeightedForm([])).toBe(0);
  });

  it("weighs a recent win more heavily than an old loss (newest-first input)", () => {
    // Most recent match first: a win, then further back an old loss.
    const recentWinOldLoss: TeamMatchRecord[] = [
      record({ goalsFor: 2, goalsAgainst: 0 }), // most recent: W
      record({ goalsFor: 0, goalsAgainst: 2 }), // older: L
    ];
    const recentLossOldWin: TeamMatchRecord[] = [
      record({ goalsFor: 0, goalsAgainst: 2 }), // most recent: L
      record({ goalsFor: 2, goalsAgainst: 0 }), // older: W
    ];

    const formA = computeWeightedForm(recentWinOldLoss, linearWeights);
    const formB = computeWeightedForm(recentLossOldWin, linearWeights);

    // Same two results (one win, one loss) in both sets — but the set with
    // the WIN weighted as most-recent should score higher.
    expect(formA).toBeGreaterThan(formB);
  });

  it("matches a hand-computed value with linear weights", () => {
    // 2 matches, linearWeights(2) = [1, 0.5]. Most recent = win (3pts), older = draw (1pt).
    const records: TeamMatchRecord[] = [
      record({ goalsFor: 1, goalsAgainst: 0 }), // W, weight 1
      record({ goalsFor: 1, goalsAgainst: 1 }), // D, weight 0.5
    ];
    const expected = (3 * 1 + 1 * 0.5) / (1 + 0.5);
    expect(computeWeightedForm(records, linearWeights)).toBeCloseTo(expected);
  });
});
