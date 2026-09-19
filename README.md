# Football Analytics Platform

A personal data-analysis and prediction platform for the top English, Scottish, and European football leagues — not a betting tool. Tracks fixtures, results, standings, and team/player statistics, and (in later phases) generates and backtests match predictions against actual results.

This README documents **Phases 1-2 (foundation + data model)**. Later phases add their own sections here as they land — see the phase list at the bottom.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + PostgreSQL + Prisma. See `docs/providers.md` for the football data provider strategy (football-data.org + API-Football, both free tier).

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
   - `API_FOOTBALL_KEY` — free key from https://dashboard.api-football.com/register

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
5. Start the dev server:
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

Run `lint`, `typecheck`, and `test` after every change — that's the check loop this project follows at every phase.

## Architecture

- `src/lib/config.ts` — the **only** place league IDs/codes and defaults live (`SUPPORTED_LEAGUES`, `DEFAULT_PROVIDER`, etc.). Nothing else should hard-code a league name or provider ID; add a league by adding one entry here.
- `prisma/schema.prisma` + `prisma7.config.ts` — database schema and Prisma's config (Prisma 7 moved connection config out of `schema.prisma` into a dedicated config file; see inline comments in `prisma7.config.ts` for why it loads `.env.local` specifically). The 11-model domain schema (Competition/Season/Team/CompetitionTeam/Player/PlayerAvailability/Match/MatchStatistics/Lineup/LeagueStanding/Prediction/PredictionResult) covers the full spec's data model — key decisions (dual-provider ID columns instead of one generic `apiId`, per-team-not-paired-columns `MatchStatistics`, historical (not overwritten) `LeagueStanding` snapshots) are commented inline in the schema itself.
- `src/lib/db.ts` — the shared Prisma client singleton. **Prisma 7 requires an explicit driver adapter** (`@prisma/adapter-pg`) — there's no more implicit "reads `DATABASE_URL` and connects" behavior on the client constructor. Always import `prisma` from here rather than constructing a new `PrismaClient` elsewhere.
- `prisma/seed.ts` — seeds Competition + Season only (see Setup above for why Team/Match/Standing seeding is deliberately deferred to Phase 3).
- `docs/providers.md` — full research and rate-limit/quota notes for the two football data providers this project uses, and why both are needed instead of one.
- `src/components/nav.tsx` / `placeholder-page.tsx` — the dashboard shell. Every route beyond Phase 1 replaces its placeholder with real content; the shell itself doesn't change.

## Phases

This project is built incrementally, not all at once — each phase gets implemented, tested, and reviewed before the next starts. Sections referenced below are from the original project spec.

- **Phase 1: project foundation** — Next.js/TS/Tailwind/Postgres/Prisma wired together, league config system, placeholder dashboard shell. ✅
- **Phase 2: database schema** — full 11-model domain schema, migrated and verified against the live database; seed script for Competition/Season. ✅
- Phase 3: `FootballDataProvider` abstraction + first real provider adapters
- Phase 4: competition/team/match pages
- Phase 5: statistics and analytics engine
- Phase 6: prediction engine (statistical models, then Poisson)
- Phase 7: prediction storage and evaluation
- Phase 8: backtesting
- Phase 9: charts and model-performance dashboard
- Phase 10: polish, testing, performance, documentation

Sections on adding a new provider, adding a new league, adding a new prediction model, running a backtest, and seeding/syncing data will be added here as those phases land.
