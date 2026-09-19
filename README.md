# Football Analytics Platform

A personal data-analysis and prediction platform for the top English, Scottish, and European football leagues — not a betting tool. Tracks fixtures, results, standings, and team/player statistics, and (in later phases) generates and backtests match predictions against actual results.

This README documents **Phases 1-9 (foundation through the charts/model-performance dashboard)**. Later phases add their own sections here as they land — see the phase list at the bottom.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + PostgreSQL + Prisma. See `docs/providers.md` for the football data provider strategy — three free-tier providers evaluated, two (football-data.org, Sportmonks) confirmed live for current-season data; API-Football's free tier turned out to be historical-only (2022-2024), a correction worth reading given how confidently the original research got it wrong.

## Prerequisites

- Node.js 24+ and npm (confirmed working versions: Node v24.16.0, npm 11.13.0)
- A PostgreSQL database — this project uses a free [Neon](https://neon.tech) instance; any Postgres connection string works

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the environment template and fill in real values:
   ```bash
   cp .env.example .env.local
   ```
   You need:
   - `DATABASE_URL` — your Postgres connection string (e.g. from Neon's dashboard)
   - `FOOTBALL_DATA_ORG_API_KEY` — free key from https://www.football-data.org/client/register
   - `API_FOOTBALL_KEY` — free key from https://dashboard.api-football.com/register (free tier is historical-only, 2022-2024 — see `docs/providers.md`)
   - `SPORTMONKS_API_TOKEN` — free token from https://www.sportmonks.com/football-api/free-plan/ (covers Scottish Premiership + Danish Superliga, current season)

   `.env.local` is gitignored — never commit real keys. `.env.example` holds only placeholders.
3. Run the database migration:
   ```bash
   npm run prisma:migrate
   ```
   This creates the full domain model (Competition/Season/Team/Player/Match/etc — see Architecture below).
4. Seed the competitions and current seasons:
   ```bash
   npm run seed
   ```
   Populates `Competition` + `Season` rows for all 13 enabled leagues in `src/lib/config.ts` — real data (league names/countries/current season), not fabricated teams or match results. Team/match/standing data is Phase 3's job, once a real provider sync exists.
5. Sync real data for a league — the provider is chosen automatically per league (`resolveProviderForLeague` in `src/lib/config.ts`), you don't need to know which one covers what:
   ```bash
   npm run sync:standings -- premier-league        # routes to football-data.org
   npm run sync:fixtures -- premier-league 2026-09-19 2026-09-26
   npm run sync:standings -- scottish-premiership   # routes to Sportmonks
   npm run sync:fixtures -- scottish-premiership 2026-09-12 2026-09-20
   ```
   Upserts real `Team` rows and writes `LeagueStanding`/`Match` rows from the live API. Each sync is independently runnable — see Architecture below for why. Segunda División, 2. Bundesliga, Serie B, and Ligue 2 have no free current-season source yet — syncing them throws a clear error rather than silently doing nothing.
6. Generate and evaluate predictions for a synced match:
   ```bash
   npm run predict -- 1 poisson       # generates a Prediction row for match id 1 using the Poisson model
   npm run evaluate                    # evaluates every prediction whose match has since finished
   ```
   Known model ids: `simple-average`, `recent-form`, `home-away`, `poisson`. Predictions are never overwritten — every run creates a new row — and evaluating the same prediction twice fails loudly rather than silently recomputing.
7. Backtest a model across a league's whole finished match history:
   ```bash
   npm run backtest -- scottish-premiership poisson
   ```
   Walks every finished match oldest-first, predicting each one using only strictly-earlier matches, evaluating immediately, and printing an accuracy/MAE summary. Safe to re-run — already-backtested matches are skipped, not duplicated.
8. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000 — it redirects to `/dashboard`.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / run |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite |
| `npm run prisma:migrate` | Apply schema changes to the database |
| `npm run prisma:studio` | Browse the database in Prisma Studio |
| `npm run seed` | Seed Competition + Season rows from `src/lib/config.ts` |
| `npm run sync:standings -- <slug>` | Fetch + upsert Teams and write a LeagueStanding snapshot for one league |
| `npm run sync:fixtures -- <slug> [from] [to]` | Fetch + upsert Teams and Match rows for one league |
| `npm run predict -- <matchId> <modelId>` | Generate and store a new Prediction row for one match |
| `npm run evaluate` | Evaluate every prediction whose match has finished and has no result yet |
| `npm run backtest -- <slug> <modelId> [limit]` | Walk-forward predict + evaluate a league's finished match history |

Run `lint`, `typecheck`, and `test` after every change — that's the check loop this project follows at every phase.

## Architecture

- `src/lib/config.ts` — the **only** place league IDs/codes and defaults live (`SUPPORTED_LEAGUES`, `DEFAULT_PROVIDER`, etc.). Nothing else should hard-code a league name or provider ID; add a league by adding one entry here.
- `prisma/schema.prisma` + `prisma7.config.ts` — database schema and Prisma's config (Prisma 7 moved connection config out of `schema.prisma` into a dedicated config file; see inline comments in `prisma7.config.ts` for why it loads `.env.local` specifically). The 11-model domain schema (Competition/Season/Team/CompetitionTeam/Player/PlayerAvailability/Match/MatchStatistics/Lineup/LeagueStanding/Prediction/PredictionResult) covers the full spec's data model — key decisions (dual-provider ID columns instead of one generic `apiId`, per-team-not-paired-columns `MatchStatistics`, historical (not overwritten) `LeagueStanding` snapshots) are commented inline in the schema itself.
- `src/lib/database/client.ts` — the shared Prisma client singleton. **Prisma 7 requires an explicit driver adapter** (`@prisma/adapter-pg`) — there's no more implicit "reads `DATABASE_URL` and connects" behavior on the client constructor. Always import `prisma` from here rather than constructing a new `PrismaClient` elsewhere.
- `prisma/seed.ts` — seeds Competition + Season only (real teams/matches/standings come from the sync jobs below, not fabricated seed data).
- `docs/providers.md` — full research and rate-limit/quota notes for all three football data providers evaluated, why football-data.org + Sportmonks (not API-Football) ended up as the two live sources, and a "lesson learned" on verifying provider claims live rather than trusting secondary research.
- `src/lib/api/` — the `FootballDataProvider` interface (`provider.ts`) plus everything an adapter needs: HTTP fetch with retry/backoff (`http-client.ts`), response validation via Zod, a per-run in-memory cache (`cache.ts`) and rate-limit tracker (`rate-limiter.ts`), and structured logging (`logger.ts`). `providers/football-data-org.ts` and `providers/sportmonks.ts` are the two live adapters; `providers/mock.ts` implements the same interface with static data for tests. `index.ts`'s `getProvider()` is the only place that constructs a concrete provider — nothing else should import a provider class directly. `resolveProviderForLeague()` in `src/lib/config.ts` is the only place that decides *which* provider covers a given league's current data — sync services call that, never a hardcoded provider id.
- `src/types/football.ts` — the normalized domain types (`NormalizedTeam`, `NormalizedStandings`, `NormalizedFixture`) every provider adapter returns. Provider-specific field names/casing/enums never cross this boundary.
- `src/services/` — sync orchestration (`standings-sync.ts`, `fixtures-sync.ts`): fetch from a provider, upsert `Team` rows, write `LeagueStanding`/`Match` rows. Each is independently callable and has its own `scripts/sync-*.ts` CLI entry point — deliberately not one combined sync function.
- `src/components/nav.tsx` / `placeholder-page.tsx` — the dashboard shell. Every route beyond Phase 1 replaces its placeholder with real content; the shell itself doesn't change.
- `src/services/queries.ts` — read-side Prisma queries used by pages (`getLeagueWithLatestStandings`, `getUpcomingFixtures`, `getRecentResults`, `getTeamWithMatches`, `getMatchDetail`, `getTeamsWithData`), separate from the write-side sync services above.
- `src/app/leagues/`, `/teams/`, `/matches/` — Server Components querying Prisma directly (no API routes — this is one app, not a frontend talking to a separate backend). `/leagues/[slug]`, `/teams/[id]`, and `/matches/[id]` all declare `export const dynamic = "force-dynamic"` where Next.js's default static optimization would otherwise have baked in build-time database state for pages with no dynamic route segment (`/leagues`, `/teams` needed this explicitly — caught during Phase 4's own build verification).
- `src/lib/analytics/` — the actual stats engine, pure functions with no Prisma calls (fixture-tested, no DB needed): `weighting.ts` (swappable recency-weighting strategies), `team-stats.ts` (`computeTeamStats` — one function for overall/home/away/recent-form, callers just pass the filtered/sliced record subset; `computeWeightedForm` for a single recency-weighted points-per-game score), `head-to-head.ts` (`computeHeadToHead` — W/D/L/BTTS/over-under from either team's perspective, plus the same weighting utility). `src/services/queries.ts`'s `getTeamMatchRecords`/`getHeadToHeadMatches` are the DB-facing glue that turns `Match` rows into the plain arrays these functions consume.
- `src/lib/predictions/` — the pure calculation layer (no Prisma calls). `poisson.ts` is the shared statistics engine every model feeds into (a (λ_home, λ_away) pair → full scoreline matrix → win/draw/win, BTTS, over 1.5/2.5/3.5 probabilities, plus `mostLikelyScoreline` — the distribution's mode, not rounded λ) — a model's only real job is estimating λ, not re-deriving probabilities. `models/` holds the four spec models as a genuine complexity ladder (`simple-average.ts` → `recent-form.ts` → `home-away.ts` → `poisson-model.ts`, each strictly using more information than the last — see inline comments for the exact formula each uses). `index.ts`'s `getPredictionModel(id)` is the same factory-registry pattern as `src/lib/api/index.ts`'s `getProvider()`.
- `src/services/build-match-context.ts`, `predict.ts`, `evaluate-prediction.ts` — the DB-facing prediction pipeline (Phase 7). `buildMatchContext` assembles real synced data into the shape the models consume, **actually enforcing** the `dataCutoff` (via `getTeamMatchRecords`/`getLeagueAverageGoals`'s optional `beforeDate` filter) rather than just recording it — a model genuinely cannot see a match that happens after the one being predicted, which is what makes Phase 8's backtesting trustworthy instead of leaking future information. `generatePrediction` always creates a new `Prediction` row (never overwrites); `evaluatePrediction` computes a `PredictionResult` once a match has finished and refuses to run twice for the same prediction (relies on the schema's unique constraint) rather than silently recomputing.
- `src/lib/predictions/evaluation-summary.ts` — pure aggregation (`summarizeResults`: result/exact-score/BTTS/over-under accuracy, goal MAE) over an array of `PredictionResult`-shaped records. Used by the backtest runner now; the future live model-performance dashboard (Phase 9) reuses this exact same function against real queried rows rather than aggregating independently.
- `src/services/backtest.ts` — walks a competition's finished matches oldest-first, calling Phase 7's `generatePrediction`/`evaluatePrediction` unchanged for each one (no prediction/evaluation logic is reimplemented here). Idempotent: re-running the same model+match+cutoff combination is detected and skipped rather than creating a duplicate row — a backtest re-run is a deterministic pure function re-executed, not new information, unlike a live prediction re-run later (which correctly still always creates a new row).
- `src/components/charts/` — the two chart components (Phase 9), both receiving pre-computed data as props, no Prisma calls: `model-accuracy-chart.tsx` (`"use client"` Recharts bar chart, one bar per model, categorical colors from the validated dataviz reference palette, direct `%`/`n=` labels) and `scoreline-heatmap.tsx` (a plain server-renderable grid calling the existing pure `buildScorelineMatrix` live, sequential-blue shading, every cell direct-labeled). Chart color tokens (categorical ×4, sequential ramp with paired per-step text colors, chart chrome/ink) live as CSS custom properties in `src/app/globals.css`, light and dark, re-validated against this app's real surface colors with the dataviz skill's `validate_palette.js`.
- `src/services/queries.ts` gained five Phase 9 read queries: `getTodaysMatches`, `getUpcomingMatchesAcrossLeagues`, `getRecentResultsAcrossLeagues` (cross-league versions of the Phase 4 per-league queries), `getDataStatus` (a descriptive team/match-count/most-recent-match readout per league — deliberately not a fabricated "stale/fresh" verdict, since the spec never defines a staleness threshold), `getModelPerformance` (real per-model `Prediction`+`PredictionResult` rows through the existing `summarizeResults`), and `getLatestPredictionsForMatches` (most recent prediction per match for a given model, since predictions are never overwritten).
- `src/app/dashboard/`, `/predictions/`, `/predictions/performance/` — the three pages Phase 9 replaced/added, all `force-dynamic`. `/predictions` takes a `?model=` query param (no client state) to switch between the four models; a match with none yet shows an honest empty state, and a prediction that's exactly 0.00–0.00 shows an explanatory caveat rather than presenting a degenerate result as a confident one (see Phase 9 below for why that happens right now).

## Phases

This project is built incrementally, not all at once — each phase gets implemented, tested, and reviewed before the next starts. Sections referenced below are from the original project spec.

- **Phase 1: project foundation** — Next.js/TS/Tailwind/Postgres/Prisma wired together, league config system, placeholder dashboard shell. ✅
- **Phase 2: database schema** — full 11-model domain schema, migrated and verified against the live database; seed script for Competition/Season. ✅
- **Phase 3: `FootballDataProvider` abstraction + first provider** — football-data.org adapter with Zod-validated normalization, retry/backoff, per-run caching and rate-limit tracking; `standings`/`fixtures` sync jobs verified against the live API and database (20 teams, 20 standings rows, 9 matches for Premier League). ✅
- **Phase 3b: second provider (Scottish Premiership gap)** — planned around API-Football, but live testing revealed its free tier is historical-only (2022-2024), not current-season at all (corrected in `docs/providers.md`). Pivoted to Sportmonks, independently verified live before building anything on it — genuinely current-season, confirmed with real data matching reality (Celtic top of the table, 18pts). Auto-routing (`resolveProviderForLeague`) added so sync services never need to know which provider covers which league. Verified: 12 teams, 12 standings rows, 9 matches for Scottish Premiership. Segunda División/2. Bundesliga/Serie B/Ligue 2 remain without a free current-season source. ✅
- **Phase 4: competition/team/match pages** — `/leagues`, `/leagues/[slug]` (standings + fixtures), `/teams`, `/teams/[id]`, `/matches/[id]`, all Server Components reading Prisma directly. Honest empty states for the 11 leagues with no synced data yet, rather than a misleading blank table. Verified against live rendered HTML (no browser tool in this environment): real Premier League standings (Arsenal top, matchday 5), real Scottish Premiership data, and a real synced result (Tottenham 2-3 Aston Villa) all confirmed rendering correctly. Caught and fixed a real bug in the process: `/leagues` and `/teams` were being statically prerendered at build time by Next.js's default heuristic, which would have frozen their content to build-time database state. ✅
- **Phase 5: statistics and analytics engine** — pure, DB-free computation functions (`computeTeamStats` serving overall/home/away/recent-form from one implementation, `computeWeightedForm` with swappable recency weighting, `computeHeadToHead`), fixture-tested (20 unit tests covering normal/all-wins/empty/weighting-sanity cases). Surfaced on `/teams/[id]` (5 stat cards: Overall/Home/Away/Last 5/Last 10, each showing its own sample size per spec's "avoid presenting statistical noise as certainty") and `/matches/[id]` (head-to-head section). Verified against live rendered HTML: Tottenham's 1 synced match (a home loss) correctly shows 0W-0D-1L on Overall/Home/Last-5/Last-10 and correctly shows the empty state on Away; head-to-head on that same match correctly resolves both team names and the real result. ✅
- **Phase 6: prediction engine** — four models behind one `PredictionModel` interface (Simple Average → Recent Form → Home/Away → Poisson attack/defense), all feeding a shared Poisson probability engine rather than each re-deriving win/draw/BTTS/over-under math independently. 40 fixture-based unit tests (Poisson math sanity checks — probabilities sum to 1, symmetric-λ gives equal win chances — plus per-model relative-ordering checks, e.g. Model 3 correctly ignores a team's away form entirely when computing its home λ). Deliberately no database writes or CLI yet — pure calculation only, per the project's own phase split ("storage and evaluation" is Phase 7). ✅
- **Phase 7: prediction storage and evaluation** — `buildMatchContext` wires Phase 6's models to real synced data, actually enforcing `dataCutoff` (not just recording it) via new `beforeDate` filters on the underlying queries. Verified live against the real Tottenham 2-3 Aston Villa match: a prediction generated with the default cutoff (now) could see that match's own result in its own history — an intentional live-prediction edge case caused by having only one match of history total, explained and then specifically re-tested with a cutoff set to one second *before* kickoff, which correctly zeroed out both teams' history (proving the cutoff is real, not decorative). That same prediction was evaluated against the actual 2-3 result end-to-end: every `PredictionResult` field (result correctness, exact-score-vs-mode, goal errors, BTTS/over-under calls) matched hand-computed expectations exactly. Batch `npm run evaluate` correctly evaluated the other 3 stored predictions and skipped the already-evaluated one; re-evaluating a prediction throws rather than silently overwriting (confirmed). Two of the four models (home-away, poisson) correctly called the away win on this one real result; the two simpler models didn't — a real, if statistically meaningless at n=1, first data point for Phase 8's backtesting. ✅
- **Phase 8: backtesting** — `runBacktest` walks a competition's finished matches oldest-first, reusing Phase 7's `generatePrediction`/`evaluatePrediction` unchanged; idempotent re-runs (skip, don't duplicate) since a repeated backtest is a deterministic re-execution, not new information. A pure `summarizeResults` aggregator (7 fixture tests) will be reused unchanged by Phase 9's live dashboard. Verified for real over all 3 finished Scottish Premiership matches: the model correctly degenerated to predicting 0-0 for every match given zero prior league history existed yet (a completely honest, mathematically-consistent result, not a bug — 0% result/exact-score accuracy but a correct 66.7%/33.3% BTTS/over-2.5 score given the "predict nothing happens" default), and a second identical run confirmed idempotency exactly (0 newly evaluated, 3 already backtested, unchanged summary, confirmed no duplicate rows in the database). ✅
- **Phase 9: charts and model-performance dashboard** — rebuilt `/dashboard` (Today's Matches, Upcoming 7 days, Recently Completed, League Overview, Prediction Summary, a Model Performance snippet, and a Data Status table) and `/predictions` (upcoming matches with a real model switcher and a live scoreline-probability heatmap), and added `/predictions/performance` (a real per-model accuracy table plus a bar chart). Installed Recharts (free, MIT) for the bar chart; the heatmap is a hand-built grid, since it needs no charting library. Colors follow the dataviz skill's method — the categorical/sequential palettes are its own validated reference instance, re-checked against this app's actual light/dark surfaces with `validate_palette.js` before use (all checks passed; the light-mode contrast WARN on 2 of 4 hues is mitigated by the direct `%`/`n=` labels already required). Fixed a real pre-existing bug while wiring this up: `DEFAULT_PREDICTION_MODEL` in `src/lib/config.ts` was `"poisson-v1"`, which doesn't match any real model id (`"poisson"`) — dead/untriggered until this phase became its first consumer. Generated real predictions for all 10 genuinely-upcoming synced matches via the existing `npm run predict` CLI (no new script) and found something honestly worth reporting: with only 1 finished Premier League match and 3 finished Scottish Premiership matches synced in total, every model needs real prior results for both teams and most of these fixtures' teams have **zero** finished matches synced yet — so most predictions correctly come back 0.00–0.00 rather than a meaningful number. This is the models working exactly as designed against a still-very-thin dataset, not a Phase 9 bug; the predictions page now shows an explicit caveat for this case (pointing at `npm run sync:fixtures`, not "try another model," since the root cause is missing history, not model choice) instead of presenting a degenerate result as a confident one. ✅
- Phase 10: polish, testing, performance, documentation

Sections on adding a new provider, adding a new league, adding a new prediction model, running a backtest, and seeding/syncing data will be added here as those phases land.
