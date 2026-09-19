import Link from "next/link";
import { notFound } from "next/navigation";
import { getLeague } from "@/lib/config";
import { getLeagueWithLatestStandings, getRecentResults, getUpcomingFixtures } from "@/services/queries";

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export default async function LeagueDetailPage(props: PageProps<"/leagues/[slug]">) {
  const { slug } = await props.params;
  const league = getLeague(slug);
  if (!league) notFound();

  const [standingsData, upcoming, recent] = await Promise.all([
    getLeagueWithLatestStandings(slug),
    getUpcomingFixtures(slug),
    getRecentResults(slug),
  ]);

  if (!standingsData) notFound();
  const { season, matchday, standings } = standingsData;

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/leagues" className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
        &larr; Leagues
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{league.name}</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        {league.country}
        {season ? ` · ${season.name} season` : ""}
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
          Standings{matchday !== null ? ` — through matchday ${matchday}` : ""}
        </h2>
        {standings.length === 0 ? (
          <EmptyState command={`npm run sync:standings -- ${slug}`} />
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-black/40 dark:border-white/10 dark:text-white/40">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 text-right font-medium">P</th>
                  <th className="px-3 py-2 text-right font-medium">W</th>
                  <th className="px-3 py-2 text-right font-medium">D</th>
                  <th className="px-3 py-2 text-right font-medium">L</th>
                  <th className="px-3 py-2 text-right font-medium">GD</th>
                  <th className="px-3 py-2 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.id} className="border-b border-black/5 last:border-0 dark:border-white/5">
                    <td className="px-3 py-2 tabular-nums">{row.position}</td>
                    <td className="px-3 py-2">
                      <Link href={`/teams/${row.team.id}`} className="hover:underline">
                        {row.team.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.played}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.wins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.draws}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.losses}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.goalDifference}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Recent results</h2>
        {recent.length === 0 ? (
          <EmptyState command={`npm run sync:fixtures -- ${slug} <from> <to>`} />
        ) : (
          <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
            {recent.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Upcoming fixtures</h2>
        {upcoming.length === 0 ? (
          <EmptyState command={`npm run sync:fixtures -- ${slug} <from> <to>`} />
        ) : (
          <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
            {upcoming.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyState({ command }: { command: string }) {
  return (
    <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
      No data synced yet.{" "}
      <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">{command}</code>
    </p>
  );
}

function MatchRow({
  match,
}: {
  match: {
    id: number;
    scheduledAt: Date;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    homeTeam: { id: number; name: string };
    awayTeam: { id: number; name: string };
  };
}) {
  return (
    <li className="py-3">
      <Link href={`/matches/${match.id}`} className="flex items-center justify-between gap-4 text-sm hover:text-black dark:hover:text-white">
        <span className="text-black/50 dark:text-white/50">{formatKickoff(match.scheduledAt)}</span>
        <span className="flex-1 text-right">{match.homeTeam.name}</span>
        <span className="tabular-nums font-semibold">
          {match.homeScore !== null && match.awayScore !== null ? `${match.homeScore} – ${match.awayScore}` : "vs"}
        </span>
        <span className="flex-1">{match.awayTeam.name}</span>
      </Link>
    </li>
  );
}
