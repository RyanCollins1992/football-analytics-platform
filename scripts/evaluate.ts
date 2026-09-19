import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic imports — see scripts/sync-standings.ts for why.
async function main() {
  const { evaluatePrediction, findUnevaluatedPredictions } = await import("@/services/evaluate-prediction");
  const { prisma } = await import("@/lib/database/client");

  const pending = await findUnevaluatedPredictions();

  if (pending.length === 0) {
    console.log("No predictions ready to evaluate (either none exist, or all finished matches already have results).");
    await prisma.$disconnect();
    return;
  }

  let evaluated = 0;
  let failed = 0;

  for (const prediction of pending) {
    try {
      const result = await evaluatePrediction(prediction.id);
      const outcome = result.homeWinCorrect ? "home win ✓" : result.drawCorrect ? "draw ✓" : result.awayWinCorrect ? "away win ✓" : "result ✗";
      console.log(`Prediction #${prediction.id} (match ${prediction.matchId}, ${prediction.modelId}): ${outcome}`);
      evaluated++;
    } catch (error) {
      console.error(`Prediction #${prediction.id} failed to evaluate:`, error);
      failed++;
    }
  }

  console.log(`\n${evaluated} evaluated, ${failed} failed, out of ${pending.length} pending.`);
  await prisma.$disconnect();
}

main();
