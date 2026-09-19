import Link from "next/link";
import { getEnabledLeagues } from "@/lib/config";
import { prisma } from "@/lib/database/client";

// This page has no dynamic route segment, so Next.js's default static
// optimization would otherwise bake in whatever the database looked like at
// build time — wrong for a page whose whole point is showing current sync
// status. Forces a real query on every request instead.
export const dynamic = "force-dynamic";

export default async function LeaguesPage() {
  const leagues = getEnabledLeagues();
  const withData = await prisma.competition.findMany({
    where: { standings: { some: {} } },
    select: { slug: true },
  });
  const syncedSlugs = new Set(withData.map((c) => c.slug));

  const byCountry = new Map<string, typeof leagues>();
  for (const league of leagues) {
    const list = byCountry.get(league.country) ?? [];
    list.push(league);
    byCountry.set(league.country, list);
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Leagues</h1>
      <p className="mt-3 max-w-xl text-sm text-black/60 dark:text-white/60">
        Every league configured in this app. Leagues without synced data yet are marked — see the README for how to
        sync one.
      </p>

      <div className="mt-10 space-y-8">
        {Array.from(byCountry.entries()).map(([country, countryLeagues]) => (
          <div key={country}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
              {country}
            </h2>
            <ul className="mt-3 divide-y divide-black/10 dark:divide-white/10">
              {countryLeagues.map((league) => {
                const synced = syncedSlugs.has(league.id);
                return (
                  <li key={league.id}>
                    <Link
                      href={`/leagues/${league.id}`}
                      className="flex items-center justify-between py-3 text-sm hover:text-black dark:hover:text-white"
                    >
                      <span>{league.name}</span>
                      {!synced && (
                        <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-black/50 dark:border-white/10 dark:text-white/50">
                          not synced yet
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
