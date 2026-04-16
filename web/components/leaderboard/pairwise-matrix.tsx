"use client";

import { useState } from "react";
import type { PairwiseData, ModelMetaMap } from "@/lib/types";

interface Props {
  pairwise: PairwiseData;
  modelMeta: ModelMetaMap;
}

function winRateColor(rate: number | null): string {
  if (rate === null) return "transparent";
  // Diverging scale: red (0) → neutral (0.5) → green (1)
  if (rate >= 0.5) {
    const t = (rate - 0.5) * 2; // 0..1
    const g = Math.round(50 + t * 130);
    const r = Math.round(180 - t * 140);
    return `rgba(${r}, ${g}, 60, 0.55)`;
  } else {
    const t = rate * 2; // 0..1
    const r = Math.round(220 - t * 40);
    const g = Math.round(60 + t * 120);
    return `rgba(${r}, ${g}, 60, 0.55)`;
  }
}

export function PairwiseMatrix({ pairwise, modelMeta }: Props) {
  const { models, matrix, counts } = pairwise;
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  // Get short names for display
  const shortNames = models.map((m) => modelMeta[m]?.short_name ?? m.split("-")[0]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-bg-elevated py-2 px-2 text-left text-[10px] font-medium uppercase tracking-wider text-fg-dim">
              vs
            </th>
            {shortNames.map((name, j) => (
              <th
                key={j}
                className="py-2 px-1 text-center text-[10px] font-medium text-fg-dim"
                style={{ minWidth: 52 }}
              >
                <span className="block truncate max-w-[52px]" title={models[j]}>
                  {name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {models.map((model, i) => (
            <tr key={model}>
              <td className="sticky left-0 z-10 bg-bg-elevated py-1.5 px-2 text-[11px] font-medium text-fg-muted whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: modelMeta[model]?.color ?? "var(--fg-dim)" }}
                  />
                  {shortNames[i]}
                </div>
              </td>
              {matrix[i].map((rate, j) => {
                const isHovered = hoveredCell?.row === i && hoveredCell?.col === j;
                const isDiag = i === j;
                const count = counts[i][j];

                return (
                  <td
                    key={j}
                    className={`relative py-1.5 px-1 text-center font-mono transition-all ${
                      isDiag
                        ? "bg-border-subtle/30"
                        : isHovered
                        ? "ring-2 ring-accent ring-inset"
                        : ""
                    }`}
                    style={{
                      backgroundColor: isDiag ? undefined : winRateColor(rate),
                    }}
                    onMouseEnter={() => !isDiag && setHoveredCell({ row: i, col: j })}
                    onMouseLeave={() => setHoveredCell(null)}
                    title={
                      isDiag
                        ? ""
                        : rate !== null
                        ? `${shortNames[i]} vs ${shortNames[j]} · ${count} matches · ${(rate * 100).toFixed(0)}% win rate`
                        : `${shortNames[i]} vs ${shortNames[j]} · 0 matches`
                    }
                  >
                    {isDiag ? (
                      <span className="text-fg-disabled">—</span>
                    ) : rate !== null ? (
                      <span className={`text-[11px] font-medium ${
                        rate >= 0.6 ? "text-fg" : rate <= 0.4 ? "text-fg" : "text-fg-muted"
                      }`}>
                        {(rate * 100).toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-fg-disabled">—</span>
                    )}
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
