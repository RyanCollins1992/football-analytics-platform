import Link from "next/link";
import { notFound } from "next/navigation";
import { getHeadToHeadMatches, getLatestPredictionsForMatches, getMatchDetail } from "@/services/queries";
import { computeHeadToHead } from "@/lib/analytics/head-to-head";
import { listPredictionModels } from "@/lib/predictions";
import { DEFAULT_PREDICTION_MODEL } from "@/lib/config";
import { buildScorelineMatrix } from "@/lib/predictions/poisson";
import {
  bttsAndOverUnder,
  bttsAndResult,
  bttsFromMatrix,
  doubleChance,
  drawNoBet,
  handicap,
  matchResult,
  overUnder,
  topCorrectScores,
  winningMargin,
} from "@/lib/predictions/markets";
import { buildHalfTimeMatrices, htFtJointGrid } from "@/lib/predictions/half-time";
import { NoHistoryCaveat } from "@/components/no-history-caveat";

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

/** Assembles everything the Markets section renders from one model's stored (lambdaHome, lambdaAway) — nothing here touches the database. */
function buildMarketsView(lambdaHome: number, lambdaAway: number) {
  const scorelineMatrix = buildScorelineMatrix(lambdaHome, lambdaAway);
  const result = matchResult(scorelineMatrix);
  const dc = doubleChance(result);
  const dnb = drawNoBet(result);
  const btts = bttsFromMatrix(scorelineMatrix);
  const bttsResult = bttsAndResult(scorelineMatrix);
  const bttsOU25 = bttsAndOverUnder(scorelineMatrix, 2.5);
  const topScores = topCorrectScores(scorelineMatrix, 5);
  const overUnderLines = [0.5, 1.5, 2.5, 3.5, 4.5].map((line) => ({ line, ...overUnder(scorelineMatrix, line) }));
  const handicapLines = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((line) => ({ line, ...handicap(scorelineMatrix, line) }));
  const margin = winningMargin(scorelineMatrix);

  const { htMatrix, secondHalfMatrix } = buildHalfTimeMatrices(lambdaHome, lambdaAway);
  const htResult = matchResult(htMatrix);
  const htOverUnderLines = [0.5, 1.5].map((line) => ({ line, ...overUnder(htMatrix, line) }));
  const htBtts = bttsFromMatrix(htMatrix);
  const htTopScores = topCorrectScores(htMatrix, 3);
  const htFtGrid = htFtJointGrid(htMatrix, secondHalfMatrix);

  return {
    maxGoals: scorelineMatrix.maxGoals,
    result,
    dc,
    dnb,
    btts,
    bttsResult,
    bttsOU25,
    topScores,
    overUnderLines,
    handicapLines,
    margin,
    htResult,
    htOverUnderLines,
    htBtts,
    htTopScores,
    htFtGrid,
  };
}

function MarketSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">{title}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function MarketRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1 text-sm">
      <span className="text-black/60 dark:text-white/60">{label}</span>
      <span className="shrink-0 tabular-nums font-medium">{value}</span>
    </div>
  );
}

function Divider() {
  return <hr className="my-2 border-black/10 dark:border-white/10" />;
}

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Scheduled",
  TIMED: "Scheduled",
  IN_PLAY: "In play",
  PAUSED: "Half-time",
  EXTRA_TIME: "Extra time",
  PENALTY_SHOOTOUT: "Penalties",
  FINISHED: "Full-time",
  SUSPENDED: "Suspended",
  POSTPONED: "Postponed",
  CANCELLED: "Cancelled",
  AWARDED: "Awarded",
};

export default async function MatchDetailPage(props: PageProps<"/matches/[id]">) {
  const { id } = await props.params;
  const matchId = Number(id);
  if (!Number.isInteger(matchId)) notFound();

  const match = await getMatchDetail(matchId);
  if (!match) notFound();

  const played = match.homeScore !== null && match.awayScore !== null;
  const h2hMatches = await getHeadToHeadMatches(match.homeTeam.id, match.awayTeam.id);
  const h2h = computeHeadToHead(match.homeTeam.id, match.awayTeam.id, h2hMatches);

  const searchParams = await props.searchParams;
  const models = listPredictionModels();
  const requestedModel = typeof searchParams.model === "string" ? searchParams.model : undefined;
  const modelId = models.some((m) => m.id === requestedModel) ? requestedModel! : DEFAULT_PREDICTION_MODEL;

  const predictionsByMatch = await getLatestPredictionsForMatches([matchId], modelId);
  const prediction = predictionsByMatch.get(matchId);
  const isDegenerate = prediction ? prediction.predictedHomeGoals === 0 && prediction.predictedAwayGoals === 0 : false;
  const markets = prediction && !isDegenerate ? buildMarketsView(prediction.predictedHomeGoals, prediction.predictedAwayGoals) : null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href={`/leagues/${match.competition.slug}`}
        className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
      >
        &larr; {match.competition.name}
      </Link>

      <div className="mt-6 rounded-xl border border-black/10 px-6 py-8 text-center dark:border-white/10">
        <p className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">
          {match.season.name} {match.matchday ? `· Matchday ${match.matchday}` : ""}
        </p>
        <div className="mt-4 flex items-center justify-center gap-6 text-lg font-semibold">
          <Link href={`/teams/${match.homeTeam.id}`} className="flex-1 text-right hover:underline">
            {match.homeTeam.name}
          </Link>
          <span className="tabular-nums text-2xl">
            {played ? `${match.homeScore} – ${match.awayScore}` : "vs"}
          </span>
          <Link href={`/teams/${match.awayTeam.id}`} className="flex-1 text-left hover:underline">
            {match.awayTeam.name}
          </Link>
        </div>
        {played && match.halfTimeHomeScore !== null && match.halfTimeAwayScore !== null && (
          <p className="mt-2 text-xs text-black/40 dark:text-white/40">
            HT {match.halfTimeHomeScore}&ndash;{match.halfTimeAwayScore}
          </p>
        )}
        <p className="mt-4 text-sm text-black/60 dark:text-white/60">{formatKickoff(match.scheduledAt)}</p>
        <p className="mt-1 inline-block rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-black/50 dark:border-white/10 dark:text-white/50">
          {STATUS_LABEL[match.status] ?? match.status}
        </p>
        {match.venue && <p className="mt-3 text-xs text-black/40 dark:text-white/40">{match.venue}</p>}
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
          Head-to-head
        </h2>
        {h2h.meetings === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            No previous meetings synced between these two teams yet.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <MiniStat label={`${match.homeTeam.name} wins`} value={h2h.teamAWins} />
              <MiniStat label="Draws" value={h2h.draws} />
              <MiniStat label={`${match.awayTeam.name} wins`} value={h2h.teamBWins} />
              <MiniStat label="Avg. goals" value={h2h.avgTotalGoals.toFixed(1)} />
              <MiniStat label="BTTS" value={`${h2h.bttsPercentage.toFixed(0)}%`} />
              <MiniStat label="Over 1.5" value={`${h2h.over15Percentage.toFixed(0)}%`} />
              <MiniStat label="Over 2.5" value={`${h2h.over25Percentage.toFixed(0)}%`} />
              <MiniStat label="Over 3.5" value={`${h2h.over35Percentage.toFixed(0)}%`} />
            </div>
            <p className="text-xs text-black/40 dark:text-white/40">
              Based on {h2h.meetings} previous meeting{h2h.meetings === 1 ? "" : "s"} &mdash; a small sample isn&rsquo;t
              strong evidence on its own.
            </p>
            <ul className="divide-y divide-black/10 dark:divide-white/10">
              {h2h.matches.map((m) => (
                <li key={m.matchId} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/matches/${m.matchId}`} className="text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
                    {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(m.scheduledAt)}
                  </Link>
                  <span className="tabular-nums font-medium">
                    {m.homeTeamId === match.homeTeam.id
                      ? `${match.homeTeam.name} ${m.homeScore}–${m.awayScore} ${match.awayTeam.name}`
                      : `${match.awayTeam.name} ${m.homeScore}–${m.awayScore} ${match.homeTeam.name}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Markets</h2>
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">
          Every market below is computed live from the selected model&rsquo;s predicted goal rates &mdash; nothing here
          is stored separately. Player props and corners/cards markets aren&rsquo;t available: no free current-season
          data source for shots/corners/cards/player stats has been found on any integrated provider (see{" "}
          <code className="rounded bg-black/5 px-1 dark:bg-white/10">docs/providers.md</code>).
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {models.map((m) => (
            <Link
              key={m.id}
              href={`/matches/${matchId}?model=${m.id}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                m.id === modelId
                  ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-black/10 text-black/60 hover:text-black dark:border-white/10 dark:text-white/60 dark:hover:text-white"
              }`}
            >
              {m.id}
            </Link>
          ))}
        </div>

        {!prediction ? (
          <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            No prediction generated yet for the {modelId} model.
          </p>
        ) : isDegenerate ? (
          <NoHistoryCaveat />
        ) : markets ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MarketSection title="Match result">
              <MarketRow label={`${match.homeTeam.name} win`} value={pct(markets.result.homeWin)} />
              <MarketRow label="Draw" value={pct(markets.result.draw)} />
              <MarketRow label={`${match.awayTeam.name} win`} value={pct(markets.result.awayWin)} />
            </MarketSection>

            <MarketSection title="Double chance & draw no bet">
              <MarketRow label="Home or draw" value={pct(markets.dc.homeOrDraw)} />
              <MarketRow label="Home or away" value={pct(markets.dc.homeOrAway)} />
              <MarketRow label="Draw or away" value={pct(markets.dc.drawOrAway)} />
              <Divider />
              <MarketRow label={`DNB: ${match.homeTeam.name}`} value={pct(markets.dnb.homeWin)} />
              <MarketRow label={`DNB: ${match.awayTeam.name}`} value={pct(markets.dnb.awayWin)} />
            </MarketSection>

            <MarketSection title="Over/Under goals">
              {markets.overUnderLines.map((row) => (
                <MarketRow key={row.line} label={`Over/Under ${row.line}`} value={`${pct(row.over)} / ${pct(row.under)}`} />
              ))}
            </MarketSection>

            <MarketSection title="Both teams to score">
              <MarketRow label="BTTS Yes" value={pct(markets.btts.yes)} />
              <MarketRow label="BTTS No" value={pct(markets.btts.no)} />
              <Divider />
              <MarketRow label={`${match.homeTeam.name} win & BTTS Yes`} value={pct(markets.bttsResult.homeWinBttsYes)} />
              <MarketRow label="Draw & BTTS Yes" value={pct(markets.bttsResult.drawBttsYes)} />
              <MarketRow label={`${match.awayTeam.name} win & BTTS Yes`} value={pct(markets.bttsResult.awayWinBttsYes)} />
              <Divider />
              <MarketRow label="BTTS Yes & Over 2.5" value={pct(markets.bttsOU25.bttsYesOver)} />
              <MarketRow label="BTTS No & Under 2.5" value={pct(markets.bttsOU25.bttsNoUnder)} />
            </MarketSection>

            <MarketSection title="Correct score (top 5)">
              {markets.topScores.map((s, i) => (
                <MarketRow
                  key={i}
                  label={`${s.homeGoals}${s.homeGoals === markets.maxGoals ? "+" : ""}-${s.awayGoals}${
                    s.awayGoals === markets.maxGoals ? "+" : ""
                  }`}
                  value={pct(s.probability)}
                />
              ))}
            </MarketSection>

            <MarketSection title={`Handicap (${match.homeTeam.name})`}>
              {markets.handicapLines.map((row) => (
                <MarketRow
                  key={row.line}
                  label={row.line > 0 ? `+${row.line}` : `${row.line}`}
                  value={
                    row.push > 0
                      ? `${pct(row.homeCovers)} / push ${pct(row.push)} / ${pct(row.awayCovers)}`
                      : `${pct(row.homeCovers)} / ${pct(row.awayCovers)}`
                  }
                />
              ))}
            </MarketSection>

            <MarketSection title="Winning margin">
              <MarketRow label={`${match.homeTeam.name} by 1`} value={pct(markets.margin.home.one)} />
              <MarketRow label={`${match.homeTeam.name} by 2`} value={pct(markets.margin.home.two)} />
              <MarketRow label={`${match.homeTeam.name} by 3+`} value={pct(markets.margin.home.three + markets.margin.home.fourPlus)} />
              <MarketRow label="Draw" value={pct(markets.margin.draw)} />
              <MarketRow label={`${match.awayTeam.name} by 1`} value={pct(markets.margin.away.one)} />
              <MarketRow label={`${match.awayTeam.name} by 2`} value={pct(markets.margin.away.two)} />
              <MarketRow label={`${match.awayTeam.name} by 3+`} value={pct(markets.margin.away.three + markets.margin.away.fourPlus)} />
            </MarketSection>

            <MarketSection title="Half-time">
              <p className="mb-2 text-xs text-black/40 dark:text-white/40">
                Assumes 45% of goals land in the first half &mdash; a general estimate, not fitted to this data.
              </p>
              <MarketRow label={`HT: ${match.homeTeam.name}`} value={pct(markets.htResult.homeWin)} />
              <MarketRow label="HT: Draw" value={pct(markets.htResult.draw)} />
              <MarketRow label={`HT: ${match.awayTeam.name}`} value={pct(markets.htResult.awayWin)} />
              <Divider />
              {markets.htOverUnderLines.map((row) => (
                <MarketRow key={row.line} label={`HT Over/Under ${row.line}`} value={`${pct(row.over)} / ${pct(row.under)}`} />
              ))}
              <MarketRow label="HT BTTS Yes/No" value={`${pct(markets.htBtts.yes)} / ${pct(markets.htBtts.no)}`} />
              <Divider />
              <p className="mb-1 text-xs text-black/40 dark:text-white/40">HT correct score (top 3)</p>
              {markets.htTopScores.map((s, i) => (
                <MarketRow key={i} label={`${s.homeGoals}-${s.awayGoals}`} value={pct(s.probability)} />
              ))}
            </MarketSection>

            <MarketSection title="Half-time / full-time">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="pb-1 text-left font-normal text-black/40 dark:text-white/40">HT \ FT</th>
                      <th className="pb-1 text-right font-normal text-black/40 dark:text-white/40">Home</th>
                      <th className="pb-1 text-right font-normal text-black/40 dark:text-white/40">Draw</th>
                      <th className="pb-1 text-right font-normal text-black/40 dark:text-white/40">Away</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["H", "D", "A"] as const).map((ht) => (
                      <tr key={ht}>
                        <td className="py-1 text-black/60 dark:text-white/60">{ht === "H" ? "Home" : ht === "D" ? "Draw" : "Away"}</td>
                        <td className="py-1 text-right tabular-nums">{pct(markets.htFtGrid[ht].H)}</td>
                        <td className="py-1 text-right tabular-nums">{pct(markets.htFtGrid[ht].D)}</td>
                        <td className="py-1 text-right tabular-nums">{pct(markets.htFtGrid[ht].A)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </MarketSection>
          </div>
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
          Match statistics
        </h2>
        {match.statistics.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            No statistics synced for this match &mdash; match-statistics sync isn&rsquo;t built yet (needs
            API-Football or another current-data source; see docs/providers.md).
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4">
            {match.statistics.map((stat) => (
              <div key={stat.id} className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
                <p className="font-medium">{stat.team.name}</p>
                <dl className="mt-2 space-y-1 text-black/60 dark:text-white/60">
                  {stat.shots !== null && <StatRow label="Shots" value={stat.shots} />}
                  {stat.shotsOnTarget !== null && <StatRow label="On target" value={stat.shotsOnTarget} />}
                  {stat.possession !== null && <StatRow label="Possession" value={`${stat.possession}%`} />}
                  {stat.corners !== null && <StatRow label="Corners" value={stat.corners} />}
                </dl>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/10 p-3 text-center dark:border-white/10">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">{label}</p>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
