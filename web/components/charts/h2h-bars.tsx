"use client";

import type { Battle, ModelMetaMap } from "@/lib/types";

interface Props {
  model: string;
  battles: Battle[];
  modelMeta: ModelMetaMap;
}

interface OpponentRecord {
  opponent: string;
  wins: number;
  losses: number;
  ties: number;
  total: number;
}

export function H2HBars({ model, battles, modelMeta }: Props) {
  // Compute head-to-head records
  const records = new Map<string, OpponentRecord>();

  for (const b of battles) {
    if (b.model_a !== model && b.model_b !== model) continue;
    const opponent = b.model_a === model ? b.model_b : b.model_a;

    if (!records.has(opponent)) {
      records.set(opponent, { opponent, wins: 0, losses: 0, ties: 0, total: 0 });
    }
    const r = records.get(opponent)!;
    r.total++;
    if (b.winner === model) r.wins++;
    else if (b.winner === null) r.ties++;
    else r.losses++;
  }

  const sorted = [...records.values()].sort((a, b) => b.total - a.total);
  if (sorted.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((r) => {
        const meta = modelMeta[r.opponent];
        const winPct = r.total > 0 ? (r.wins / r.total) * 100 : 0;
        const tiePct = r.total > 0 ? (r.ties / r.total) * 100 : 0;
        const lossPct = r.total > 0 ? (r.losses / r.total) * 100 : 0;

        return (
          <div key={r.opponent} className="row-ledger flex items-center gap-3 rounded-2xl px-2 py-1.5">
            {/* Opponent name */}
            <div className="flex w-28 shrink-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: meta?.color ?? "var(--fg-dim)" }}
              />
              <span className="truncate text-[11px] text-fg-muted" title={r.opponent}>
                {meta?.short_name ?? r.opponent}
              </span>
            </div>

            {/* Stacked bar */}
            <div className="flex h-4 flex-1 overflow-hidden rounded-full bg-border-subtle/35">
              {winPct > 0 && (
                <div
                  className="h-full bg-verdict-much-better/70 transition-all"
                  style={{ width: `${winPct}%` }}
                  title={`${r.wins} wins`}
                />
              )}
              {tiePct > 0 && (
                <div
                  className="h-full bg-verdict-tie/50 transition-all"
                  style={{ width: `${tiePct}%` }}
                  title={`${r.ties} ties`}
                />
              )}
              {lossPct > 0 && (
                <div
                  className="h-full bg-verdict-failure/60 transition-all"
                  style={{ width: `${lossPct}%` }}
                  title={`${r.losses} losses`}
                />
              )}
            </div>

            {/* Record */}
            <span className="w-16 shrink-0 text-right font-mono text-[10px] text-fg-dim" data-numeric>
              {r.wins}W {r.losses}L{r.ties > 0 ? ` ${r.ties}T` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
