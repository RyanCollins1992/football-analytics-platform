# Football Analytics Platform

A personal data-analysis and prediction platform for the top English, Scottish, and European football leagues — not a betting tool. Tracks fixtures, results, standings, and team/player statistics, and (in later phases) generates and backtests match predictions against actual results.

This README documents **Phases 1-4 (foundation through the first real UI)**. Later phases add their own sections here as they land — see the phase list at the bottom.

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
6. Start the dev server:
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

## Phases

This project is built incrementally, not all at once — each phase gets implemented, tested, and reviewed before the next starts. Sections referenced below are from the original project spec.

- **Phase 1: project foundation** — Next.js/TS/Tailwind/Postgres/Prisma wired together, league config system, placeholder dashboard shell. ✅
- **Phase 2: database schema** — full 11-model domain schema, migrated and verified against the live database; seed script for Competition/Season. ✅
- **Phase 3: `FootballDataProvider` abstraction + first provider** — football-data.org adapter with Zod-validated normalization, retry/backoff, per-run caching and rate-limit tracking; `standings`/`fixtures` sync jobs verified against the live API and database (20 teams, 20 standings rows, 9 matches for Premier League). ✅
- **Phase 3b: second provider (Scottish Premiership gap)** — planned around API-Football, but live testing revealed its free tier is historical-only (2022-2024), not current-season at all (corrected in `docs/providers.md`). Pivoted to Sportmonks, independently verified live before building anything on it — genuinely current-season, confirmed with real data matching reality (Celtic top of the table, 18pts). Auto-routing (`resolveProviderForLeague`) added so sync services never need to know which provider covers which league. Verified: 12 teams, 12 standings rows, 9 matches for Scottish Premiership. Segunda División/2. Bundesliga/Serie B/Ligue 2 remain without a free current-season source. ✅
- **Phase 4: competition/team/match pages** — `/leagues`, `/leagues/[slug]` (standings + fixtures), `/teams`, `/teams/[id]`, `/matches/[id]`, all Server Components reading Prisma directly. Honest empty states for the 11 leagues with no synced data yet, rather than a misleading blank table. Verified against live rendered HTML (no browser tool in this environment): real Premier League standings (Arsenal top, matchday 5), real Scottish Premiership data, and a real synced result (Tottenham 2-3 Aston Villa) all confirmed rendering correctly. Caught and fixed a real bug in the process: `/leagues` and `/teams` were being statically prerendered at build time by Next.js's default heuristic, which would have frozen their content to build-time database state. ✅
- Phase 5: statistics and analytics engine
- Phase 6: prediction engine (statistical models, then Poisson)
- Phase 7: prediction storage and evaluation
- Phase 8: backtesting
- Phase 9: charts and model-performance dashboard
- Phase 10: polish, testing, performance, documentation

Sections on adding a new provider, adding a new league, adding a new prediction model, running a backtest, and seeding/syncing data will be added here as those phases land.
