# Football data providers

Three free-tier providers, used together through the `FootballDataProvider` abstraction (`src/lib/api/`) — no single one covers everything in scope, and we are not paying for any of them (see `resolveProviderForLeague` in `src/lib/config.ts` for the actual per-league routing). Sportmonks was added after API-Football's free tier turned out not to cover current-season data at all — see the correction and lesson-learned below.

## football-data.org (v4)

- Docs: https://docs.football-data.org/
- Auth: `X-Auth-Token` header.
- Free tier: no card, no expiry. Covers Premier League, Championship, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Champions League, Brazil Série A, World Cup, Euros (58 competitions exist in total across all tiers — the free plan is a subset of these, exact per-tier list not published; verify with `GET /v4/competitions` which returns only what your key can see).
- **No player-level data, no match statistics (shots/possession/cards/corners), no injuries, no lineups on the free tier.** Fixtures, results, standings only.
- Does **not** cover: Segunda División, 2. Bundesliga, Serie B, Ligue 2, Scottish Premiership.
- Role in this project: primary source for fixtures/results/standings on the big-5 + Championship + Champions League.

### Rate limiting (confirmed from official lookup tables doc, 2026-09-19)

Response headers actually returned (do not confuse with generic "X-RateLimit-*" names used by other APIs):

| Header | Meaning |
|---|---|
| `X-RequestsAvailable` | Requests remaining before throttling |
| `X-RequestCounter-Reset` | Seconds until the quota window resets |
| `X-API-Version` | API version serving the response (`v4`) |
| `X-Authenticated-Client` | Identifies the authenticated client |

Free plan: 10 requests/minute. Build the client to read `X-RequestsAvailable`/`X-RequestCounter-Reset` on every response and back off accordingly, rather than hardcoding "10/min" — the header is the source of truth.

### Useful enums (full list confirmed from docs)

- **Match status**: `SCHEDULED | TIMED | IN_PLAY | PAUSED | EXTRA_TIME | PENALTY_SHOOTOUT | FINISHED | SUSPENDED | POSTPONED | CANCELLED | AWARDED`
- **Match stage**: `FINAL | THIRD_PLACE | SEMI_FINALS | QUARTER_FINALS | LAST_16 | LAST_32 | LAST_64 | ROUND_4 | ROUND_3 | ROUND_2 | ROUND_1 | GROUP_STAGE | PRELIMINARY_ROUND | QUALIFICATION | QUALIFICATION_ROUND_1/2/3 | PLAYOFF_ROUND_1/2 | PLAYOFFS | REGULAR_SEASON | CLAUSURA | APERTURA | CHAMPIONSHIP | RELEGATION | RELEGATION_ROUND`
- **Card type**: `YELLOW | YELLOW_RED | RED`
- **Goal type**: `REGULAR | OWN | PENALTY`
- **Competition type**: `LEAGUE | LEAGUE_CUP | CUP | PLAYOFFS`

These map directly onto our normalized `Match.status` / `MatchStatistics` enums in the provider adapter — don't invent our own status vocabulary that then needs re-mapping twice.

### Useful query filters

`matchday`, `areas`, `season` (4-digit year), `venue` (HOME/AWAY), `competitions` (comma-separated codes), `date`, `dateFrom`/`dateTo`, `status`, `lineup` (STARTING/BENCH), `e` (event: GOAL/ASSIST/SUB_IN/SUB_OUT), `limit` (1-500), `offset`.

Request headers we can send: `X-Unfold-Lineups`, `X-Unfold-Bookings`, `X-Unfold-Subs`, `X-Unfold-Goals` (all `true`/`false`) to expand nested data in one call instead of N follow-up calls — use these to conserve quota.

## API-Football (api-sports.io v3)

- Docs: https://www.api-football.com/documentation-v3 (site 403s automated fetches — read via a signed-in browser session or the account dashboard's own docs viewer when detail is needed).
- Auth: `x-apisports-key` header (direct api-sports.io) — if going through RapidAPI instead it's `X-RapidAPI-Key`/`X-RapidAPI-Host`. We're using the direct api-sports.io dashboard key.
- Free tier: every endpoint and all 1,236+ leagues are reachable by *league/data type* — but **⚠️ CORRECTED 2026-09-19, confirmed live: the free plan is also restricted to seasons 2022-2024, full stop.** A call for the current 2026 season on any endpoint (tested: `/standings`, `/fixtures`) returns `results: 0` with `errors.plan: "Free plans do not have access to this season, try from 2022 to 2024."` — `season=2023` on the same league/endpoint returns real data. This was wrong in the original research pass below (which only checked request-volume/league-count limits, never actually tried a current-season call) — **the free tier cannot serve any current/live data at all**, only 2022-2024 historical seasons.
- Role in this project, given the correction: **historical backtesting data only** (Phase 8) for now. Does NOT fill the "current Segunda División/2. Bundesliga/Serie B/Ligue 2/Scottish Premiership" gap or provide current injuries/lineups/stats — that requires either a paid API-Football tier, a different free provider, or those capabilities stay unsynced. See the project's Phase 3b plan for how this was actually resolved.

### Rate limiting

- Daily quota: **100 requests/day on the free plan**, resets at 00:00 UTC, unused requests do not roll over.
- Response headers: `x-ratelimit-requests-limit` / `x-ratelimit-requests-remaining` (daily), and a separate per-minute pair (exact free-tier per-minute figure wasn't independently confirmed from the live docs — read it from the response headers at runtime rather than hardcoding).
- Exceeding either limit returns an error response rather than throttling silently — surface this through our own `ProviderError` type and stop the sync job cleanly instead of retrying into more 429s.

### Quota-conservation rules for our sync jobs (load-bearing — 100/day is very tight across 16 leagues)

1. **`/fixtures?date=YYYY-MM-DD` returns fixtures across every league for that date in one call.** Always pull fixtures this way, never per-league.
2. Standings need one call per league — batch these into a single daily job, not per-request.
3. Only fetch match statistics/lineups/injuries for fixtures that actually finished or are actually upcoming soon — never poll a competition with nothing happening.
4. Cache every response in Postgres; the website itself never calls either provider live on a page load — only the scheduled/manual sync jobs do.
5. Track remaining quota locally (persist the last-seen `x-ratelimit-requests-remaining` value) and refuse to run a sync job that would exceed it, rather than discovering the 429 mid-job.

## Sportmonks (v3)

- Docs: https://docs.sportmonks.com/v3
- Auth: `?api_token=` query param (a header form also exists — `Authorization: <token>` — both count toward the same rate limit; the adapter uses the query param since that's the form actually confirmed working live).
- Free tier: **confirmed live, 2026-09-19 — genuinely current-season**, unlike API-Football. `GET /leagues/501?include=currentSeason` returned `currentseason: { name: "2026/2027", is_current: true }`, and standings/fixtures pulled for that season matched real-world results (Celtic top of Scottish Premiership on 18 points from 6 games, confirmed against independent sources). Locked to exactly two leagues: Scottish Premiership (id `501`) and Danish Superliga — nothing else.
- Rate limit: generous — 180/hour on the leagues/league calls made during verification (`rate_limit.remaining` in every response body, not a header). Confirmed header for the adapter: `x-ratelimit-remaining`.
- Response shape is sparse-by-default with an `include` system (`?include=participant;details.type`) rather than a rich default payload — standings gives bare `position`/`points` until you include `details` (an array of typed stat rows, not flat fields: filter by `type.code`, e.g. `overall-goals-for`). Fixtures encode scores similarly, as a flat array of `{participant_id, description, score}` entries (`description: "CURRENT"` for the final/current score, `"1ST_HALF"` for half-time) rather than a clean nested object — more parsing work than football-data.org's shape, but well worth it for genuinely current data.
- No matchday number exposed on the standings endpoint — the adapter uses the max games-played across rows as a proxy (see `src/lib/api/providers/sportmonks.ts`).
- No injuries endpoint found in the documented endpoint list at all (checked 2026-09-19) — Sportmonks doesn't fill that gap either, on any tier.
- Full fixture-state vocabulary (26 values, confirmed live via `GET /states`) is mapped many-to-one onto our `MatchStatus` enum in the adapter — finer-grained than what football-data.org exposes.

## Division of labour (updated 2026-09-19 after live-verifying both the API-Football correction and Sportmonks)

| Data need | Provider |
|---|---|
| Fixtures/results/standings — PL, Championship, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Champions League | football-data.org (current season, confirmed live) |
| Fixtures/results/standings — Scottish Premiership (current season) | **Sportmonks — confirmed live current-season, wired up and syncing (12 teams, 12 standings rows, 9 matches verified against the real database).** |
| Fixtures/results/standings — Segunda División, 2. Bundesliga, Serie B, Ligue 2 (current season) | **No free current-season source found yet.** Stay unsynced (`enabled` in `src/lib/config.ts`, but no live provider covers them) until one is found. |
| Historical backtesting data (2022-2024 seasons only) | API-Football free tier |
| Lineups, injuries, match statistics (shots/possession/cards/corners), xG, player stats — current season, any league | **Not available free for current data on any of the three providers checked.** API-Football has this data type-wise but only for 2022-2024; Sportmonks has no injuries endpoint at all. |

The `FootballDataProvider` interface lets a single logical operation (e.g. "get standings") resolve to whichever provider actually covers that competition's *current* data — see `resolveProviderForLeague` in `src/lib/config.ts`.

## Explicitly not used

- **TheSportsDB** — too thin (10 results/endpoint cap on the free test key) for this project's stats depth.
- **Sofascore / FotMob** — no public, documented, ToS-sanctioned API. Not used regardless of cost.

## Lesson learned

The API-Football "free tier has full access, just rate-limited" claim was accepted from secondary sources (comparison blog posts, marketing pages) without an actual live test call during the original research pass — the season restriction only surfaced when Phase 3b tried to sync current data and got a real error response. Every provider claim in this file that hasn't been marked "confirmed live" should be treated the same way API-Football's was: plausible, not verified, until an actual call proves it.
