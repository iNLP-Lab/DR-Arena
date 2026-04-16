"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { LeaderboardEntry, ModelMetaMap } from "@/lib/types";
import { modelToSlug } from "@/lib/models";

type SortKey = "rank" | "elo" | "matches" | "wins" | "winRate";
type SortDir = "asc" | "desc";

interface Props {
  data: LeaderboardEntry[];
  modelMeta: ModelMetaMap;
  onSelectModel?: (model: string | null) => void;
  selectedModel?: string | null;
}

export function LeaderboardTable({ data, modelMeta, onSelectModel, selectedModel }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const rows = [...data];
    rows.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "rank":
          av = a.rank; bv = b.rank; break;
        case "elo":
          av = a.elo; bv = b.elo; break;
        case "matches":
          av = a.matches; bv = b.matches; break;
        case "wins":
          av = a.wins; bv = b.wins; break;
        case "winRate":
          av = a.matches > 0 ? a.wins / a.matches : 0;
          bv = b.matches > 0 ? b.wins / b.matches : 0;
          break;
        default:
          av = a.rank; bv = b.rank;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [data, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  function SortHeader({ label, sortKeyVal, className }: { label: string; sortKeyVal: SortKey; className?: string }) {
    const active = sortKey === sortKeyVal;
    const arrow = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    return (
      <th
        className={`cursor-pointer select-none py-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors hover:text-fg ${
          active ? "text-accent" : "text-fg-dim"
        } ${className ?? ""}`}
        onClick={() => handleSort(sortKeyVal)}
      >
        {label}{arrow}
      </th>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle">
            <SortHeader label="#" sortKeyVal="rank" className="w-12 pl-4 pr-2 text-left" />
            <th className="py-3 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">Model</th>
            <SortHeader label="Elo" sortKeyVal="elo" className="text-right" />
            <SortHeader label="Matches" sortKeyVal="matches" className="hidden text-right sm:table-cell" />
            <SortHeader label="Wins" sortKeyVal="wins" className="hidden text-right md:table-cell" />
            <th className="hidden py-3 px-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim lg:table-cell">L / T</th>
            <SortHeader label="Win %" sortKeyVal="winRate" className="pr-4 text-right" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => {
            const meta = modelMeta[entry.model];
            const winRate = entry.matches > 0
              ? ((entry.wins / entry.matches) * 100).toFixed(1)
              : "—";
            const isSelected = selectedModel === entry.model;
            const modelSlug = modelToSlug(entry.model);

            return (
              <tr
                key={entry.model}
                className={`row-ledger group cursor-pointer border-b border-border-subtle/60 last:border-0 ${
                  isSelected ? "bg-accent/[0.08]" : ""
                }`}
                onClick={() => onSelectModel?.(isSelected ? null : entry.model)}
              >
                <td className="py-4 pl-4 pr-2 font-mono text-xs text-fg-dim">
                  {String(entry.rank).padStart(2, "0")}
                </td>
                <td className="py-4 px-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: meta?.color ?? "var(--fg-dim)" }}
                    />
                    <div className="flex flex-col">
                      <Link
                        href={`/models/${modelSlug}`}
                        className="font-medium text-fg transition-colors hover:text-accent"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {meta?.short_name ?? entry.model}
                      </Link>
                      <span className="text-[11px] tracking-[0.03em] text-fg-dim">{meta?.provider}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-3 text-right font-mono text-base font-semibold tabular" data-numeric>
                  {entry.elo.toFixed(1)}
                </td>
                <td className="hidden py-4 px-3 text-right font-mono text-fg-muted sm:table-cell" data-numeric>
                  {entry.matches}
                </td>
                <td className="hidden py-4 px-3 text-right font-mono text-fg-muted md:table-cell" data-numeric>
                  <span className="text-verdict-much-better">{entry.wins}</span>
                </td>
                <td className="hidden py-4 px-3 text-right font-mono text-xs text-fg-dim lg:table-cell" data-numeric>
                  <span className="text-verdict-failure">{entry.losses}</span>
                  {" / "}
                  <span className="text-verdict-tie">{entry.ties}</span>
                </td>
                <td className="py-4 px-3 pr-4 text-right font-mono font-medium tabular" data-numeric>
                  {winRate}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
