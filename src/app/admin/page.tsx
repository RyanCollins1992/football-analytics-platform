import { prisma } from "@/lib/database/client";
import { getDataStatus } from "@/services/queries";

export const dynamic = "force-dynamic";

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    date
  );
}

const PROVIDER_ENV_VARS = [
  { label: "football-data.org", envVar: "FOOTBALL_DATA_ORG_API_KEY" },
  { label: "API-Football", envVar: "API_FOOTBALL_KEY" },
  { label: "Sportmonks", envVar: "SPORTMONKS_API_TOKEN" },
] as const;

export default async function AdminPage() {
  const [competitionCount, seasonCount, teamCount, playerCount, matchCount, predictionCount, resultCount, dataStatus] =
    await Promise.all([
      prisma.competition.count(),
      prisma.season.count(),
      prisma.team.count(),
      prisma.player.count(),
      prisma.match.count(),
      prisma.prediction.count(),
      prisma.predictionResult.count(),
      getDataStatus(),
    ]);

  const recordCounts = [
    { label: "Competitions", value: competitionCount },
    { label: "Seasons", value: seasonCount },
    { label: "Teams", value: teamCount },
    { label: "Players", value: playerCount },
    { label: "Matches", value: matchCount },
    { label: "Predictions", value: predictionCount },
    { label: "Evaluated results", value: resultCount },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-3 max-w-2xl text-sm text-black/60 dark:text-white/60">
        Real database counts and provider configuration status — an information page, not a control panel. Triggering
        syncs from here (rather than the <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">npm run sync:*</code>{" "}
        CLI) would mean running external API calls from inside a web request, which is a separate feature this
        project hasn&rsquo;t built.
      </p>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Database</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {recordCounts.map((row) => (
            <div key={row.label} className="rounded-lg border border-black/10 p-4 text-center dark:border-white/10">
              <dt className="text-xs text-black/50 dark:text-white/50">{row.label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Provider configuration</h2>
        <p className="mt-2 text-xs text-black/50 dark:text-white/50">Whether each key is set — never the value itself.</p>
        <ul className="mt-4 divide-y divide-black/10 dark:divide-white/10">
          {PROVIDER_ENV_VARS.map((provider) => {
            const configured = Boolean(process.env[provider.envVar]);
            return (
              <li key={provider.envVar} className="flex items-center justify-between py-3 text-sm">
                <span>{provider.label}</span>
                <span
                  className={
                    configured
                      ? "rounded-full border border-black/10 px-2 py-0.5 text-xs text-black/60 dark:border-white/10 dark:text-white/60"
                      : "rounded-full border border-dashed border-black/15 px-2 py-0.5 text-xs text-black/40 dark:border-white/15 dark:text-white/40"
                  }
                >
                  {configured ? "configured" : "not set"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">Data status by league</h2>
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
