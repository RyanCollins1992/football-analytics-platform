import { prisma } from "@/lib/database/client";
import { buildMatchContext } from "@/services/build-match-context";
import { getPredictionModel } from "@/lib/predictions";
import { logger } from "@/lib/api/logger";

const FEATURE_VERSION = "context-v1"; // bump if buildMatchContext's inputs ever change, for reproducibility (spec section 29)

/**
 * Always creates a new Prediction row — never overwrites (spec's explicit
 * rule, also why Prisma's schema has no unique constraint on matchId+modelId).
 * `dataCutoff` defaults to now (a real upcoming match has no earlier
 * meaningful cutoff), but is a parameter, not hardcoded, so Phase 8's
 * backtesting can call this same function with a historical cutoff instead
 * of duplicating prediction-generation logic.
 */
export async function generatePrediction(matchId: number, modelId: string, dataCutoff: Date = new Date()) {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { competition: true },
  });
  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const model = getPredictionModel(modelId);
  const context = await buildMatchContext(match.homeTeamId, match.awayTeamId, match.competition.slug, dataCutoff);
  const output = model.predict(context);

  logger.info("generating prediction", { matchId, modelId, dataCutoff });

  return prisma.prediction.create({
    data: {
      matchId,
      modelId: model.id,
      modelVersion: model.version,
      dataCutoff,
      featureVersion: FEATURE_VERSION,
      predictedHomeGoals: output.predictedHomeGoals,
      predictedAwayGoals: output.predictedAwayGoals,
      predictedHomeWinProbability: output.predictedHomeWinProbability,
      predictedDrawProbability: output.predictedDrawProbability,
      predictedAwayWinProbability: output.predictedAwayWinProbability,
      predictedTotalGoals: output.predictedTotalGoals,
      predictedBttsProbability: output.predictedBttsProbability,
      predictedOver15Probability: output.predictedOver15Probability,
      predictedOver25Probability: output.predictedOver25Probability,
      predictedOver35Probability: output.predictedOver35Probability,
      modelParameters: output.modelParameters,
    },
  });
}
