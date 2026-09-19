/**
 * Weighting strategies for "recent matches matter more" (spec sections 5 and
 * 6). Both return weights most-recent-first, aligned to how every caller
 * already orders match records (newest first) — index 0 is always the most
 * recent match.
 */

export type WeightFn = (n: number) => number[];

/** Weight halves every `halfLife` matches back. Default halfLife=3 means the 4th-most-recent match counts half as much as the most recent. */
export function exponentialDecayWeights(n: number, halfLife = 3): number[] {
  const decay = Math.pow(0.5, 1 / halfLife);
  return Array.from({ length: n }, (_, i) => Math.pow(decay, i));
}

/** Weight decreases by an equal step each match back, floored at a small positive value so the oldest match still counts a little. */
export function linearWeights(n: number): number[] {
  if (n === 0) return [];
  return Array.from({ length: n }, (_, i) => Math.max(1 - i / n, 1 / n));
}

/** Generic weighted mean — used for weighted points (computeWeightedForm), weighted goals (Recent Form prediction model), and anywhere else "recent matters more" applies to a plain number series. */
export function weightedAverage(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  let weightedSum = 0;
  let totalWeight = 0;
  values.forEach((value, i) => {
    weightedSum += value * weights[i];
    totalWeight += weights[i];
  });
  return totalWeight === 0 ? 0 : weightedSum / totalWeight;
}
