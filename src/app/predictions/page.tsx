import Link from "next/link";
import { listPredictionModels } from "@/lib/predictions";
import { DEFAULT_PREDICTION_MODEL } from "@/lib/config";
import { getLatestPredictionsForMatches, getUpcomingMatchesAcrossLeagues } from "@/services/queries";
import { ScorelineHeatmap } from "@/components/charts/scoreline-heatmap";

export const dynamic = "force-dynamic";

function formatKickoff(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    date
  );
}

function percent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

export default async function PredictionsPage(props: PageProps<"/predictions">) {
  const searchParams = await props.searchParams;
  const models = listPredictionModels();
  const requestedModel = typeof searchParams.model === "string" ? searchParams.model : undefined;
  const modelId = models.some((m) => m.id === requestedModel) ? requestedModel! : DEFAULT_PREDICTION_MODEL;

  const upcoming = await getUpcomingMatchesAcrossLeagues(7);
  const predictionsByMatch = await getLatestPredictionsForMatches(
    upcoming.map((m) => m.id),
    modelId
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Predictions</h1>
      <p className="mt-3 max-w-xl text-sm text-black/60 dark:text-white/60">
        Upcoming matches over the next 7 days. Predictions are generated ahead of time via{" "}
        <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">npm run predict</code> — a match with none
        yet shows an honest empty state, not a guess.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {models.map((m) => (
          <Link
            key={m.id}
            href={`/predictions?model=${m.id}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              m.id === modelId
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-black/10 text-black/60 hover:text-black dark:border-white/10 dark:text-white/60 dark:hover:text-white"
            }`}
          >
            {m.id}
          </Link>
        ))}
      </div>
      <Link href="/predictions/performance" className="mt-4 inline-block text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
        View model performance &rarr;
      </Link>

      {upcoming.length === 0 ? (
        <p className="mt-10 text-sm text-black/50 dark:text-white/50">No upcoming fixtures synced for the next 7 days.</p>
      ) : (
        <ul className="mt-10 space-y-6">
          {upcoming.map((match) => {
            const prediction = predictionsByMatch.get(match.id);
            return (
              <li key={match.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">
                      {match.homeTeam.name} vs {match.awayTeam.name}
                    </p>
                    <p className="mt-0.5 text-xs text-black/50 dark:text-white/50">
                      {formatKickoff(match.scheduledAt)} · {match.competition.name}
                    </p>
                  </div>
                  <Link href={`/matches/${match.id}`} className="shrink-0 text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
                    Match detail &rarr;
                  </Link>
                </div>

                {!prediction ? (
                  <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
                    No prediction generated yet for the {modelId} model.
                  </p>
                ) : prediction.predictedHomeGoals === 0 && prediction.predictedAwayGoals === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-black/15 px-4 py-4 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
                    At least one of these teams has no finished matches synced yet — every model needs real prior
                    results to work from, so this comes back 0.00–0.00 rather than a meaningful prediction. This
                    resolves as more history is synced (<code className="rounded bg-black/5 px-1 dark:bg-white/10">npm run sync:fixtures</code>),
                    not by switching models.
                  </p>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="text-sm">
                      <p className="tabular-nums text-base font-semibold">
                        {prediction.predictedHomeGoals.toFixed(2)} – {prediction.predictedAwayGoals.toFixed(2)}
                      </p>
                      <dl className="mt-2 space-y-1 text-black/60 dark:text-white/60">
                        <div className="flex justify-between">
                          <dt>Home win</dt>
                          <dd className="tabular-nums">{percent(prediction.predictedHomeWinProbability)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Draw</dt>
                          <dd className="tabular-nums">{percent(prediction.predictedDrawProbability)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>Away win</dt>
                          <dd className="tabular-nums">{percent(prediction.predictedAwayWinProbability)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt>BTTS</dt>
                          <dd className="tabular-nums">{percent(prediction.predictedBttsProbability)}</dd>
                        </div>
                      </dl>
                    </div>
                    <ScorelineHeatmap
                      predictedHomeGoals={prediction.predictedHomeGoals}
                      predictedAwayGoals={prediction.predictedAwayGoals}
                      homeTeamName={match.homeTeam.name}
                      awayTeamName={match.awayTeam.name}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
