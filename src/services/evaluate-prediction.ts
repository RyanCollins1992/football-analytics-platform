import { prisma } from "@/lib/database/client";
import { mostLikelyScoreline } from "@/lib/predictions/poisson";
import { logger } from "@/lib/api/logger";

type Outcome = "home" | "draw" | "away";

function argmaxOutcome(homeWinProb: number, drawProb: number, awayWinProb: number): Outcome {
  if (homeWinProb >= drawProb && homeWinProb >= awayWinProb) return "home";
  if (drawProb >= awayWinProb) return "draw";
  return "away";
}

/**
 * Creates a new PredictionResult — fails loudly (via the schema's unique
 * constraint on predictionId) rather than silently overwriting if called
 * twice for the same prediction.
 */
export async function evaluatePrediction(predictionId: number) {
  const prediction = await prisma.prediction.findUnique({
    where: { id: predictionId },
    include: { match: true, result: true },
  });
  if (!prediction) {
    throw new Error(`Prediction ${predictionId} not found`);
  }
  if (prediction.result) {
    throw new Error(`Prediction ${predictionId} already has a result — evaluations are never overwritten`);
  }
  const { match } = prediction;
  if (match.status !== "FINISHED" || match.homeScore === null || match.awayScore === null) {
    throw new Error(`Match ${match.id} hasn't finished yet — nothing to evaluate against`);
  }

  const actualHomeGoals = match.homeScore;
  const actualAwayGoals = match.awayScore;
  const actualTotalGoals = actualHomeGoals + actualAwayGoals;
  const actualOutcome: Outcome = actualHomeGoals > actualAwayGoals ? "home" : actualHomeGoals < actualAwayGoals ? "away" : "draw";
  const predictedOutcome = argmaxOutcome(
    prediction.predictedHomeWinProbability,
    prediction.predictedDrawProbability,
    prediction.predictedAwayWinProbability
  );

  // Exactly one of these three is true per evaluation: "was the model's top
  // pick actually right", broken down by which outcome it was — not three
  // independent judgments.
  const homeWinCorrect = predictedOutcome === "home" && actualOutcome === "home";
  const drawCorrect = predictedOutcome === "draw" && actualOutcome === "draw";
  const awayWinCorrect = predictedOutcome === "away" && actualOutcome === "away";

  // Compared against the distribution's mode, not rounded lambda — see Phase 7 plan decision 4.
  const mode = mostLikelyScoreline(prediction.predictedHomeGoals, prediction.predictedAwayGoals);
  const exactScoreCorrect = mode.homeGoals === actualHomeGoals && mode.awayGoals === actualAwayGoals;

  const actualBtts = actualHomeGoals > 0 && actualAwayGoals > 0;
  const bttsCorrect = (prediction.predictedBttsProbability >= 0.5) === actualBtts;

  const overCorrect = (predictedProb: number | null, line: number) =>
    predictedProb === null ? null : (predictedProb >= 0.5) === (actualTotalGoals > line);

  logger.info("evaluating prediction", { predictionId, matchId: match.id, actualHomeGoals, actualAwayGoals });

  return prisma.predictionResult.create({
    data: {
      predictionId,
      actualHomeGoals,
      actualAwayGoals,
      actualTotalGoals,
      homeWinCorrect,
      drawCorrect,
      awayWinCorrect,
      exactScoreCorrect,
      goalPredictionError: Math.abs(prediction.predictedTotalGoals - actualTotalGoals),
      homeGoalError: Math.abs(prediction.predictedHomeGoals - actualHomeGoals),
      awayGoalError: Math.abs(prediction.predictedAwayGoals - actualAwayGoals),
      bttsCorrect,
      over15Correct: overCorrect(prediction.predictedOver15Probability, 1.5),
      over25Correct: overCorrect(prediction.predictedOver25Probability, 2.5),
      over35Correct: overCorrect(prediction.predictedOver35Probability, 3.5),
    },
  });
}

/** Predictions whose match has finished but have no result yet — what `npm run evaluate`'s batch mode processes. */
export async function findUnevaluatedPredictions() {
  return prisma.prediction.findMany({
    where: {
      result: null,
      match: { status: "FINISHED", homeScore: { not: null }, awayScore: { not: null } },
    },
    include: { match: true },
  });
}
