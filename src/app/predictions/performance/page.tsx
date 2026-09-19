import Link from "next/link";
import { getModelPerformance } from "@/services/queries";
import { ModelAccuracyChart } from "@/components/charts/model-accuracy-chart";

export const dynamic = "force-dynamic";

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

export default async function ModelPerformancePage() {
  const rows = await getModelPerformance();
  const withMatches = rows.filter((r) => r.summary.matches > 0);

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/predictions" className="text-xs text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white">
        &larr; Predictions
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Model performance</h1>
      <p className="mt-3 max-w-xl text-sm text-black/60 dark:text-white/60">
        Generated from real stored predictions and their evaluated results — never hard-coded. Sample sizes are still
        small (single digits per model), so treat these as early, provisional figures, not settled conclusions.
      </p>

      {withMatches.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-black/15 px-4 py-6 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
          No evaluated predictions yet. Run <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">npm run predict</code>{" "}
          and <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">npm run evaluate</code>, or{" "}
          <code className="rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">npm run backtest</code>, to produce some.
        </p>
      ) : (
        <>
          <div className="mt-10">
            <ModelAccuracyChart
              data={withMatches.map((r) => ({ modelId: r.modelId, resultAccuracy: r.summary.resultAccuracy, matches: r.summary.matches }))}
            />
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-black/10 text-xs uppercase tracking-wide text-black/40 dark:border-white/10 dark:text-white/40">
                  <th className="py-2 font-medium">Model</th>
                  <th className="py-2 text-right font-medium">Matches</th>
                  <th className="py-2 text-right font-medium">Result acc.</th>
                  <th className="py-2 text-right font-medium">Exact score acc.</th>
                  <th className="py-2 text-right font-medium">Goal MAE</th>
                  <th className="py-2 text-right font-medium">BTTS acc.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10 dark:divide-white/10">
                {rows.map((row) => (
                  <tr key={row.modelId}>
                    <td className="py-2">{row.modelId}</td>
                    <td className="py-2 text-right tabular-nums">{row.summary.matches}</td>
                    <td className="py-2 text-right tabular-nums">{row.summary.matches ? pct(row.summary.resultAccuracy) : "—"}</td>
                    <td className="py-2 text-right tabular-nums">{row.summary.matches ? pct(row.summary.exactScoreAccuracy) : "—"}</td>
                    <td className="py-2 text-right tabular-nums">{row.summary.matches ? row.summary.goalMAE.toFixed(2) : "—"}</td>
                    <td className="py-2 text-right tabular-nums">{row.summary.matches ? pct(row.summary.bttsAccuracy) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
