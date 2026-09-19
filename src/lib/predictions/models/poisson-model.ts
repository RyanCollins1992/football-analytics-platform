import { buildPredictionOutput } from "@/lib/predictions/build-output";
import type { MatchContext, PredictionModel, PredictionOutput } from "@/lib/predictions/types";
import { average } from "@/lib/predictions/models/shared";

/**
 * The classic attack/defense-strength method (the same base idea Dixon-Coles
 * builds on): each team's venue-specific scoring/conceding rate is expressed
 * relative to the *league* average for that venue, not just relative to one
 * opponent (that's what distinguishes this from Model 3). A strength of 1.0
 * means "exactly league average"; ratios compound multiplicatively.
 */
export class PoissonModel implements PredictionModel {
  readonly id = "poisson";
  readonly version = "v1";

  predict(context: MatchContext): PredictionOutput {
    const { avgHomeGoalsFor, avgAwayGoalsFor } = context.leagueAverages;

    const homeAttackStrength = safeRatio(average(context.homeTeamHomeOnly, "goalsFor"), avgHomeGoalsFor);
    const homeDefenseStrength = safeRatio(average(context.homeTeamHomeOnly, "goalsAgainst"), avgAwayGoalsFor);
    const awayAttackStrength = safeRatio(average(context.awayTeamAwayOnly, "goalsFor"), avgAwayGoalsFor);
    const awayDefenseStrength = safeRatio(average(context.awayTeamAwayOnly, "goalsAgainst"), avgHomeGoalsFor);

    const lambdaHome = avgHomeGoalsFor * homeAttackStrength * awayDefenseStrength;
    const lambdaAway = avgAwayGoalsFor * awayAttackStrength * homeDefenseStrength;

    return buildPredictionOutput(lambdaHome, lambdaAway, {
      homeAttackStrength,
      homeDefenseStrength,
      awayAttackStrength,
      awayDefenseStrength,
      leagueAvgHomeGoals: avgHomeGoalsFor,
      leagueAvgAwayGoals: avgAwayGoalsFor,
    });
  }
}

/** A strength ratio against a zero/unknown league baseline is undefined, not zero — default to "league average" (1.0) rather than silently zeroing out the prediction. */
function safeRatio(value: number, baseline: number): number {
  return baseline === 0 ? 1 : value / baseline;
}
