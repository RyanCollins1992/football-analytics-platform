import { config } from "dotenv";
config({ path: ".env.local" });

// Dynamic imports — see scripts/sync-standings.ts for why (import hoisting
// would construct the DB client before config() ran).
async function main() {
  const { generatePrediction } = await import("@/services/predict");
  const { prisma } = await import("@/lib/database/client");
  const { listPredictionModels } = await import("@/lib/predictions");

  const matchId = Number(process.argv[2]);
  const modelId = process.argv[3];

  if (!Number.isInteger(matchId) || !modelId) {
    console.error("Usage: npm run predict -- <matchId> <modelId>");
    console.error(`Known models: ${listPredictionModels().map((m) => m.id).join(", ")}`);
    process.exit(1);
  }

  try {
    const prediction = await generatePrediction(matchId, modelId);
    console.log(
      `\nPrediction #${prediction.id} for match ${matchId} (${modelId} ${prediction.modelVersion}):\n` +
        `  ${prediction.predictedHomeGoals.toFixed(2)} - ${prediction.predictedAwayGoals.toFixed(2)} (expected goals)\n` +
        `  Home ${(prediction.predictedHomeWinProbability * 100).toFixed(1)}% / Draw ${(prediction.predictedDrawProbability * 100).toFixed(1)}% / Away ${(prediction.predictedAwayWinProbability * 100).toFixed(1)}%\n` +
        `  BTTS ${(prediction.predictedBttsProbability * 100).toFixed(1)}%`
    );
  } catch (error) {
    console.error("predict failed:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
