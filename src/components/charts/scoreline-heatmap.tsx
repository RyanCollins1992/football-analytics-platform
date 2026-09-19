import { buildScorelineMatrix } from "@/lib/predictions/poisson";

const SEQUENTIAL_STEPS = [
  { bg: "var(--chart-seq-100)", text: "var(--chart-seq-100-text)" },
  { bg: "var(--chart-seq-200)", text: "var(--chart-seq-200-text)" },
  { bg: "var(--chart-seq-300)", text: "var(--chart-seq-300-text)" },
  { bg: "var(--chart-seq-400)", text: "var(--chart-seq-400-text)" },
  { bg: "var(--chart-seq-500)", text: "var(--chart-seq-500-text)" },
  { bg: "var(--chart-seq-600)", text: "var(--chart-seq-600-text)" },
  { bg: "var(--chart-seq-700)", text: "var(--chart-seq-700-text)" },
];

// A 6-wide grid (0-5 goals each way) reads more clearly than the full 0-6
// buildScorelineMatrix uses for prediction storage — this component calls
// the same pure function with its own maxGoals for display only.
const DISPLAY_MAX_GOALS = 5;

interface ScorelineHeatmapProps {
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  homeTeamName: string;
  awayTeamName: string;
}

/**
 * Exact-score probability grid (spec section 11) — recomputed live from the
 * stored (lambdaHome, lambdaAway) via the existing pure buildScorelineMatrix
 * (Phase 6), so every cell is a real number, not an approximation. Small
 * grid, so every cell gets a direct label rather than relying on color alone.
 */
export function ScorelineHeatmap({ predictedHomeGoals, predictedAwayGoals, homeTeamName, awayTeamName }: ScorelineHeatmapProps) {
  const { matrix } = buildScorelineMatrix(predictedHomeGoals, predictedAwayGoals, DISPLAY_MAX_GOALS);
  const maxProbability = Math.max(...matrix.flat());

  function stepFor(probability: number) {
    if (maxProbability === 0) return SEQUENTIAL_STEPS[0];
    const index = Math.min(SEQUENTIAL_STEPS.length - 1, Math.floor((probability / maxProbability) * SEQUENTIAL_STEPS.length));
    return SEQUENTIAL_STEPS[index];
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[2px] text-xs tabular-nums">
        <caption className="mb-2 text-left text-xs text-(--chart-ink-muted)">
          {homeTeamName} (rows) vs {awayTeamName} (columns) — probability of each exact scoreline
        </caption>
        <thead>
          <tr>
            <th className="w-8" />
            {matrix[0].map((_, awayGoals) => (
              <th key={awayGoals} className="w-9 pb-1 text-center font-normal text-(--chart-ink-muted)">
                {awayGoals}
                {awayGoals === DISPLAY_MAX_GOALS ? "+" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, homeGoals) => (
            <tr key={homeGoals}>
              <th className="pr-1 text-right font-normal text-(--chart-ink-muted)">
                {homeGoals}
                {homeGoals === DISPLAY_MAX_GOALS ? "+" : ""}
              </th>
              {row.map((probability, awayGoals) => {
                const step = stepFor(probability);
                return (
                  <td
                    key={awayGoals}
                    title={`${homeGoals}-${awayGoals}: ${(probability * 100).toFixed(1)}%`}
                    className="h-9 w-9 rounded-[4px] text-center"
                    style={{ backgroundColor: step.bg, color: step.text }}
                  >
                    {(probability * 100).toFixed(0)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
