import Link from "next/link";
import {
  getDataStatus,
  getModelPerformance,
  getRecentResultsAcrossLeagues,
  getTodaysMatches,
  getUpcomingMatchesAcrossLeagues,
} from "@/services/queries";
import { prisma } from "@/lib/database/client";

// Queries live data every request — see /leagues and /teams for why this
// can't be left to Next.js's default static optimization.
export const dynamic = "force-dynamic";

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    date
  );
}

function MatchRow({ match }: { match: { id: number; scheduledAt: Date; homeTeam: { name: string }; awayTeam: { name: string }; competition: { name: string }; status: string; homeScore: number | null; awayScore: number | null } }) {
  const finished = match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null;
  return (
    <li>
      <Link href={`/matches/${match.id}`} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-black dark:hover:text-white">
        <span className="w-32 shrink-0 text-black/50 dark:text-white/50">{formatKickoff(match.scheduledAt)}</span>
        <span className="flex-1 truncate">
          {match.homeTeam.name} vs {match.awayTeam.name}
        </span>
        {finished ? (
          <span className="tabular-nums font-semibold">
            {match.homeScore}–{match.awayScore}
          </span>
        ) : (
          <span className="text-xs text-black/40 dark:text-white/40">{match.competition.name}</span>
        )}
      </Link>
    </li>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm text-black/50 dark:text-white/50">{children}</p>;
}

export default async function DashboardPage() {
  const [todays, upcoming, recent, dataStatus, modelPerformance, leagueCount, upcomingCount, predictionCount, evaluatedCount] =
    await Promise.all([
      getTodaysMatches(),
      getUpcomingMatchesAcrossLeagues(7),
      getRecentResultsAcrossLeagues(8),
      getDataStatus(),
      getModelPerformance(),
      prisma.competition.count(),
      prisma.match.count({ where: { status: { in: ["SCHEDULED", "TIMED"] } } }),
      prisma.prediction.count(),
      prisma.predictionResult.count(),
    ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-3 max-w-xl text-sm text-black/60 dark:text-white/60">
        A live snapshot of synced data, upcoming fixtures, and model performance across all {leagueCount} tracked competitions.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Today&apos;s matches</h2>
          {todays.length === 0 ? (
            <EmptyRow>No matches scheduled today.</EmptyRow>
          ) : (
            <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
              {todays.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Upcoming (next 7 days)</h2>
          {upcoming.length === 0 ? (
            <EmptyRow>No fixtures synced for the next 7 days.</EmptyRow>
          ) : (
            <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
              {upcoming.slice(0, 8).map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <Link href="/predictions" className="mt-3 inline-block text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
              View with predictions &rarr;
            </Link>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Recently completed</h2>
          {recent.length === 0 ? (
            <EmptyRow>No finished matches synced yet.</EmptyRow>
          ) : (
            <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
              {recent.map((m) => (
                <MatchRow key={m.id} match={m} />
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">League overview</h2>
          <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
            {dataStatus.map((league) => (
              <li key={league.slug}>
                <Link href={`/leagues/${league.slug}`} className="flex items-center justify-between gap-4 py-3 text-sm hover:text-black dark:hover:text-white">
                  <span>{league.name}</span>
                  <span className="text-xs text-black/40 dark:text-white/40">
                    {league.teamCount > 0 ? `${league.teamCount} teams · ${league.matchCount} matches` : "not synced yet"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Prediction summary</h2>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
              <dt className="text-xs text-black/50 dark:text-white/50">Upcoming</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{upcomingCount}</dd>
            </div>
            <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
              <dt className="text-xs text-black/50 dark:text-white/50">Predictions made</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{predictionCount}</dd>
            </div>
            <div className="rounded-lg border border-black/10 p-4 dark:border-white/10">
              <dt className="text-xs text-black/50 dark:text-white/50">Evaluated</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{evaluatedCount}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Model performance</h2>
          <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
            {modelPerformance.map((row) => (
              <li key={row.modelId} className="flex items-center justify-between py-3 text-sm">
                <span>{row.modelId}</span>
                {row.summary.matches === 0 ? (
                  <span className="text-xs text-black/40 dark:text-white/40">no evaluated predictions yet</span>
                ) : (
                  <span className="tabular-nums text-black/60 dark:text-white/60">
                    {row.summary.resultAccuracy.toFixed(0)}% (n={row.summary.matches})
                  </span>
                )}
              </li>
            ))}
          </ul>
          <Link href="/predictions/performance" className="mt-3 inline-block text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
            Full model performance &rarr;
          </Link>
        </section>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Data status</h2>
        <p className="mt-2 max-w-2xl text-xs text-black/50 dark:text-white/50">
          A descriptive freshness readout — team/match counts and the most recently synced match per league, not a
          fabricated stale/fresh verdict.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-black/40 dark:text-white/40">
                <th className="pb-2 font-medium">League</th>
                <th className="pb-2 font-medium">Teams</th>
                <th className="pb-2 font-medium">Matches</th>
                <th className="pb-2 font-medium">Most recent match</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/10 dark:divide-white/10">
              {dataStatus.map((league) => (
                <tr key={league.slug}>
                  <td className="py-2">{league.name}</td>
                  <td className="py-2 tabular-nums">{league.teamCount}</td>
                  <td className="py-2 tabular-nums">{league.matchCount}</td>
                  <td className="py-2 text-black/60 dark:text-white/60">
                    {league.mostRecentMatchAt ? formatKickoff(league.mostRecentMatchAt) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
