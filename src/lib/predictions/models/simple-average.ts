import { buildPredictionOutput } from "@/lib/predictions/build-output";
import type { MatchContext, PredictionModel, PredictionOutput } from "@/lib/predictions/types";
import { average, HOME_ADVANTAGE_FACTOR } from "@/lib/predictions/models/shared";

/**
 * The simplest possible model: each team's own overall (venue-blind) scoring
 * rate, adjusted by a flat home-advantage constant. Ignores the opponent
 * entirely — the floor every other model should beat in Phase 8's backtests.
 */
export class SimpleAverageModel implements PredictionModel {
  readonly id = "simple-average";
  readonly version = "v1";

  predict(context: MatchContext): PredictionOutput {
    const homeAvgGoals = average(context.homeTeamOverall, "goalsFor");
    const awayAvgGoals = average(context.awayTeamOverall, "goalsFor");

    const lambdaHome = homeAvgGoals * HOME_ADVANTAGE_FACTOR;
    const lambdaAway = awayAvgGoals / HOME_ADVANTAGE_FACTOR;

    return buildPredictionOutput(lambdaHome, lambdaAway, {
      homeAvgGoals,
      awayAvgGoals,
      homeAdvantageFactor: HOME_ADVANTAGE_FACTOR,
    });
  }
}
