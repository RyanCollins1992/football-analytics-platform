import type { TeamMatchRecord } from "@/lib/analytics/team-stats";

export function average(records: TeamMatchRecord[], field: "goalsFor" | "goalsAgainst"): number {
  if (records.length === 0) return 0;
  return records.reduce((sum, r) => sum + r[field], 0) / records.length;
}

/**
 * Empirically, home teams score meaningfully more than a venue-blind average
 * would suggest — this is a commonly-cited general football constant, not
 * fitted to this project's own (currently very small) dataset. Models that
 * don't otherwise account for venue (1 and 2) apply it directly; models that
 * use real venue-split data (3 and 4) don't need it at all.
 */
export const HOME_ADVANTAGE_FACTOR = 1.35;
