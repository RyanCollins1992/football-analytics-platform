import { exponentialDecayWeights, type WeightFn } from "@/lib/analytics/weighting";

/** One finished match from a single team's point of view — already oriented, no home/away branching needed by callers. */
export interface TeamMatchRecord {
  matchId: number;
  scheduledAt: Date;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TeamStats {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  winPercentage: number;
  pointsPerGame: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  cleanSheetPercentage: number;
  failedToScorePercentage: number;
}

const EMPTY_STATS: TeamStats = {
  played: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  winPercentage: 0,
  pointsPerGame: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDifference: 0,
  goalsForPerGame: 0,
  goalsAgainstPerGame: 0,
  cleanSheetPercentage: 0,
  failedToScorePercentage: 0,
};

function resultOf(record: TeamMatchRecord): "W" | "D" | "L" {
  if (record.goalsFor > record.goalsAgainst) return "W";
  if (record.goalsFor < record.goalsAgainst) return "L";
  return "D";
}

/**
 * The one stats function every section-5 metric (overall/home/away/recent
 * form) goes through — callers pass whatever subset of a team's matches is
 * relevant (all of them, home-only, last 5, ...) rather than this function
 * knowing about home/away/windowing itself.
 */
export function computeTeamStats(records: TeamMatchRecord[]): TeamStats {
  if (records.length === 0) return EMPTY_STATS;

  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let failedToScore = 0;

  for (const record of records) {
    const result = resultOf(record);
    if (result === "W") wins++;
    else if (result === "D") draws++;
    else losses++;

    goalsFor += record.goalsFor;
    goalsAgainst += record.goalsAgainst;
    if (record.goalsAgainst === 0) cleanSheets++;
    if (record.goalsFor === 0) failedToScore++;
  }

  const played = records.length;
  const points = wins * 3 + draws;

  return {
    played,
    wins,
    draws,
    losses,
    winPercentage: (wins / played) * 100,
    pointsPerGame: points / played,
    goalsFor,
    goalsAgainst,
    goalDifference: goalsFor - goalsAgainst,
    goalsForPerGame: goalsFor / played,
    goalsAgainstPerGame: goalsAgainst / played,
    cleanSheetPercentage: (cleanSheets / played) * 100,
    failedToScorePercentage: (failedToScore / played) * 100,
  };
}

/**
 * A single weighted points-per-game score — not four weighted counting
 * stats ("weighted wins" isn't a coherent integer). `records` must already
 * be newest-first, matching every weighting strategy's assumption.
 */
export function computeWeightedForm(records: TeamMatchRecord[], weightFn: WeightFn = exponentialDecayWeights): number {
  if (records.length === 0) return 0;

  const weights = weightFn(records.length);
  let weightedPoints = 0;
  let totalWeight = 0;

  records.forEach((record, i) => {
    const result = resultOf(record);
    const points = result === "W" ? 3 : result === "D" ? 1 : 0;
    weightedPoints += points * weights[i];
    totalWeight += weights[i];
  });

  return weightedPoints / totalWeight;
}
