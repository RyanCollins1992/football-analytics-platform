import { prisma } from "../src/lib/database/client";
import { getEnabledLeagues, DEFAULT_SEASON } from "../src/lib/config";

/**
 * Seeds only Competition + Season rows, derived directly from
 * src/lib/config.ts — real data, not fabricated teams/matches/results.
 * See docs/providers.md and the Phase 2 plan for why: Phase 3's real
 * provider sync is the correct source for everything else.
 */
async function main() {
  const leagues = getEnabledLeagues();
  const seasonName = `${DEFAULT_SEASON}/${String(DEFAULT_SEASON + 1).slice(2)}`;

  for (const league of leagues) {
    const competition = await prisma.competition.upsert({
      where: { slug: league.id },
      update: { name: league.name, country: league.country },
      create: { slug: league.id, name: league.name, country: league.country },
    });

    await prisma.season.upsert({
      where: { competitionId_name: { competitionId: competition.id, name: seasonName } },
      update: { isCurrent: true },
      create: {
        competitionId: competition.id,
        name: seasonName,
        year: DEFAULT_SEASON,
        isCurrent: true,
      },
    });

    console.log(`seeded ${league.name} (${seasonName})`);
  }

  console.log(`\nDone: ${leagues.length} competitions, ${leagues.length} seasons.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
