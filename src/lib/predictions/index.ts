import { SimpleAverageModel } from "@/lib/predictions/models/simple-average";
import { RecentFormModel } from "@/lib/predictions/models/recent-form";
import { HomeAwayModel } from "@/lib/predictions/models/home-away";
import { PoissonModel } from "@/lib/predictions/models/poisson-model";
import type { PredictionModel } from "@/lib/predictions/types";

export type { MatchContext, PredictionModel, PredictionOutput } from "@/lib/predictions/types";

/** Same factory-registry pattern as src/lib/api/index.ts's getProvider() — one place that knows every concrete model. */
const MODELS: PredictionModel[] = [new SimpleAverageModel(), new RecentFormModel(), new HomeAwayModel(), new PoissonModel()];

export function listPredictionModels(): PredictionModel[] {
  return MODELS;
}

export function getPredictionModel(id: string): PredictionModel {
  const model = MODELS.find((m) => m.id === id);
  if (!model) {
    throw new Error(`Unknown prediction model id: "${id}". Known: ${MODELS.map((m) => m.id).join(", ")}`);
  }
  return model;
}
