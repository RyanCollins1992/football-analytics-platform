import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamMatchRecords, getTeamWithMatches } from "@/services/queries";
import { computeTeamStats, type TeamMatchRecord, type TeamStats } from "@/lib/analytics/team-stats";

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function TeamDetailPage(props: PageProps<"/teams/[id]">) {
  const { id } = await props.params;
  const teamId = Number(id);
  if (!Number.isInteger(teamId)) notFound();

  const [data, records] = await Promise.all([getTeamWithMatches(teamId), getTeamMatchRecords(teamId)]);
  if (!data) notFound();
  const { team, upcoming, recent } = data;

  const home = records.filter((r) => r.isHome);
  const away = records.filter((r) => !r.isHome);

  const statBlocks: { label: string; records: TeamMatchRecord[] }[] = [
    { label: "Overall", records },
    { label: "Home", records: home },
    { label: "Away", records: away },
    { label: "Last 5", records: records.slice(0, 5) },
    { label: "Last 10", records: records.slice(0, 10) },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/teams" className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
        &larr; Teams
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{team.name}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">{team.country ?? "Country unknown"}</p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Form &amp; statistics</h2>
        {records.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
            No finished matches synced yet &mdash; nothing to compute.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {statBlocks.map((block) => (
              <StatCard key={block.label} label={block.label} stats={computeTeamStats(block.records)} sampleSize={block.records.length} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
          Upcoming fixtures
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-black/50 dark:text-white/50">No upcoming fixtures synced.</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
            {upcoming.map((match) => (
              <li key={match.id}>
                <Link
                  href={`/matches/${match.id}`}
                  className="flex items-center justify-between gap-4 py-3 text-sm hover:text-black dark:hover:text-white"
                >
                  <span className="text-black/50 dark:text-white/50">{formatKickoff(match.scheduledAt)}</span>
                  <span>
                    {match.homeTeam.id === team.id ? "vs " + match.awayTeam.name : "at " + match.homeTeam.name}
                  </span>
                  <span className="text-xs text-black/40 dark:text-white/40">{match.competition.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Recent results</h2>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-black/50 dark:text-white/50">No recent results synced.</p>
        ) : (
          <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
            {recent.map((match) => {
              const isHome = match.homeTeam.id === team.id;
              const ownScore = isHome ? match.homeScore : match.awayScore;
              const oppScore = isHome ? match.awayScore : match.homeScore;
              const oppName = isHome ? match.awayTeam.name : match.homeTeam.name;
              return (
                <li key={match.id}>
                  <Link
                    href={`/matches/${match.id}`}
                    className="flex items-center justify-between gap-4 py-3 text-sm hover:text-black dark:hover:text-white"
                  >
                    <span className="text-black/50 dark:text-white/50">{formatKickoff(match.scheduledAt)}</span>
                    <span>{isHome ? "vs " : "at "}{oppName}</span>
                    <span className="tabular-nums font-semibold">
                      {ownScore !== null && oppScore !== null ? `${ownScore}–${oppScore}` : match.status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, stats, sampleSize }: { label: string; stats: TeamStats; sampleSize: number }) {
  if (sampleSize === 0) {
    return (
      <div className="rounded-lg border border-dashed border-black/10 p-4 text-sm text-black/40 dark:border-white/10 dark:text-white/40">
        <p className="font-medium">{label}</p>
        <p className="mt-1 text-xs">No matches in this window</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
      <p className="flex items-baseline justify-between font-medium">
        <span>{label}</span>
        <span className="text-xs font-normal text-black/40 dark:text-white/40">{sampleSize} played</span>
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-y-1 text-black/60 dark:text-white/60">
        <Row label="Record" value={`${stats.wins}W ${stats.draws}D ${stats.losses}L`} />
        <Row label="Points/game" value={stats.pointsPerGame.toFixed(2)} />
        <Row label="Goals for/game" value={stats.goalsForPerGame.toFixed(2)} />
        <Row label="Goals against/game" value={stats.goalsAgainstPerGame.toFixed(2)} />
        <Row label="Clean sheets" value={`${stats.cleanSheetPercentage.toFixed(0)}%`} />
        <Row label="Failed to score" value={`${stats.failedToScorePercentage.toFixed(0)}%`} />
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </>
  );
}
