import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamWithMatches } from "@/services/queries";

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

  const data = await getTeamWithMatches(teamId);
  if (!data) notFound();
  const { team, upcoming, recent } = data;

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/teams" className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
        &larr; Teams
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{team.name}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">{team.country ?? "Country unknown"}</p>

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
