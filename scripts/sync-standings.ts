import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic imports, not static ones: static `import` statements are hoisted
// above this file's own code, which would construct the Prisma client (via
// src/lib/database/client.ts's module-level singleton) before config() above
// ever ran — DATABASE_URL would still be undefined at that point.
async function main() {
  const { syncStandings } = await import("@/services/standings-sync");
  const { prisma } = await import("@/lib/database/client");

  const competitionSlug = process.argv[2];
  if (!competitionSlug) {
    console.error("Usage: npm run sync:standings -- <competition-slug>");
    console.error("Example: npm run sync:standings -- premier-league");
    process.exit(1);
  }

  try {
    const result = await syncStandings(competitionSlug);
    console.log(`\n${result.competitionSlug}: ${result.teamsUpserted} teams, ${result.standingsWritten} standings rows written.`);
  } catch (error) {
    console.error("sync:standings failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
