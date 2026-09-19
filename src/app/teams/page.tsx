import Link from "next/link";
import { getTeamsWithData } from "@/services/queries";

// No dynamic route segment here — same reasoning as src/app/leagues/page.tsx.
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const teams = await getTeamsWithData();

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
      <p className="mt-3 max-w-xl text-sm text-black/60 dark:text-white/60">
        Every team with synced data, reachable normally via a league&rsquo;s standings table &mdash; this is the flat
        overview.
      </p>

      {teams.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-black/15 px-4 py-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
          No teams synced yet. Sync a league&rsquo;s standings or fixtures first &mdash; see the README.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                href={`/teams/${team.id}`}
                className="flex items-center justify-between border-b border-black/5 py-3 text-sm hover:text-black dark:border-white/5 dark:hover:text-white"
              >
                <span>{team.name}</span>
                <span className="text-xs text-black/40 dark:text-white/40">
                  {team.competitionTeams[0]?.competition.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
