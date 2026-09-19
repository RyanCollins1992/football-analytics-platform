/**
 * Central configuration — the only place league IDs, defaults, and provider
 * selection live. Nothing else in the app should hard-code a league name,
 * code, or ID; adding a league later means adding one entry here.
 */

export type LeagueTier = 1 | 2;

export interface LeagueConfig {
  /** Our own stable internal id — used everywhere in the app and DB, never a provider's id. */
  id: string;
  name: string;
  country: string;
  tier: LeagueTier;
  /** Whether this league is wired up for syncing yet. */
  enabled: boolean;
  /**
   * football-data.org competition code (see docs/providers.md) — undefined
   * means this league isn't on football-data.org's free tier; API-Football
   * is the only source for it.
   */
  footballDataOrgCode?: string;
  /**
   * api-football.com numeric league id. These are the commonly-published,
   * long-stable IDs for each league, but NOT independently verified against
   * a live API-Football account in this codebase yet — confirm each one
   * with `GET /leagues?id=<id>` once real API access is wired up (Phase 3)
   * before trusting them for a sync job. Wrong here means silently wrong
   * data, so don't skip that verification.
   */
  apiFootballId?: number;
}

export const SUPPORTED_LEAGUES: LeagueConfig[] = [
  { id: "premier-league", name: "Premier League", country: "England", tier: 1, enabled: true, footballDataOrgCode: "PL", apiFootballId: 39 },
  { id: "championship", name: "Championship", country: "England", tier: 2, enabled: true, footballDataOrgCode: "ELC", apiFootballId: 40 },
  { id: "la-liga", name: "La Liga", country: "Spain", tier: 1, enabled: true, footballDataOrgCode: "PD", apiFootballId: 140 },
  { id: "segunda-division", name: "Segunda División", country: "Spain", tier: 2, enabled: true, apiFootballId: 141 },
  { id: "bundesliga", name: "Bundesliga", country: "Germany", tier: 1, enabled: true, footballDataOrgCode: "BL1", apiFootballId: 78 },
  { id: "2-bundesliga", name: "2. Bundesliga", country: "Germany", tier: 2, enabled: true, apiFootballId: 79 },
  { id: "serie-a", name: "Serie A", country: "Italy", tier: 1, enabled: true, footballDataOrgCode: "SA", apiFootballId: 135 },
  { id: "serie-b", name: "Serie B", country: "Italy", tier: 2, enabled: true, apiFootballId: 136 },
  { id: "ligue-1", name: "Ligue 1", country: "France", tier: 1, enabled: true, footballDataOrgCode: "FL1", apiFootballId: 61 },
  { id: "ligue-2", name: "Ligue 2", country: "France", tier: 2, enabled: true, apiFootballId: 62 },
  { id: "eredivisie", name: "Eredivisie", country: "Netherlands", tier: 1, enabled: true, footballDataOrgCode: "DED", apiFootballId: 88 },
  { id: "primeira-liga", name: "Primeira Liga", country: "Portugal", tier: 1, enabled: true, footballDataOrgCode: "PPL", apiFootballId: 94 },
  { id: "scottish-premiership", name: "Scottish Premiership", country: "Scotland", tier: 1, enabled: true, apiFootballId: 179 },

  // Future — listed per the spec's "potential future leagues" but not synced yet.
  { id: "champions-league", name: "UEFA Champions League", country: "Europe", tier: 1, enabled: false, footballDataOrgCode: "CL", apiFootballId: 2 },
  { id: "europa-league", name: "UEFA Europa League", country: "Europe", tier: 1, enabled: false, apiFootballId: 3 },
  { id: "conference-league", name: "UEFA Conference League", country: "Europe", tier: 1, enabled: false, apiFootballId: 848 },
];

export function getLeague(id: string): LeagueConfig | undefined {
  return SUPPORTED_LEAGUES.find((league) => league.id === id);
}

export function getEnabledLeagues(): LeagueConfig[] {
  return SUPPORTED_LEAGUES.filter((league) => league.enabled);
}

/** Which provider a data domain should ask first — see docs/providers.md for the division of labour. */
export type ProviderId = "football-data-org" | "api-football" | "mock";

export const DEFAULT_PROVIDER: ProviderId =
  (process.env.DEFAULT_PROVIDER as ProviderId) || "football-data-org";

export const DEFAULT_LOOKBACK_MATCHES = 10;
export const DEFAULT_SEASON = new Date().getFullYear();
export const DEFAULT_PREDICTION_MODEL = "poisson-v1";
