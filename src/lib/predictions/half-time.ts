import { buildScorelineMatrix, type ScorelineMatrix } from "@/lib/predictions/poisson";

/**
 * More goals tend to land in the second half than the first — a commonly-
 * cited general football constant (like HOME_ADVANTAGE_FACTOR in
 * models/shared.ts), not fitted to this project's own dataset. Treating
 * each half as an independent Poisson process (half-time goals ~ Poisson(λ
 * * share), second-half goals ~ Poisson(λ * (1 - share)), summing to the
 * full-time λ) is a real simplifying assumption, stated here rather than
 * hidden.
 */
export const HALF_TIME_GOAL_SHARE = 0.45;

export interface HalfTimeMatrices {
  htMatrix: ScorelineMatrix;
  secondHalfMatrix: ScorelineMatrix;
}

/** Half-time and second-half lambdas are naturally smaller than full-time — a smaller maxGoals keeps the joint grid small without losing meaningful probability mass. */
export function buildHalfTimeMatrices(
  lambdaHomeFT: number,
  lambdaAwayFT: number,
  share: number = HALF_TIME_GOAL_SHARE,
  maxGoals = 4
): HalfTimeMatrices {
  return {
    htMatrix: buildScorelineMatrix(lambdaHomeFT * share, lambdaAwayFT * share, maxGoals),
    secondHalfMatrix: buildScorelineMatrix(lambdaHomeFT * (1 - share), lambdaAwayFT * (1 - share), maxGoals),
  };
}

export type Outcome = "H" | "D" | "A";
export type OutcomeGrid = Record<Outcome, Record<Outcome, number>>;

function classify(homeGoals: number, awayGoals: number): Outcome {
  if (homeGoals > awayGoals) return "H";
  if (homeGoals < awayGoals) return "A";
  return "D";
}

/**
 * The HT/FT combo market: P(half-time outcome = X, full-time outcome = Y)
 * for all 9 combinations. Enumerates every (h1,a1,h2,a2) combination — at
 * most (maxGoals+1)^4 = 625 for the default maxGoals=4, small and fast.
 */
export function htFtJointGrid(htMatrix: ScorelineMatrix, secondHalfMatrix: ScorelineMatrix): OutcomeGrid {
  const grid: OutcomeGrid = { H: { H: 0, D: 0, A: 0 }, D: { H: 0, D: 0, A: 0 }, A: { H: 0, D: 0, A: 0 } };

  for (let h1 = 0; h1 <= htMatrix.maxGoals; h1++) {
    for (let a1 = 0; a1 <= htMatrix.maxGoals; a1++) {
      const pHt = htMatrix.matrix[h1][a1];
      if (pHt === 0) continue;
      const htOutcome = classify(h1, a1);

      for (let h2 = 0; h2 <= secondHalfMatrix.maxGoals; h2++) {
        for (let a2 = 0; a2 <= secondHalfMatrix.maxGoals; a2++) {
          const pSecondHalf = secondHalfMatrix.matrix[h2][a2];
          if (pSecondHalf === 0) continue;
          const ftOutcome = classify(h1 + h2, a1 + a2);
          grid[htOutcome][ftOutcome] += pHt * pSecondHalf;
        }
      }
    }
  }

  return grid;
}
