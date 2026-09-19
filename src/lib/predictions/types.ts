import type { TeamMatchRecord } from "@/lib/analytics/team-stats";

/**
 * Whatever a model needs, pre-fetched as plain arrays — assembling this from
 * the database (Phase 7's job) is separate from the model logic itself,
 * same split as src/lib/analytics's pure functions vs. src/services/queries.ts.
 */
export interface MatchContext {
  homeTeamOverall: TeamMatchRecord[];
  homeTeamHomeOnly: TeamMatchRecord[];
  awayTeamOverall: TeamMatchRecord[];
  awayTeamAwayOnly: TeamMatchRecord[];
  /** League-wide baseline goal rates, needed by Model 4's relative-strength calculation. */
  leagueAverages: {
    avgHomeGoalsFor: number;
    avgAwayGoalsFor: number;
  };
}

export interface PredictionOutput {
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  predictedHomeWinProbability: number;
  predictedDrawProbability: number;
  predictedAwayWinProbability: number;
  predictedTotalGoals: number;
  predictedBttsProbability: number;
  predictedOver15Probability: number;
  predictedOver25Probability: number;
  predictedOver35Probability: number;
  /** Whatever inputs actually went into predictedHomeGoals/predictedAwayGoals for this run — stored verbatim for reproducibility (spec section 29). */
  modelParameters: Record<string, number>;
}

export interface PredictionModel {
  readonly id: string;
  readonly version: string;
  predict(context: MatchContext): PredictionOutput;
}
