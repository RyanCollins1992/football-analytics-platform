import { describe, expect, it } from "vitest";
import { poissonPmf } from "@/lib/predictions/poisson";
import { buildHalfTimeMatrices, htFtJointGrid, HALF_TIME_GOAL_SHARE } from "@/lib/predictions/half-time";
import { matchResult } from "@/lib/predictions/markets";

describe("HALF_TIME_GOAL_SHARE", () => {
  it("is the documented 0.45", () => {
    expect(HALF_TIME_GOAL_SHARE).toBe(0.45);
  });
});

describe("buildHalfTimeMatrices", () => {
  it("splits full-time lambda into half-time and second-half lambdas by the given share", () => {
    const { htMatrix, secondHalfMatrix } = buildHalfTimeMatrices(2, 1, 0.5);
    // share=0.5 means both halves get lambdaHomeFT/2=1 and lambdaAwayFT/2=0.5
    expect(htMatrix.matrix[0][0]).toBeCloseTo(poissonPmf(0, 1) * poissonPmf(0, 0.5), 10);
    expect(secondHalfMatrix.matrix[0][0]).toBeCloseTo(poissonPmf(0, 1) * poissonPmf(0, 0.5), 10);
  });

  it("gives the second half a larger share of goals under the default constant", () => {
    // With HALF_TIME_GOAL_SHARE=0.45, the second half's lambda (0.55 of full-time)
    // is larger, so scoring 0 goals in the second half is less likely than in the first.
    const { htMatrix, secondHalfMatrix } = buildHalfTimeMatrices(2, 2);
    expect(secondHalfMatrix.matrix[0][0]).toBeLessThan(htMatrix.matrix[0][0]);
  });
});

describe("htFtJointGrid", () => {
  it("produces a probability grid whose 9 cells sum to 1", () => {
    const { htMatrix, secondHalfMatrix } = buildHalfTimeMatrices(1.5, 1.2);
    const grid = htFtJointGrid(htMatrix, secondHalfMatrix);
    const total = (["H", "D", "A"] as const)
      .flatMap((ht) => (["H", "D", "A"] as const).map((ft) => grid[ht][ft]))
      .reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 8);
  });

  it("the half-time marginal (summed over full-time outcomes) matches matchResult(htMatrix)", () => {
    const { htMatrix, secondHalfMatrix } = buildHalfTimeMatrices(1.5, 1.2);
    const grid = htFtJointGrid(htMatrix, secondHalfMatrix);
    const htResult = matchResult(htMatrix);

    expect(grid.H.H + grid.H.D + grid.H.A).toBeCloseTo(htResult.homeWin, 8);
    expect(grid.D.H + grid.D.D + grid.D.A).toBeCloseTo(htResult.draw, 8);
    expect(grid.A.H + grid.A.D + grid.A.A).toBeCloseTo(htResult.awayWin, 8);
  });
});
