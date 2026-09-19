"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";

export interface ModelAccuracyDatum {
  modelId: string;
  resultAccuracy: number;
  matches: number;
}

// Categorical slots from the dataviz reference palette, fixed order — one hue
// per model, never reassigned by rank. Read as CSS custom properties so light/
// dark mode swap automatically (see src/app/globals.css).
const SERIES_COLORS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-3)", "var(--chart-series-4)"];

type MaybeNumeric = string | number | boolean | null | undefined;

interface BarLabelProps {
  x?: MaybeNumeric;
  y?: MaybeNumeric;
  width?: MaybeNumeric;
  value?: MaybeNumeric;
  index?: number;
}

function renderBarLabel(props: BarLabelProps, data: ModelAccuracyDatum[]) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const value = Number(props.value ?? 0);
  const datum = data[props.index ?? 0];
  return (
    <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={12} fill="var(--chart-ink-primary)">
      {value.toFixed(0)}%{datum ? ` (n=${datum.matches})` : ""}
    </text>
  );
}

/**
 * One bar per prediction model's result accuracy. Direct-labeled with both
 * the percentage and its real sample size — with 1-4 matches per model right
 * now, hiding n would misrepresent how little evidence backs these numbers.
 * Axis category labels already name each model, so no separate legend box
 * is needed (dataviz skill: a single measure split by category, not a
 * multi-series chart).
 */
export function ModelAccuracyChart({ data }: { data: ModelAccuracyDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 24, right: 16, left: 0, bottom: 8 }} barCategoryGap="24%">
        <XAxis
          dataKey="modelId"
          tick={{ fill: "var(--chart-ink-secondary)", fontSize: 12 }}
          axisLine={{ stroke: "var(--chart-baseline)" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "var(--chart-ink-muted)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={32}
        />
        <Bar dataKey="resultAccuracy" radius={[4, 4, 0, 0]} maxBarSize={64}>
          {data.map((entry, index) => (
            <Cell key={entry.modelId} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
          ))}
          <LabelList dataKey="resultAccuracy" content={(props) => renderBarLabel(props, data)} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
