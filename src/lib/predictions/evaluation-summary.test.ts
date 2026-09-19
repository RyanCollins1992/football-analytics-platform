import { describe, expect, it } from "vitest";
import { summarizeResults, type PredictionResultLike } from "./evaluation-summary";

function result(overrides: Partial<PredictionResultLike>): PredictionResultLike {
  return {
    homeWinCorrect: false,
    drawCorrect: false,
    awayWinCorrect: false,
    exactScoreCorrect: false,
    goalPredictionError: 0,
    homeGoalError: 0,
    awayGoalError: 0,
    bttsCorrect: false,
    over15Correct: null,
    over25Correct: null,
    over35Correct: null,
    ...overrides,
  };
}

describe("summarizeResults", () => {
  it("returns the empty summary for no results (no divide-by-zero)", () => {
    const summary = summarizeResults([]);
    expect(summary.matches).toBe(0);
    expect(summary.resultAccuracy).toBe(0);
    expect(summary.over25Accuracy).toBeNull();
  });

  it("computes result accuracy as the fraction of predictions that got the outcome right", () => {
    const results = [
      result({ homeWinCorrect: true }), // correct
      result({ drawCorrect: true }), // correct
      result({}), // wrong (none of the three flags set)
      result({ awayWinCorrect: true }), // correct
    ];
    const summary = summarizeResults(results);
    expect(summary.matches).toBe(4);
    expect(summary.resultAccuracy).toBe(75);
  });

  it("computes goal MAE as the mean of goalPredictionError", () => {
    const results = [result({ goalPredictionError: 1 }), result({ goalPredictionError: 3 }), result({ goalPredictionError: 2 })];
    expect(summarizeResults(results).goalMAE).toBeCloseTo(2);
  });

  it("computes home/away goal MAE independently", () => {
    const results = [
      result({ homeGoalError: 0, awayGoalError: 4 }),
      result({ homeGoalError: 2, awayGoalError: 0 }),
    ];
    const summary = summarizeResults(results);
    expect(summary.homeGoalMAE).toBeCloseTo(1);
    expect(summary.awayGoalMAE).toBeCloseTo(2);
  });

  it("computes BTTS accuracy correctly", () => {
    const results = [result({ bttsCorrect: true }), result({ bttsCorrect: true }), result({ bttsCorrect: false })];
    expect(summarizeResults(results).bttsAccuracy).toBeCloseTo((2 / 3) * 100);
  });

  it("returns null for an over/under line that was never predicted (all null), but computes the others", () => {
    const results = [
      result({ over15Correct: true, over25Correct: null }),
      result({ over15Correct: false, over25Correct: null }),
    ];
    const summary = summarizeResults(results);
    expect(summary.over15Accuracy).toBe(50);
    expect(summary.over25Accuracy).toBeNull();
  });

  it("averages an over/under accuracy only over the entries where it's known, not counting nulls in the denominator", () => {
    const results = [
      result({ over25Correct: true }),
      result({ over25Correct: true }),
      result({ over25Correct: null }), // e.g. an older prediction that never stored this field
    ];
    // 2 known, both correct -> 100%, not 2/3
    expect(summarizeResults(results).over25Accuracy).toBe(100);
  });
});
