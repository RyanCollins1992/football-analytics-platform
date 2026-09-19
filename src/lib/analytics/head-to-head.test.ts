import { describe, expect, it } from "vitest";
import { computeHeadToHead, type HeadToHeadMatch } from "./head-to-head";
import { linearWeights } from "./weighting";

const TEAM_A = 1;
const TEAM_B = 2;

function match(overrides: Partial<HeadToHeadMatch>): HeadToHeadMatch {
  return {
    matchId: 1,
    scheduledAt: new Date("2026-01-01"),
    homeTeamId: TEAM_A,
    awayTeamId: TEAM_B,
    homeScore: 0,
    awayScore: 0,
    ...overrides,
  };
}

describe("computeHeadToHead", () => {
  it("returns a neutral zero result for no meetings", () => {
    const stats = computeHeadToHead(TEAM_A, TEAM_B, []);
    expect(stats.meetings).toBe(0);
    expect(stats.weightedTeamAFormShare).toBe(0.5);
    expect(Number.isNaN(stats.avgTotalGoals)).toBe(false);
  });

  it("counts wins correctly regardless of which side (home/away) team A played", () => {
    const matches: HeadToHeadMatch[] = [
      match({ homeTeamId: TEAM_A, awayTeamId: TEAM_B, homeScore: 2, awayScore: 0 }), // A wins as home
      match({ homeTeamId: TEAM_B, awayTeamId: TEAM_A, homeScore: 0, awayScore: 1 }), // A wins as away
      match({ homeTeamId: TEAM_A, awayTeamId: TEAM_B, homeScore: 1, awayScore: 1 }), // draw
      match({ homeTeamId: TEAM_B, awayTeamId: TEAM_A, homeScore: 3, awayScore: 1 }), // B wins (A away)
    ];

    const stats = computeHeadToHead(TEAM_A, TEAM_B, matches);
    expect(stats.meetings).toBe(4);
    expect(stats.teamAWins).toBe(2);
    expect(stats.teamBWins).toBe(1);
    expect(stats.draws).toBe(1);
  });

  it("computes BTTS and over/under thresholds correctly", () => {
    const matches: HeadToHeadMatch[] = [
      match({ homeScore: 2, awayScore: 1 }), // total 3, BTTS yes, over1.5 & over2.5, not over3.5
      match({ homeScore: 0, awayScore: 0 }), // total 0, none
      match({ homeScore: 4, awayScore: 2 }), // total 6, BTTS yes, all overs
    ];

    const stats = computeHeadToHead(TEAM_A, TEAM_B, matches);
    expect(stats.avgTotalGoals).toBeCloseTo((3 + 0 + 6) / 3);
    expect(stats.bttsPercentage).toBeCloseTo((2 / 3) * 100);
    expect(stats.over15Percentage).toBeCloseTo((2 / 3) * 100);
    expect(stats.over25Percentage).toBeCloseTo((2 / 3) * 100);
    expect(stats.over35Percentage).toBeCloseTo((1 / 3) * 100);
  });

  it("weighs a recent win for team A more than an old loss (newest-first input)", () => {
    const recentWinForA: HeadToHeadMatch[] = [
      match({ homeScore: 2, awayScore: 0 }), // most recent: A wins
      match({ homeTeamId: TEAM_B, awayTeamId: TEAM_A, homeScore: 2, awayScore: 0 }), // older: A loses
    ];
    const recentLossForA: HeadToHeadMatch[] = [
      match({ homeTeamId: TEAM_B, awayTeamId: TEAM_A, homeScore: 2, awayScore: 0 }), // most recent: A loses
      match({ homeScore: 2, awayScore: 0 }), // older: A wins
    ];

    const shareA = computeHeadToHead(TEAM_A, TEAM_B, recentWinForA, linearWeights).weightedTeamAFormShare;
    const shareB = computeHeadToHead(TEAM_A, TEAM_B, recentLossForA, linearWeights).weightedTeamAFormShare;

    expect(shareA).toBeGreaterThan(shareB);
    expect(shareA).toBeGreaterThan(0.5);
    expect(shareB).toBeLessThan(0.5);
  });
});
