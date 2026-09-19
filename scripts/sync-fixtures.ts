import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic imports, not static ones — see scripts/sync-standings.ts for why
// (import hoisting would construct the DB client before config() ran).
async function main() {
  const { syncFixtures } = await import("@/services/fixtures-sync");
  const { prisma } = await import("@/lib/database/client");

  const competitionSlug = process.argv[2];
  const dateFromArg = process.argv[3];
  const dateToArg = process.argv[4];

  if (!competitionSlug) {
    console.error("Usage: npm run sync:fixtures -- <competition-slug> [dateFrom YYYY-MM-DD] [dateTo YYYY-MM-DD]");
    console.error("Example: npm run sync:fixtures -- premier-league 2026-09-19 2026-09-26");
    process.exit(1);
  }

  try {
    const result = await syncFixtures(
      competitionSlug,
      dateFromArg ? new Date(dateFromArg) : undefined,
      dateToArg ? new Date(dateToArg) : undefined
    );
    console.log(`\n${result.competitionSlug}: ${result.matchesUpserted} matches upserted.`);
  } catch (error) {
    console.error("sync:fixtures failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
