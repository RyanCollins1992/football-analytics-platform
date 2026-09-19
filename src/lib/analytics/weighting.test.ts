import { describe, expect, it } from "vitest";
import { exponentialDecayWeights, linearWeights, weightedAverage } from "@/lib/analytics/weighting";

describe("exponentialDecayWeights", () => {
  it("weights the most recent match as 1", () => {
    const weights = exponentialDecayWeights(4);
    expect(weights[0]).toBe(1);
  });

  it("halves weight every halfLife matches back, by construction", () => {
    const weights = exponentialDecayWeights(4, 3);
    expect(weights[3]).toBeCloseTo(0.5, 10);
  });

  it("respects a custom halfLife", () => {
    const weights = exponentialDecayWeights(4, 1);
    expect(weights).toEqual([1, 0.5, 0.25, 0.125]);
  });

  it("returns an empty array for n=0", () => {
    expect(exponentialDecayWeights(0)).toEqual([]);
  });
});

describe("linearWeights", () => {
  it("decreases by an equal step each match back", () => {
    expect(linearWeights(4)).toEqual([1, 0.75, 0.5, 0.25]);
  });

  it("floors at 1/n rather than reaching 0", () => {
    const weights = linearWeights(4);
    expect(weights[3]).toBeCloseTo(1 / 4, 10);
    expect(weights[3]).toBeGreaterThan(0);
  });

  it("returns an empty array for n=0", () => {
    expect(linearWeights(0)).toEqual([]);
  });

  it("weights the single match as 1 for n=1", () => {
    expect(linearWeights(1)).toEqual([1]);
  });
});

describe("weightedAverage", () => {
  it("computes a known weighted mean", () => {
    // (10*3 + 20*2 + 30*1) / (3+2+1) = 100/6
    expect(weightedAverage([10, 20, 30], [3, 2, 1])).toBeCloseTo(100 / 6, 10);
  });

  it("reduces to a plain mean when all weights are equal", () => {
    expect(weightedAverage([2, 4, 6], [1, 1, 1])).toBe(4);
  });

  it("returns 0 for an empty values array", () => {
    expect(weightedAverage([], [])).toBe(0);
  });

  it("returns 0 when every weight is zero, rather than dividing by zero", () => {
    expect(weightedAverage([10, 20], [0, 0])).toBe(0);
  });
});
