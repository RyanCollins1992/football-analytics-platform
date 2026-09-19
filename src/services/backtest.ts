import { prisma } from "@/lib/database/client";
import { generatePrediction } from "@/services/predict";
import { evaluatePrediction } from "@/services/evaluate-prediction";
import { summarizeResults, type EvaluationSummary } from "@/lib/predictions/evaluation-summary";
import { getPredictionModel } from "@/lib/predictions";
import { logger } from "@/lib/api/logger";

export interface BacktestOptions {
  competitionSlug: string;
  modelId: string;
  /** Most recent N finished matches, chronologically — omit for the whole synced history. */
  limit?: number;
}

export interface BacktestRunResult {
  processed: number;
  skipped: number;
  summary: EvaluationSummary;
}

/**
 * Walks a competition's finished match history oldest-first, predicting
 * each one exactly as Phase 7's generatePrediction/evaluatePrediction
 * already do for a single live match — this function adds no new
 * prediction or evaluation logic, only the walk and idempotent skip.
 */
export async function runBacktest(options: BacktestOptions): Promise<BacktestRunResult> {
  const model = getPredictionModel(options.modelId); // throws early on an unknown model id, before touching the DB

  const allFinished = await prisma.match.findMany({
    where: {
      competition: { slug: options.competitionSlug },
      status: "FINISHED",
      homeScore: { not: null },
      awayScore: { not: null },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const matches = options.limit ? allFinished.slice(-options.limit) : allFinished;

  let processed = 0;
  let skipped = 0;
  const results = [];

  for (const match of matches) {
    const dataCutoff = match.scheduledAt;

    // Idempotent re-run: a backtest of the same model+match+cutoff is a
    // deterministic pure function re-executed, not new information — skip
    // rather than creating a duplicate Prediction. generatePrediction itself
    // still always creates a new row for every OTHER caller (live use).
    const existing = await prisma.prediction.findFirst({
      where: { matchId: match.id, modelId: model.id, modelVersion: model.version, dataCutoff },
      include: { result: true },
    });

    if (existing?.result) {
      logger.info("backtest: skipping already-evaluated match", { matchId: match.id, modelId: model.id });
      results.push(existing.result);
      skipped++;
      continue;
    }

    const prediction = existing ?? (await generatePrediction(match.id, options.modelId, dataCutoff));
    const result = await evaluatePrediction(prediction.id);
    results.push(result);
    processed++;
  }

  return { processed, skipped, summary: summarizeResults(results) };
}
