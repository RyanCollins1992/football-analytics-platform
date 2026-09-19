import type { MatchStatus } from "@/generated/prisma/client";

/**
 * Every provider adapter returns these shapes, never raw provider JSON —
 * that's what keeps a provider's field names/casing/enums from leaking
 * past the adapter that fetched them. See src/lib/api/provider.ts.
 */

export interface NormalizedTeam {
  /** The provider's own id for this team, as a string (raw id may be numeric). */
  externalId: string;
  name: string;
  shortName?: string;
  country?: string;
  logo?: string;
}

export interface NormalizedStandingRow {
  team: NormalizedTeam;
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface NormalizedStandings {
  competitionSlug: string;
  matchday: number | null;
  rows: NormalizedStandingRow[];
}

export interface NormalizedFixture {
  externalId: string;
  competitionSlug: string;
  matchday: number | null;
  scheduledAt: Date;
  status: MatchStatus;
  homeTeam: NormalizedTeam;
  awayTeam: NormalizedTeam;
  homeScore: number | null;
  awayScore: number | null;
  halfTimeHomeScore: number | null;
  halfTimeAwayScore: number | null;
  venue: string | null;
}
