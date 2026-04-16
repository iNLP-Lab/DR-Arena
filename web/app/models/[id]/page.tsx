import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { FailureRadar } from "@/components/charts/failure-radar";
import { H2HBars } from "@/components/charts/h2h-bars";
import { getBattles, getFailureProfiles, getLeaderboard, getModelMeta } from "@/lib/data";
import { formatFailureType, getBattleOutcome, getPrimaryFailureType, modelToSlug, slugToModel } from "@/lib/models";

export function generateStaticParams() {
  return getLeaderboard().map((entry) => ({ id: modelToSlug(entry.model) }));
}

export const dynamicParams = false;

type RouteParams = {
  id: string;
};

function resolveModel(slug: string) {
  const leaderboard = getLeaderboard();
  const model = slugToModel(leaderboard.map((entry) => entry.model), slug);

  if (!model) return null;

  const modelMeta = getModelMeta();
  const battles = getBattles();
  const failureProfiles = getFailureProfiles();
  const entry = leaderboard.find((item) => item.model === model);

  if (!entry) return null;

  const modelBattles = battles.filter((battle) => battle.model_a === model || battle.model_b === model);
  const profile = failureProfiles.models[model];
  const recentBattles = [...modelBattles].reverse().slice(0, 8);
  const winRate = entry.matches > 0 ? (entry.wins / entry.matches) * 100 : 0;

  const opponentMap = new Map<string, { matches: number; wins: number; losses: number; ties: number }>();
  for (const battle of modelBattles) {
    const opponent = battle.model_a === model ? battle.model_b : battle.model_a;
    const stats = opponentMap.get(opponent) ?? { matches: 0, wins: 0, losses: 0, ties: 0 };
    stats.matches += 1;

    const outcome = getBattleOutcome(model, battle);
    if (outcome === "W") stats.wins += 1;
    if (outcome === "L") stats.losses += 1;
    if (outcome === "T") stats.ties += 1;

    opponentMap.set(opponent, stats);
  }

  const opponentRows = [...opponentMap.entries()].map(([opponent, stats]) => ({
    opponent,
    ...stats,
    winRate: stats.matches > 0 ? stats.wins / stats.matches : 0,
  }));

  const strongestMatchup = [...opponentRows]
    .sort((a, b) => (b.winRate - a.winRate) || (b.matches - a.matches))[0] ?? null;
  const toughestMatchup = [...opponentRows]
    .sort((a, b) => (a.winRate - b.winRate) || (b.matches - a.matches))[0] ?? null;

  return {
    leaderboard,
    model,
    entry,
    modelMeta,
    meta: modelMeta[model],
    battles,
    recentBattles,
    failureProfiles,
    profile,
    strongestMatchup,
    toughestMatchup,
    winRate,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { id } = await params;
  const resolved = resolveModel(id);

  if (!resolved) {
    return {
      title: "Model not found",
    };
  }

  const name = resolved.meta?.short_name ?? resolved.model;
  return {
    title: `${name} · Models`,
    description: `Deep-dive profile for ${name}: final Elo, judged answer profile, head-to-head record, and recent Deep Research Arena battles.`,
  };
}

export default async function ModelDetailPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { id } = await params;
  const resolved = resolveModel(id);

  if (!resolved) {
    notFound();
  }

  const {
    leaderboard,
    model,
    entry,
    modelMeta,
    meta,
    battles,
    recentBattles,
    failureProfiles,
    profile,
    strongestMatchup,
    toughestMatchup,
    winRate,
  } = resolved;

  const totalMatches = Math.round(leaderboard.reduce((sum, item) => sum + item.matches, 0) / 2);
  const primaryFailure = formatFailureType(getPrimaryFailureType(profile));

  function modelMetaLabel(targetModel: string) {
    return modelMeta[targetModel]?.short_name ?? targetModel;
  }

  return (
    <div className="relative w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-12 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[440px] w-[520px] rounded-full blur-[150px]"
        style={{ backgroundColor: meta?.color ?? "rgba(212, 160, 74, 0.12)", opacity: 0.14 }}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/models"
          className="inline-flex items-center gap-2 text-fg-muted transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to models
        </Link>
        <span className="text-fg-dim">/</span>
        <Link
          href="/leaderboard"
          className="text-fg-muted transition-colors hover:text-accent"
        >
          Leaderboard
        </Link>
      </div>

      <section className="rounded-[30px] border border-border bg-bg-elevated/78 px-6 py-8 shadow-[0_18px_60px_-28px_rgba(31,26,23,0.18)] backdrop-blur-sm md:px-8 md:py-10">
        <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: meta?.color ?? "var(--accent)" }}
              />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim">
                Seeded model profile
              </span>
            </div>
            <h1 className="font-display mt-4 text-3xl leading-[0.96] tracking-tight md:text-[3.6rem]">
              {meta?.short_name ?? model}
            </h1>
            <p className="mt-3 text-sm text-fg-muted md:text-base">
              {meta?.provider} · Rank #{entry.rank} out of {leaderboard.length} models · official final Elo profile
              from {totalMatches} tournament matches.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted">
              This page combines final leaderboard strength, judged answer breakdowns, head-to-head outcomes, and
              recent battles for one deep research agent. It uses the stable post-tournament data path only.
            </p>
          </div>

          <Link
            href="/leaderboard"
            className="inline-flex h-11 items-center gap-2 self-start rounded-xl border border-border-strong bg-bg/65 px-5 text-sm font-medium text-fg transition-colors hover:border-accent/30 hover:text-accent"
          >
            Compare on leaderboard
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border-subtle bg-bg/52 px-4 py-4">
            <div className="font-mono text-2xl font-bold tabular" data-numeric>{entry.elo.toFixed(1)}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Final Elo</div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-bg/52 px-4 py-4">
            <div className="font-mono text-2xl font-bold tabular" data-numeric>{winRate.toFixed(1)}%</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Win Rate</div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-bg/52 px-4 py-4">
            <div className="font-mono text-2xl font-bold tabular" data-numeric>{entry.matches}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Matches Played</div>
          </div>
          <div className="rounded-2xl border border-border-subtle bg-bg/52 px-4 py-4">
            <div className="text-base font-semibold text-fg">{primaryFailure}</div>
            <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Primary answer breakdown</div>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="rounded-[26px] border border-border bg-bg-elevated/74 p-5 shadow-[0_14px_42px_-26px_rgba(31,26,23,0.16)] backdrop-blur-sm md:p-6">
            <div className="mb-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim">Answer Failure Profile</h2>
              <p className="mt-1 text-sm text-fg-muted">
                Judged answer breakdowns from tournament rounds. These are rubric failures, not runtime or system failures.
              </p>
            </div>
            <FailureRadar
              profile={profile}
              populationAverage={failureProfiles.population_average}
              color={meta?.color}
            />
          </div>

          <div className="rounded-[26px] border border-border bg-bg-elevated/74 p-5 shadow-[0_14px_42px_-26px_rgba(31,26,23,0.16)] backdrop-blur-sm md:p-6">
            <div className="mb-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim">Head-to-Head Map</h2>
              <p className="mt-1 text-sm text-fg-muted">
                Observed outcomes versus every opponent in the field, sorted by match volume.
              </p>
            </div>
            <H2HBars model={model} battles={battles} modelMeta={modelMeta} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="rounded-[26px] border border-border bg-bg-elevated/74 p-5 shadow-[0_14px_42px_-26px_rgba(31,26,23,0.16)] backdrop-blur-sm md:p-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim">At a Glance</h2>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-border-subtle bg-bg/48 px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Record</div>
                <div className="mt-1 font-mono text-sm text-fg" data-numeric>
                  {entry.wins}W / {entry.losses}L / {entry.ties}T
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-bg/48 px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Strongest matchup</div>
                <div className="mt-1 text-sm text-fg">
                  {strongestMatchup ? `${modelMetaLabel(strongestMatchup.opponent)} · ${(strongestMatchup.winRate * 100).toFixed(0)}% win rate` : "Not enough data"}
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-bg/48 px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Toughest matchup</div>
                <div className="mt-1 text-sm text-fg">
                  {toughestMatchup ? `${modelMetaLabel(toughestMatchup.opponent)} · ${(toughestMatchup.winRate * 100).toFixed(0)}% win rate` : "Not enough data"}
                </div>
              </div>
              <div className="rounded-2xl border border-border-subtle bg-bg/48 px-4 py-3">
                <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Judged samples</div>
                <div className="mt-1 font-mono text-sm text-fg" data-numeric>{profile?.total ?? 0}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-border bg-bg-elevated/74 p-5 shadow-[0_14px_42px_-26px_rgba(31,26,23,0.16)] backdrop-blur-sm md:p-6">
            <div className="mb-4">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim">Recent Battles</h2>
              <p className="mt-1 text-sm text-fg-muted">
                Latest tournament matches involving this model. Open replay when a canonical matched log is available.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              {recentBattles.map((battle) => {
                const opponent = battle.model_a === model ? battle.model_b : battle.model_a;
                const outcome = getBattleOutcome(model, battle);
                const myScore = battle.model_a === model ? battle.score_a : battle.score_b;
                const opponentScore = battle.model_a === model ? battle.score_b : battle.score_a;
                const outcomeClass = outcome === "W"
                  ? "text-verdict-much-better"
                  : outcome === "L"
                    ? "text-verdict-failure"
                    : "text-verdict-tie";

                const row = (
                  <div className="flex items-start gap-3">
                    <span className={`font-mono text-sm font-bold ${outcomeClass}`}>{outcome}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{modelMetaLabel(opponent)}</div>
                      <div className="mt-1 text-xs text-fg-dim">
                        {battle.tree_id} · {battle.rounds} round{battle.rounds === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-fg-dim">{myScore}-{opponentScore}</span>
                      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-fg-dim">
                        {battle.replay_id ? "Replay" : "Summary"}
                      </span>
                    </div>
                  </div>
                );

                return battle.replay_id ? (
                  <Link
                    key={battle.id}
                    href={`/battles/${battle.replay_id}`}
                    className="row-ledger rounded-2xl border border-border-subtle bg-bg/35 px-4 py-3 transition-colors hover:border-accent/20 hover:bg-accent/[0.04]"
                  >
                    {row}
                  </Link>
                ) : (
                  <div
                    key={battle.id}
                    className="row-ledger rounded-2xl border border-border-subtle bg-bg/35 px-4 py-3"
                  >
                    {row}
                  </div>
                );
              })}
              {recentBattles.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border-subtle bg-bg/45 px-4 py-6 text-sm text-fg-muted">
                  No battles found for this model in the current tournament snapshot.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
