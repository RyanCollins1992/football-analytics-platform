import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic imports — see scripts/sync-standings.ts for why.
async function main() {
  const { runBacktest } = await import("@/services/backtest");
  const { prisma } = await import("@/lib/database/client");
  const { listPredictionModels } = await import("@/lib/predictions");

  const competitionSlug = process.argv[2];
  const modelId = process.argv[3];
  const limitArg = process.argv[4];

  if (!competitionSlug || !modelId) {
    console.error("Usage: npm run backtest -- <competition-slug> <modelId> [limit]");
    console.error(`Known models: ${listPredictionModels().map((m) => m.id).join(", ")}`);
    process.exit(1);
  }

  try {
    const { processed, skipped, summary } = await runBacktest({
      competitionSlug,
      modelId,
      limit: limitArg ? Number(limitArg) : undefined,
    });

    console.log(`\n${competitionSlug} / ${modelId}: ${processed} newly evaluated, ${skipped} already backtested.`);
    console.log(`\nSummary over ${summary.matches} evaluated matches:`);
    console.log(`  Result accuracy:      ${summary.resultAccuracy.toFixed(1)}%`);
    console.log(`  Exact score accuracy: ${summary.exactScoreAccuracy.toFixed(1)}%`);
    console.log(`  Goal MAE:             ${summary.goalMAE.toFixed(2)} (home ${summary.homeGoalMAE.toFixed(2)}, away ${summary.awayGoalMAE.toFixed(2)})`);
    console.log(`  BTTS accuracy:        ${summary.bttsAccuracy.toFixed(1)}%`);
    if (summary.over25Accuracy !== null) {
      console.log(`  Over 2.5 accuracy:    ${summary.over25Accuracy.toFixed(1)}%`);
    }
  } catch (error) {
    console.error("backtest failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
