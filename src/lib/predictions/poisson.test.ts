import { describe, expect, it } from "vitest";
import { buildScorelineMatrix, deriveOutcomeProbabilities, poissonPmf } from "./poisson";

describe("poissonPmf", () => {
  it("matches known values for lambda=1", () => {
    // Standard Poisson(1) values.
    expect(poissonPmf(0, 1)).toBeCloseTo(0.3679, 3);
    expect(poissonPmf(1, 1)).toBeCloseTo(0.3679, 3);
    expect(poissonPmf(2, 1)).toBeCloseTo(0.1839, 3);
  });

  it("returns P(0)=1 for lambda=0 (a team that never scores)", () => {
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(1, 0)).toBe(0);
  });
});

describe("buildScorelineMatrix", () => {
  it("sums to (very close to) 1 across the whole matrix", () => {
    const { matrix } = buildScorelineMatrix(1.4, 1.1, 6);
    const total = matrix.flat().reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("still sums to ~1 with a small maxGoals (more probability mass folded into the tail)", () => {
    const { matrix } = buildScorelineMatrix(2, 2, 2);
    const total = matrix.flat().reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});

describe("deriveOutcomeProbabilities", () => {
  it("gives equal home/away win probability when lambdas are equal (symmetric case)", () => {
    const result = deriveOutcomeProbabilities(1.3, 1.3);
    expect(result.homeWinProbability).toBeCloseTo(result.awayWinProbability, 6);
  });

  it("gives the home team a higher win probability when its lambda is higher", () => {
    const result = deriveOutcomeProbabilities(2.2, 0.9);
    expect(result.homeWinProbability).toBeGreaterThan(result.awayWinProbability);
    expect(result.homeWinProbability).toBeGreaterThan(result.drawProbability);
  });

  it("all outcome probabilities sum to ~1", () => {
    const result = deriveOutcomeProbabilities(1.7, 1.2);
    expect(result.homeWinProbability + result.drawProbability + result.awayWinProbability).toBeCloseTo(1, 6);
  });

  it("expectedTotalGoals is exactly lambdaHome + lambdaAway", () => {
    const result = deriveOutcomeProbabilities(1.6, 0.8);
    expect(result.expectedTotalGoals).toBeCloseTo(2.4, 10);
  });

  it("BTTS probability is 0 when either team never scores", () => {
    const result = deriveOutcomeProbabilities(0, 1.5);
    expect(result.bttsProbability).toBe(0);
  });

  it("a high-scoring matchup gives a higher over 2.5 probability than a low-scoring one", () => {
    const highScoring = deriveOutcomeProbabilities(2.5, 2.0);
    const lowScoring = deriveOutcomeProbabilities(0.6, 0.5);
    expect(highScoring.over25Probability).toBeGreaterThan(lowScoring.over25Probability);
  });
});
