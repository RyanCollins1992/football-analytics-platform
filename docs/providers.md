# Football data providers

Two free-tier providers, used together through the `FootballDataProvider` abstraction (`src/lib/providers/`) — neither alone covers everything in scope, and we are not paying for either.

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
- Free tier: **every endpoint and all 1,236+ leagues reachable** — the limit is request volume, not access. This is what gives us Segunda División, 2. Bundesliga, Serie B, Ligue 2, Scottish Premiership, plus lineups/injuries/statistics/xG where a league has them.
- Role in this project: fills every gap football-data.org's free tier leaves — 2nd divisions, Scotland, player-level stats, injuries.

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

## Division of labour (why both, not one)

| Data need | Provider |
|---|---|
| Fixtures/results/standings — PL, Championship, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Champions League | football-data.org |
| Fixtures/results/standings — Segunda División, 2. Bundesliga, Serie B, Ligue 2, Scottish Premiership | API-Football |
| Lineups, injuries, match statistics (shots/possession/cards/corners), xG, player stats — any league | API-Football (only source with this on free tier) |

The `FootballDataProvider` interface must let a single logical operation (e.g. "get today's fixtures") merge results from both providers by competition, not assume one provider answers every call.

## Explicitly not used

- **Sportmonks** — free tier locked to Scottish Premiership + Danish Superliga only; doesn't fit the multi-league free strategy above.
- **TheSportsDB** — too thin (10 results/endpoint cap on the free test key) for this project's stats depth.
- **Sofascore / FotMob** — no public, documented, ToS-sanctioned API. Not used regardless of cost.
