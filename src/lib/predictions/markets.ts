import type { ScorelineMatrix } from "@/lib/predictions/poisson";

/**
 * Every market here is a different way of summing the same ScorelineMatrix
 * a model already produces (buildScorelineMatrix, poisson.ts) — new
 * arithmetic over an existing, tested structure, not a new prediction
 * model. Deliberately independent of poisson.ts's internals beyond the
 * matrix shape, so this file has no risk of touching Phase 6's tested code.
 */

export interface MatchResultProbabilities {
  homeWin: number;
  draw: number;
  awayWin: number;
}

export function matchResult(scorelineMatrix: ScorelineMatrix): MatchResultProbabilities {
  const { matrix, maxGoals } = scorelineMatrix;
  let homeWin = 0;
  let draw = 0;
  let awayWin = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      if (h > a) homeWin += p;
      else if (h < a) awayWin += p;
      else draw += p;
    }
  }
  return { homeWin, draw, awayWin };
}

export interface DoubleChanceProbabilities {
  homeOrDraw: number;
  homeOrAway: number;
  drawOrAway: number;
}

export function doubleChance(result: MatchResultProbabilities): DoubleChanceProbabilities {
  return {
    homeOrDraw: result.homeWin + result.draw,
    homeOrAway: result.homeWin + result.awayWin,
    drawOrAway: result.draw + result.awayWin,
  };
}

export interface DrawNoBetProbabilities {
  homeWin: number;
  awayWin: number;
}

/** Conditional on the match not being a draw (a draw refunds the stake) — renormalized, not the raw win probabilities. */
export function drawNoBet(result: MatchResultProbabilities): DrawNoBetProbabilities {
  const decisive = result.homeWin + result.awayWin;
  if (decisive === 0) return { homeWin: 0, awayWin: 0 };
  return {
    homeWin: result.homeWin / decisive,
    awayWin: result.awayWin / decisive,
  };
}

export interface OverUnderProbabilities {
  over: number;
  under: number;
}

/** Generic for any line (0.5/1.5/2.5/...) — unlike the stored Prediction.predictedOver*Probability fields, this is computed live for the UI. */
export function overUnder(scorelineMatrix: ScorelineMatrix, line: number): OverUnderProbabilities {
  const { matrix, maxGoals } = scorelineMatrix;
  let over = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (h + a > line) over += matrix[h][a];
    }
  }
  return { over, under: 1 - over };
}

export interface BttsProbabilities {
  yes: number;
  no: number;
}

export function bttsFromMatrix(scorelineMatrix: ScorelineMatrix): BttsProbabilities {
  const { matrix, maxGoals } = scorelineMatrix;
  let yes = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      if (h > 0 && a > 0) yes += matrix[h][a];
    }
  }
  return { yes, no: 1 - yes };
}

export interface BttsAndResultProbabilities {
  homeWinBttsYes: number;
  homeWinBttsNo: number;
  drawBttsYes: number;
  drawBttsNo: number;
  awayWinBttsYes: number;
  awayWinBttsNo: number;
}

export function bttsAndResult(scorelineMatrix: ScorelineMatrix): BttsAndResultProbabilities {
  const { matrix, maxGoals } = scorelineMatrix;
  const result: BttsAndResultProbabilities = {
    homeWinBttsYes: 0,
    homeWinBttsNo: 0,
    drawBttsYes: 0,
    drawBttsNo: 0,
    awayWinBttsYes: 0,
    awayWinBttsNo: 0,
  };
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      const btts = h > 0 && a > 0;
      if (h > a) {
        if (btts) result.homeWinBttsYes += p;
        else result.homeWinBttsNo += p;
      } else if (h < a) {
        if (btts) result.awayWinBttsYes += p;
        else result.awayWinBttsNo += p;
      } else {
        if (btts) result.drawBttsYes += p;
        else result.drawBttsNo += p;
      }
    }
  }
  return result;
}

export interface BttsAndOverUnderProbabilities {
  bttsYesOver: number;
  bttsYesUnder: number;
  bttsNoOver: number;
  bttsNoUnder: number;
}

export function bttsAndOverUnder(scorelineMatrix: ScorelineMatrix, line: number): BttsAndOverUnderProbabilities {
  const { matrix, maxGoals } = scorelineMatrix;
  let bttsYesOver = 0;
  let bttsYesUnder = 0;
  let bttsNoOver = 0;
  let bttsNoUnder = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      const btts = h > 0 && a > 0;
      const over = h + a > line;
      if (btts && over) bttsYesOver += p;
      else if (btts && !over) bttsYesUnder += p;
      else if (!btts && over) bttsNoOver += p;
      else bttsNoUnder += p;
    }
  }
  return { bttsYesOver, bttsYesUnder, bttsNoOver, bttsNoUnder };
}

export interface HandicapProbabilities {
  homeCovers: number;
  push: number;
  awayCovers: number;
}

/**
 * `line` is applied to the home team's margin (e.g. -1 needs a 2+ goal win
 * to cover; +1 covers with anything better than a 2-goal loss). Half-integer
 * lines naturally produce push=0 — no special-casing needed, since h/a are
 * always integers and a .5 line can never tie the adjusted margin at 0.
 */
export function handicap(scorelineMatrix: ScorelineMatrix, line: number): HandicapProbabilities {
  const { matrix, maxGoals } = scorelineMatrix;
  let homeCovers = 0;
  let push = 0;
  let awayCovers = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      const adjustedMargin = h + line - a;
      if (adjustedMargin > 0) homeCovers += p;
      else if (adjustedMargin === 0) push += p;
      else awayCovers += p;
    }
  }
  return { homeCovers, push, awayCovers };
}

export interface MarginBuckets {
  one: number;
  two: number;
  three: number;
  fourPlus: number;
}

export interface WinningMarginProbabilities {
  home: MarginBuckets;
  draw: number;
  away: MarginBuckets;
}

export function winningMargin(scorelineMatrix: ScorelineMatrix): WinningMarginProbabilities {
  const { matrix, maxGoals } = scorelineMatrix;
  const home: MarginBuckets = { one: 0, two: 0, three: 0, fourPlus: 0 };
  const away: MarginBuckets = { one: 0, two: 0, three: 0, fourPlus: 0 };
  let draw = 0;
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      const margin = h - a;
      if (margin === 0) {
        draw += p;
        continue;
      }
      const bucket = margin > 0 ? home : away;
      const size = Math.abs(margin);
      if (size === 1) bucket.one += p;
      else if (size === 2) bucket.two += p;
      else if (size === 3) bucket.three += p;
      else bucket.fourPlus += p;
    }
  }
  return { home, draw, away };
}

export interface ScorelineProbability {
  homeGoals: number;
  awayGoals: number;
  probability: number;
}

/** Generalizes poisson.ts's single-result mostLikelyScoreline to the top n most probable exact scorelines. */
export function topCorrectScores(scorelineMatrix: ScorelineMatrix, n: number): ScorelineProbability[] {
  const { matrix, maxGoals } = scorelineMatrix;
  const all: ScorelineProbability[] = [];
  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      all.push({ homeGoals: h, awayGoals: a, probability: matrix[h][a] });
    }
  }
  return all.sort((x, y) => y.probability - x.probability).slice(0, n);
}
