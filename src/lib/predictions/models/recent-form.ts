import { exponentialDecayWeights, weightedAverage } from "@/lib/analytics/weighting";
import { buildPredictionOutput } from "@/lib/predictions/build-output";
import type { MatchContext, PredictionModel, PredictionOutput } from "@/lib/predictions/types";
import { HOME_ADVANTAGE_FACTOR } from "@/lib/predictions/models/shared";

/**
 * Same shape as Simple Average, but the scoring rate is a recency-weighted
 * average (records must already be newest-first, same convention as
 * src/lib/analytics) instead of a flat average over all history — a team on
 * a hot or cold streak gets reflected here, not just its season-long mean.
 */
export class RecentFormModel implements PredictionModel {
  readonly id = "recent-form";
  readonly version = "v1";

  predict(context: MatchContext): PredictionOutput {
    const homeGoals = context.homeTeamOverall.map((r) => r.goalsFor);
    const awayGoals = context.awayTeamOverall.map((r) => r.goalsFor);

    const homeWeightedAvg = weightedAverage(homeGoals, exponentialDecayWeights(homeGoals.length));
    const awayWeightedAvg = weightedAverage(awayGoals, exponentialDecayWeights(awayGoals.length));

    const lambdaHome = homeWeightedAvg * HOME_ADVANTAGE_FACTOR;
    const lambdaAway = awayWeightedAvg / HOME_ADVANTAGE_FACTOR;

    return buildPredictionOutput(lambdaHome, lambdaAway, {
      homeWeightedAvgGoals: homeWeightedAvg,
      awayWeightedAvgGoals: awayWeightedAvg,
      homeAdvantageFactor: HOME_ADVANTAGE_FACTOR,
    });
  }
}
