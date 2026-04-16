"use client";

import Link from "next/link";
import type { LeaderboardEntry, ModelMetaMap, Battle, FailureProfiles } from "@/lib/types";
import { FailureRadar } from "@/components/charts/failure-radar";
import { H2HBars } from "@/components/charts/h2h-bars";
import { modelToSlug } from "@/lib/models";

interface Props {
  selectedModel: string | null;
  leaderboard: LeaderboardEntry[];
  modelMeta: ModelMetaMap;
  battles: Battle[];
  failureProfiles: FailureProfiles;
}

function ModelCard({
  entry,
  meta,
  recentBattles,
  allBattles,
  modelMeta,
  failureProfiles,
}: {
  entry: LeaderboardEntry;
  meta: { provider: string; color: string; short_name: string } | undefined;
  allBattles: Battle[];
  modelMeta: ModelMetaMap;
  recentBattles: Battle[];
  failureProfiles: FailureProfiles;
}) {
  const winRate = entry.matches > 0
    ? ((entry.wins / entry.matches) * 100).toFixed(1)
    : "0";
  const profile = failureProfiles.models[entry.model];

  return (
    <div className="flex flex-col gap-4">
      {/* Model header */}
      <div className="flex items-start gap-3 border-b border-border-subtle pb-4">
        <span
          className="mt-1 h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: meta?.color ?? "var(--fg-dim)" }}
        />
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-fg">{meta?.short_name ?? entry.model}</h3>
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-dim">{meta?.provider} &middot; Rank #{entry.rank}</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border-subtle bg-bg/35 p-3">
          <div className="font-mono text-xl font-bold tabular" data-numeric>{entry.elo.toFixed(1)}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Elo Rating</div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-bg/35 p-3">
          <div className="font-mono text-xl font-bold tabular" data-numeric>{winRate}%</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Win Rate</div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-bg/35 p-3">
          <div className="font-mono text-lg font-semibold tabular text-verdict-much-better" data-numeric>{entry.wins}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Wins</div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-bg/35 p-3">
          <div className="font-mono text-lg font-semibold tabular text-verdict-failure" data-numeric>{entry.losses}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Losses</div>
        </div>
      </div>

      {/* W/L bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-border-subtle">
        <div
          className="h-full bg-verdict-much-better transition-all"
          style={{ width: `${entry.matches > 0 ? (entry.wins / entry.matches) * 100 : 0}%` }}
        />
        <div
          className="h-full bg-verdict-tie transition-all"
          style={{ width: `${entry.matches > 0 ? (entry.ties / entry.matches) * 100 : 0}%` }}
        />
        <div
          className="h-full bg-verdict-failure transition-all"
          style={{ width: `${entry.matches > 0 ? (entry.losses / entry.matches) * 100 : 0}%` }}
        />
      </div>

      <FailureRadar
        profile={profile}
        populationAverage={failureProfiles.population_average}
        color={meta?.color}
      />

      {/* Head-to-head bars */}
      <div>
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">Head-to-Head</h4>
        <H2HBars model={entry.model} battles={allBattles} modelMeta={modelMeta} />
      </div>

      {/* Recent battles */}
      {recentBattles.length > 0 && (
        <div>
          <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">Recent Battles</h4>
          <div className="flex flex-col gap-1.5">
            {recentBattles.map((b) => {
              const isWinner = b.winner === entry.model;
              const isTie = b.winner === null;
              const opponent = b.model_a === entry.model ? b.model_b : b.model_a;
              const row = (
                <>
                  <span className={`font-mono font-bold ${
                    isTie ? "text-verdict-tie" : isWinner ? "text-verdict-much-better" : "text-verdict-failure"
                  }`}>
                    {isTie ? "T" : isWinner ? "W" : "L"}
                  </span>
                  <span className="text-fg-muted">vs</span>
                  <span className="truncate text-fg">{opponent}</span>
                  <span className="ml-auto text-fg-dim">{b.tree_id}</span>
                </>
              );

              return b.replay_id ? (
                <Link
                  key={b.id}
                  href={`/battles/${b.replay_id}`}
                  className="flex items-center gap-2 rounded-2xl border border-border-subtle/60 bg-bg/24 px-3 py-2 text-xs transition-colors hover:border-accent/20 hover:bg-accent/[0.04]"
                >
                  {row}
                </Link>
              ) : (
                <div
                  key={b.id}
                  className="flex items-center gap-2 rounded-2xl border border-border-subtle/60 bg-bg/24 px-3 py-2 text-xs"
                >
                  {row}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Link to full profile */}
      <Link
        href={`/models/${modelToSlug(entry.model)}`}
        className="mt-1 text-center text-xs font-medium uppercase tracking-[0.14em] text-accent transition-colors hover:text-accent-hover"
      >
        View full profile &rarr;
      </Link>
    </div>
  );
}

function OverviewPanel({ leaderboard, modelMeta }: { leaderboard: LeaderboardEntry[]; modelMeta: ModelMetaMap }) {
  const totalMatches = leaderboard.reduce((s, e) => s + e.matches, 0) / 2; // each match counted twice
  const topModel = leaderboard[0];
  const topMeta = modelMeta[topModel?.model ?? ""];
  const eloSpread = leaderboard.length > 1
    ? (leaderboard[0].elo - leaderboard[leaderboard.length - 1].elo).toFixed(0)
    : "0";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">Tournament Overview</h3>
      </div>

      <div className="rounded-2xl border border-accent/20 bg-accent/[0.04] p-4">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: topMeta?.color ?? "var(--accent)" }}
          />
          <span className="text-sm font-semibold text-fg">{topMeta?.short_name ?? topModel?.model}</span>
        </div>
        <div className="mt-1 font-mono text-2xl font-bold tabular" data-numeric>
          {topModel?.elo.toFixed(1)}
        </div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">#1 Elo Rating</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border-subtle bg-bg/35 p-3">
          <div className="font-mono text-lg font-semibold tabular" data-numeric>{leaderboard.length}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Models</div>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-bg/35 p-3">
          <div className="font-mono text-lg font-semibold tabular" data-numeric>{Math.round(totalMatches)}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Matches</div>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg/35 p-3">
        <div className="font-mono text-lg font-semibold tabular" data-numeric>{eloSpread}</div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Elo Spread (1st – Last)</div>
      </div>

      {/* Mini Elo bars */}
      <div>
        <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">Elo Distribution</h4>
        <div className="flex flex-col gap-1">
          {leaderboard.map((entry) => {
            const meta = modelMeta[entry.model];
            const minElo = leaderboard[leaderboard.length - 1].elo;
            const maxElo = leaderboard[0].elo;
            const range = maxElo - minElo || 1;
            const pct = ((entry.elo - minElo) / range) * 100;
            return (
              <div key={entry.model} className="flex items-center gap-2">
                <span className="w-16 truncate text-[10px] text-fg-dim" title={entry.model}>
                  {meta?.short_name ?? entry.model}
                </span>
                <div className="flex-1 h-3 rounded-sm bg-border-subtle/30 overflow-hidden">
                  <div
                    className="h-full rounded-sm transition-all"
                    style={{
                      width: `${Math.max(pct, 2)}%`,
                      backgroundColor: meta?.color ?? "var(--accent)",
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="w-12 text-right font-mono text-[10px] text-fg-dim" data-numeric>
                  {entry.elo.toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ModelInspector({ selectedModel, leaderboard, modelMeta, battles, failureProfiles }: Props) {
  if (selectedModel) {
    const entry = leaderboard.find((e) => e.model === selectedModel);
    if (!entry) return null;

    const meta = modelMeta[selectedModel];
    const recentBattles = battles
      .filter((b) => b.model_a === selectedModel || b.model_b === selectedModel)
      .slice(-5)
      .reverse();

    return (
      <ModelCard
        entry={entry}
        meta={meta}
        recentBattles={recentBattles}
        allBattles={battles}
        modelMeta={modelMeta}
        failureProfiles={failureProfiles}
      />
    );
  }

  return <OverviewPanel leaderboard={leaderboard} modelMeta={modelMeta} />;
}
