/**
 * Aggregates a set of already-computed PredictionResult rows into the
 * summary stats spec section 13's model-performance table wants. Pure and
 * DB-free (same pattern as the rest of src/lib/predictions and
 * src/lib/analytics) — the backtest runner (Phase 8) and the future
 * live dashboard (Phase 9) both feed real queried rows through this same
 * function rather than each aggregating independently.
 */
export interface PredictionResultLike {
  homeWinCorrect: boolean;
  drawCorrect: boolean;
  awayWinCorrect: boolean;
  exactScoreCorrect: boolean;
  goalPredictionError: number;
  homeGoalError: number;
  awayGoalError: number;
  bttsCorrect: boolean;
  over15Correct: boolean | null;
  over25Correct: boolean | null;
  over35Correct: boolean | null;
}

export interface EvaluationSummary {
  matches: number;
  resultAccuracy: number;
  exactScoreAccuracy: number;
  goalMAE: number;
  homeGoalMAE: number;
  awayGoalMAE: number;
  bttsAccuracy: number;
  over15Accuracy: number | null;
  over25Accuracy: number | null;
  over35Accuracy: number | null;
}

const EMPTY: EvaluationSummary = {
  matches: 0,
  resultAccuracy: 0,
  exactScoreAccuracy: 0,
  goalMAE: 0,
  homeGoalMAE: 0,
  awayGoalMAE: 0,
  bttsAccuracy: 0,
  over15Accuracy: null,
  over25Accuracy: null,
  over35Accuracy: null,
};

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : (count / total) * 100;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Only averages over non-null entries; null if every entry is null (the field was never predicted for this set). */
function nullableAccuracy(values: (boolean | null)[]): number | null {
  const known = values.filter((v): v is boolean => v !== null);
  if (known.length === 0) return null;
  return percentage(known.filter(Boolean).length, known.length);
}

export function summarizeResults(results: PredictionResultLike[]): EvaluationSummary {
  if (results.length === 0) return EMPTY;

  const resultCorrectCount = results.filter((r) => r.homeWinCorrect || r.drawCorrect || r.awayWinCorrect).length;
  const exactScoreCount = results.filter((r) => r.exactScoreCorrect).length;
  const bttsCorrectCount = results.filter((r) => r.bttsCorrect).length;

  return {
    matches: results.length,
    resultAccuracy: percentage(resultCorrectCount, results.length),
    exactScoreAccuracy: percentage(exactScoreCount, results.length),
    goalMAE: mean(results.map((r) => r.goalPredictionError)),
    homeGoalMAE: mean(results.map((r) => r.homeGoalError)),
    awayGoalMAE: mean(results.map((r) => r.awayGoalError)),
    bttsAccuracy: percentage(bttsCorrectCount, results.length),
    over15Accuracy: nullableAccuracy(results.map((r) => r.over15Correct)),
    over25Accuracy: nullableAccuracy(results.map((r) => r.over25Correct)),
    over35Accuracy: nullableAccuracy(results.map((r) => r.over35Correct)),
  };
}
