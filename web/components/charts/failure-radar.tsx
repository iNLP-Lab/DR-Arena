"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { FailureProfileEntry, FailureProfiles } from "@/lib/types";

interface Props {
  profile: FailureProfileEntry | undefined;
  populationAverage: FailureProfiles["population_average"];
  color?: string;
  height?: number;
}

const AXIS_META = [
  { key: "DEEP", label: "Deep", description: "Deep reasoning failure" },
  { key: "WIDE", label: "Wide", description: "Wide coverage failure" },
  { key: "BOTH", label: "Both", description: "Failed both deep reasoning and wide coverage" },
  { key: "NONE", label: "None", description: "No hard failure; lost on softer quality factors" },
] as const;

export function FailureRadar({ profile, populationAverage, color = "var(--accent)", height = 220 }: Props) {
  if (!profile || profile.total < 3) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg/28 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
          Answer Failure Profile
        </div>
        <p className="mt-2 text-xs leading-relaxed text-fg-muted">
          Not enough judged rounds yet to show a stable answer-failure pattern.
          This metric refers to judged answer breakdowns, not system failures.
        </p>
      </div>
    );
  }

  const data = AXIS_META.map(({ key, label, description }) => ({
    axis: label,
    description: description ?? label,
    model: profile.distribution[key] * 100,
    average: populationAverage[key] * 100,
    count: profile.counts[key],
  }));

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg/28 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
            Answer Failure Profile
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
            Judge-diagnosed answer breakdown on lost or low-quality tied rounds. Not system failures.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-border-subtle bg-bg/42 px-2.5 py-1.5 text-right">
          <div className="font-mono text-sm font-semibold text-fg" data-numeric>{profile.total}</div>
          <div className="text-[10px] uppercase tracking-wider text-fg-dim">Samples</div>
        </div>
      </div>

      <div
        className="mt-3 h-[240px] outline-none [&_*]:outline-none"
        onMouseDown={(event) => event.preventDefault()}
      >
        <ResponsiveContainer width="100%" height={height} minWidth={1} minHeight={1}>
          <RadarChart data={data} outerRadius="64%">
            <PolarGrid stroke="var(--border-subtle)" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fontSize: 10, fill: "var(--fg-dim)" }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null;
                const datum = payload[0].payload as typeof data[number];
                return (
                  <div className="rounded-lg border border-border bg-bg-elevated p-3 text-xs shadow-lg">
                    <div className="font-medium text-fg">{datum.axis}</div>
                    <div className="mt-1 text-[11px] text-fg-dim">{datum.description}</div>
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-fg-muted">Model</span>
                        <span className="ml-auto font-mono text-fg">{datum.model.toFixed(0)}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-fg-dim/70" />
                        <span className="text-fg-muted">Population</span>
                        <span className="ml-auto font-mono text-fg">{datum.average.toFixed(0)}%</span>
                      </div>
                      <div className="mt-1 text-[11px] text-fg-dim">
                        Counted rounds: <span className="font-mono" data-numeric>{datum.count}</span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            <Radar
              name="Population"
              dataKey="average"
              stroke="var(--fg-dim)"
              fill="var(--fg-dim)"
              fillOpacity={0.12}
              strokeOpacity={0.8}
            />
            <Radar
              name="Model"
              dataKey="model"
              stroke={color}
              fill={color}
              fillOpacity={0.28}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-center gap-4 text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          Model
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-fg-dim/70" />
          Population Avg
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-fg-muted">
        <div><span className="font-medium text-fg">Deep:</span> deep reasoning failure</div>
        <div><span className="font-medium text-fg">Wide:</span> wide coverage failure</div>
        <div><span className="font-medium text-fg">Both:</span> failed both dimensions</div>
        <div><span className="font-medium text-fg">None:</span> no hard failure, softer quality loss</div>
      </div>
    </div>
  );
}
