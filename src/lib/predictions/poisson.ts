/**
 * The shared engine every prediction model feeds into. A model's real job is
 * just producing (lambdaHome, lambdaAway) — how a scoreline distribution and
 * match-outcome probabilities fall out of that pair is the same statistics
 * regardless of which model estimated the inputs (see the Phase 6 plan for
 * why this isn't duplicated per model).
 */

function factorial(n: number): number {
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

/** P(X = k) for a Poisson-distributed variable with rate lambda. */
export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export interface ScorelineMatrix {
  /** matrix[homeGoals][awayGoals] = probability of that exact scoreline. `maxGoals` is the highest goal count modeled individually — anything above is folded into the maxGoals row/column. */
  matrix: number[][];
  maxGoals: number;
}

export function buildScorelineMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 6): ScorelineMatrix {
  const homeProbs = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambdaHome));
  const awayProbs = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambdaAway));

  // Fold the tail (>maxGoals) into the last bucket so probabilities still sum to 1.
  const homeTail = 1 - homeProbs.reduce((sum, p) => sum + p, 0);
  const awayTail = 1 - awayProbs.reduce((sum, p) => sum + p, 0);
  homeProbs[maxGoals] += Math.max(homeTail, 0);
  awayProbs[maxGoals] += Math.max(awayTail, 0);

  const matrix = homeProbs.map((hp) => awayProbs.map((ap) => hp * ap));
  return { matrix, maxGoals };
}

export interface Scoreline {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

/**
 * The distribution's mode — the single most probable exact scoreline. Not
 * the same as rounding (lambdaHome, lambdaAway): for a Poisson distribution
 * the mode of the joint distribution isn't guaranteed to equal the rounded
 * mean of each marginal, especially for non-integer lambdas. Used for
 * "most likely score" displays and for exact-score prediction evaluation.
 */
export function mostLikelyScoreline(lambdaHome: number, lambdaAway: number, maxGoals = 6): Scoreline {
  const { matrix } = buildScorelineMatrix(lambdaHome, lambdaAway, maxGoals);

  let best: Scoreline = { homeGoals: 0, awayGoals: 0, probability: matrix[0][0] };
  for (let h = 0; h < matrix.length; h++) {
    for (let a = 0; a < matrix[h].length; a++) {
      if (matrix[h][a] > best.probability) {
        best = { homeGoals: h, awayGoals: a, probability: matrix[h][a] };
      }
    }
  }
  return best;
}

export interface OutcomeProbabilities {
  homeWinProbability: number;
  drawProbability: number;
  awayWinProbability: number;
  bttsProbability: number;
  over15Probability: number;
  over25Probability: number;
  over35Probability: number;
  expectedTotalGoals: number;
}

export function deriveOutcomeProbabilities(lambdaHome: number, lambdaAway: number, maxGoals = 6): OutcomeProbabilities {
  const { matrix } = buildScorelineMatrix(lambdaHome, lambdaAway, maxGoals);

  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  let btts = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      if (h > a) homeWin += p;
      else if (h < a) awayWin += p;
      else draw += p;

      if (h > 0 && a > 0) btts += p;
      const total = h + a;
      if (total > 1.5) over15 += p;
      if (total > 2.5) over25 += p;
      if (total > 3.5) over35 += p;
    }
  }

  return {
    homeWinProbability: homeWin,
    drawProbability: draw,
    awayWinProbability: awayWin,
    bttsProbability: btts,
    over15Probability: over15,
    over25Probability: over25,
    over35Probability: over35,
    expectedTotalGoals: lambdaHome + lambdaAway,
  };
}
