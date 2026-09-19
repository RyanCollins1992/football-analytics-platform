import { exponentialDecayWeights, type WeightFn } from "@/lib/analytics/weighting";

export interface HeadToHeadMatch {
  matchId: number;
  scheduledAt: Date;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
}

export interface HeadToHeadStats {
  meetings: number;
  teamAWins: number;
  teamBWins: number;
  draws: number;
  avgTotalGoals: number;
  bttsPercentage: number;
  over15Percentage: number;
  over25Percentage: number;
  over35Percentage: number;
  /** Weighted share of points teamA has taken in these meetings, recent ones counting more — 0.5 is "even", not a percentage of wins. */
  weightedTeamAFormShare: number;
  /** Newest first — the actual meetings, for the "show the historical matches" requirement (spec section 6). */
  matches: HeadToHeadMatch[];
}

const EMPTY: HeadToHeadStats = {
  meetings: 0,
  teamAWins: 0,
  teamBWins: 0,
  draws: 0,
  avgTotalGoals: 0,
  bttsPercentage: 0,
  over15Percentage: 0,
  over25Percentage: 0,
  over35Percentage: 0,
  weightedTeamAFormShare: 0.5,
  matches: [],
};

/**
 * `matches` must already be filtered to exactly these two teams (either
 * venue) and sorted newest first — this function doesn't query or filter,
 * it only computes (see getHeadToHeadMatches in src/services/queries.ts for
 * the DB-facing side).
 */
export function computeHeadToHead(
  teamAId: number,
  teamBId: number,
  matches: HeadToHeadMatch[],
  weightFn: WeightFn = exponentialDecayWeights
): HeadToHeadStats {
  if (matches.length === 0) return EMPTY;

  let teamAWins = 0;
  let teamBWins = 0;
  let draws = 0;
  let totalGoals = 0;
  let btts = 0;
  let over15 = 0;
  let over25 = 0;
  let over35 = 0;

  for (const match of matches) {
    const aIsHome = match.homeTeamId === teamAId;
    const aGoals = aIsHome ? match.homeScore : match.awayScore;
    const bGoals = aIsHome ? match.awayScore : match.homeScore;

    if (aGoals > bGoals) teamAWins++;
    else if (bGoals > aGoals) teamBWins++;
    else draws++;

    const total = match.homeScore + match.awayScore;
    totalGoals += total;
    if (match.homeScore > 0 && match.awayScore > 0) btts++;
    if (total > 1.5) over15++;
    if (total > 2.5) over25++;
    if (total > 3.5) over35++;
  }

  const weights = weightFn(matches.length);
  let weightedTeamAPoints = 0;
  let totalWeight = 0;
  matches.forEach((match, i) => {
    const aIsHome = match.homeTeamId === teamAId;
    const aGoals = aIsHome ? match.homeScore : match.awayScore;
    const bGoals = aIsHome ? match.awayScore : match.homeScore;
    const aPoints = aGoals > bGoals ? 3 : aGoals === bGoals ? 1 : 0;
    weightedTeamAPoints += aPoints * weights[i];
    totalWeight += 3 * weights[i]; // normalize against max possible (a win every time) so the share sits in [0,1]
  });

  const meetings = matches.length;
  return {
    meetings,
    teamAWins,
    teamBWins,
    draws,
    avgTotalGoals: totalGoals / meetings,
    bttsPercentage: (btts / meetings) * 100,
    over15Percentage: (over15 / meetings) * 100,
    over25Percentage: (over25 / meetings) * 100,
    over35Percentage: (over35 / meetings) * 100,
    weightedTeamAFormShare: weightedTeamAPoints / totalWeight,
    matches,
  };
}
