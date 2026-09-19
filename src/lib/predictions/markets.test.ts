import { describe, expect, it } from "vitest";
import type { ScorelineMatrix } from "@/lib/predictions/poisson";
import { buildScorelineMatrix } from "@/lib/predictions/poisson";
import {
  bttsAndOverUnder,
  bttsAndResult,
  bttsFromMatrix,
  doubleChance,
  drawNoBet,
  handicap,
  matchResult,
  overUnder,
  topCorrectScores,
  winningMargin,
} from "@/lib/predictions/markets";

/**
 * A hand-constructed (not Poisson-generated) 3x3 matrix, sums to exactly 1 —
 * every expected value below is computed by hand from this table, not
 * cross-checked against another function. Rows = home goals (0-2), columns
 * = away goals (0-2).
 *
 *        a=0   a=1   a=2
 * h=0:  0.10  0.05  0.05
 * h=1:  0.15  0.20  0.05
 * h=2:  0.10  0.05  0.25
 */
const MATRIX: ScorelineMatrix = {
  maxGoals: 2,
  matrix: [
    [0.1, 0.05, 0.05],
    [0.15, 0.2, 0.05],
    [0.1, 0.05, 0.25],
  ],
};

describe("matchResult", () => {
  it("sums cells by home/draw/away, matching hand computation", () => {
    const result = matchResult(MATRIX);
    expect(result.homeWin).toBeCloseTo(0.3, 10); // (1,0)+(2,0)+(2,1) = 0.15+0.10+0.05
    expect(result.draw).toBeCloseTo(0.55, 10); // (0,0)+(1,1)+(2,2) = 0.10+0.20+0.25
    expect(result.awayWin).toBeCloseTo(0.15, 10); // (0,1)+(0,2)+(1,2) = 0.05+0.05+0.05
    expect(result.homeWin + result.draw + result.awayWin).toBeCloseTo(1, 10);
  });

  it("is symmetric for equal lambdas (real Poisson matrix, not the hand-built fixture)", () => {
    const symmetric = buildScorelineMatrix(1.4, 1.4);
    const result = matchResult(symmetric);
    expect(result.homeWin).toBeCloseTo(result.awayWin, 10);
  });
});

describe("doubleChance", () => {
  it("sums the relevant pairs of matchResult", () => {
    const dc = doubleChance(matchResult(MATRIX));
    expect(dc.homeOrDraw).toBeCloseTo(0.85, 10);
    expect(dc.homeOrAway).toBeCloseTo(0.45, 10);
    expect(dc.drawOrAway).toBeCloseTo(0.7, 10);
  });
});

describe("drawNoBet", () => {
  it("renormalizes over decisive results only", () => {
    const dnb = drawNoBet(matchResult(MATRIX));
    expect(dnb.homeWin).toBeCloseTo(0.3 / 0.45, 10);
    expect(dnb.awayWin).toBeCloseTo(0.15 / 0.45, 10);
    expect(dnb.homeWin + dnb.awayWin).toBeCloseTo(1, 10);
  });

  it("returns 0/0 rather than dividing by zero when every result is a draw", () => {
    const allDraws: ScorelineMatrix = { maxGoals: 1, matrix: [[0.5, 0], [0, 0.5]] };
    const dnb = drawNoBet(matchResult(allDraws));
    expect(dnb).toEqual({ homeWin: 0, awayWin: 0 });
  });
});

describe("overUnder", () => {
  it("computes Over/Under 1.5 by hand", () => {
    const ou = overUnder(MATRIX, 1.5);
    expect(ou.over).toBeCloseTo(0.7, 10);
    expect(ou.under).toBeCloseTo(0.3, 10);
  });

  it("computes Over/Under 0.5 by hand", () => {
    const ou = overUnder(MATRIX, 0.5);
    expect(ou.over).toBeCloseTo(0.9, 10);
    expect(ou.under).toBeCloseTo(0.1, 10);
  });
});

describe("bttsFromMatrix", () => {
  it("sums cells where both teams score", () => {
    const btts = bttsFromMatrix(MATRIX);
    expect(btts.yes).toBeCloseTo(0.55, 10); // (1,1)+(1,2)+(2,1)+(2,2)
    expect(btts.no).toBeCloseTo(0.45, 10);
  });
});

describe("bttsAndResult", () => {
  it("splits each result by BTTS, matching hand computation", () => {
    const combo = bttsAndResult(MATRIX);
    expect(combo.homeWinBttsYes).toBeCloseTo(0.05, 10); // (2,1)
    expect(combo.homeWinBttsNo).toBeCloseTo(0.25, 10); // (1,0)+(2,0)
    expect(combo.drawBttsYes).toBeCloseTo(0.45, 10); // (1,1)+(2,2)
    expect(combo.drawBttsNo).toBeCloseTo(0.1, 10); // (0,0)
    expect(combo.awayWinBttsYes).toBeCloseTo(0.05, 10); // (1,2)
    expect(combo.awayWinBttsNo).toBeCloseTo(0.1, 10); // (0,1)+(0,2)
    const total =
      combo.homeWinBttsYes + combo.homeWinBttsNo + combo.drawBttsYes + combo.drawBttsNo + combo.awayWinBttsYes + combo.awayWinBttsNo;
    expect(total).toBeCloseTo(1, 10);
  });
});

describe("bttsAndOverUnder", () => {
  it("splits BTTS by Over/Under 1.5, matching hand computation", () => {
    const combo = bttsAndOverUnder(MATRIX, 1.5);
    expect(combo.bttsYesOver).toBeCloseTo(0.55, 10); // every BTTS-yes cell has total >= 2
    expect(combo.bttsYesUnder).toBeCloseTo(0, 10);
    expect(combo.bttsNoOver).toBeCloseTo(0.15, 10); // (0,2)+(2,0)
    expect(combo.bttsNoUnder).toBeCloseTo(0.3, 10); // (0,0)+(0,1)+(1,0)
  });
});

describe("handicap", () => {
  it("computes home -1 handicap by hand", () => {
    const h = handicap(MATRIX, -1);
    expect(h.homeCovers).toBeCloseTo(0.1, 10); // (2,0)
    expect(h.push).toBeCloseTo(0.2, 10); // (1,0)+(2,1)
    expect(h.awayCovers).toBeCloseTo(0.7, 10);
    expect(h.homeCovers + h.push + h.awayCovers).toBeCloseTo(1, 10);
  });

  it("never produces a push on a half-integer line", () => {
    const h = handicap(MATRIX, -1.5);
    expect(h.push).toBe(0);
  });
});

describe("winningMargin", () => {
  it("buckets by exact goal difference, matching hand computation", () => {
    const margin = winningMargin(MATRIX);
    expect(margin.home).toEqual({ one: 0.2, two: 0.1, three: 0, fourPlus: 0 });
    expect(margin.away).toEqual({ one: 0.1, two: 0.05, three: 0, fourPlus: 0 });
    expect(margin.draw).toBeCloseTo(0.55, 10);
  });
});

describe("topCorrectScores", () => {
  it("returns the most probable scorelines in descending order", () => {
    const top = topCorrectScores(MATRIX, 2);
    expect(top).toEqual([
      { homeGoals: 2, awayGoals: 2, probability: 0.25 },
      { homeGoals: 1, awayGoals: 1, probability: 0.2 },
    ]);
  });
});
