import { deriveOutcomeProbabilities } from "@/lib/predictions/poisson";
import type { PredictionOutput } from "@/lib/predictions/types";

/**
 * Every model ends with this call — it's the one place a (lambdaHome,
 * lambdaAway) pair turns into the full PredictionOutput shape, so the four
 * models never duplicate the Poisson-to-output mapping.
 */
export function buildPredictionOutput(
  lambdaHome: number,
  lambdaAway: number,
  modelParameters: Record<string, number>
): PredictionOutput {
  const outcome = deriveOutcomeProbabilities(lambdaHome, lambdaAway);
  return {
    predictedHomeGoals: lambdaHome,
    predictedAwayGoals: lambdaAway,
    predictedHomeWinProbability: outcome.homeWinProbability,
    predictedDrawProbability: outcome.drawProbability,
    predictedAwayWinProbability: outcome.awayWinProbability,
    predictedTotalGoals: outcome.expectedTotalGoals,
    predictedBttsProbability: outcome.bttsProbability,
    predictedOver15Probability: outcome.over15Probability,
    predictedOver25Probability: outcome.over25Probability,
    predictedOver35Probability: outcome.over35Probability,
    modelParameters,
  };
}
