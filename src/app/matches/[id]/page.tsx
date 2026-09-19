import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatchDetail } from "@/services/queries";

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

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
