import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getBattles, getFailureProfiles, getLeaderboard, getModelMeta } from "@/lib/data";
import { formatFailureType, getBattleOutcome, getPrimaryFailureType, modelToSlug } from "@/lib/models";

export const metadata = {
  title: "Models",
  description: "Seeded model profiles for every deep research agent in the Deep Research Arena leaderboard.",
};

export default function ModelsPage() {
  const leaderboard = getLeaderboard();
  const modelMeta = getModelMeta();
  const battles = getBattles();
  const failureProfiles = getFailureProfiles();
  const totalMatches = Math.round(leaderboard.reduce((sum, entry) => sum + entry.matches, 0) / 2);
  const topModel = leaderboard[0];

  const cards = leaderboard.map((entry) => {
    const meta = modelMeta[entry.model];
    const profile = failureProfiles.models[entry.model];
    const latestBattle = [...battles].reverse().find((battle) => (
      battle.model_a === entry.model || battle.model_b === entry.model
    ));
    const latestOutcome = latestBattle ? getBattleOutcome(entry.model, latestBattle) : null;
    const primaryFailure = formatFailureType(getPrimaryFailureType(profile));
    const winRate = entry.matches > 0 ? (entry.wins / entry.matches) * 100 : 0;

    return {
      entry,
      meta,
      primaryFailure,
      latestBattle,
      latestOutcome,
      winRate,
      slug: modelToSlug(entry.model),
    };
  });

  return (
    <div className="relative w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-12 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[860px] -translate-x-1/2 rounded-full bg-accent/[0.06] blur-[140px]"
      />

      <section className="mb-8 rounded-[28px] border border-border bg-bg-elevated/70 px-6 py-8 backdrop-blur-sm md:px-8 md:py-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="app-kicker text-accent">Seeded model profiles</div>
            <h1 className="font-display mt-5 text-3xl leading-[0.96] tracking-tight md:text-[3.6rem]">
              Every contender, one click away.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-fg-muted md:text-base">
              Browse the full Deep Research Arena field by rank, provider, answer-failure profile, and recent form.
              Each card opens a model deep-dive built from the same final Elo, head-to-head, and judged answer data
              used on the leaderboard.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border-subtle bg-bg/60 px-4 py-3">
              <div className="font-mono text-2xl font-semibold tabular" data-numeric>{leaderboard.length}</div>
              <div className="app-kicker mt-1">Models</div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-bg/60 px-4 py-3">
              <div className="font-mono text-2xl font-semibold tabular" data-numeric>{totalMatches}</div>
              <div className="app-kicker mt-1">Matches</div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-bg/60 px-4 py-3">
              <div className="font-mono text-2xl font-semibold tabular" data-numeric>{topModel?.elo.toFixed(0)}</div>
              <div className="app-kicker mt-1">Top Elo</div>
            </div>
            <div className="rounded-2xl border border-border-subtle bg-bg/60 px-4 py-3">
              <div className="font-mono text-2xl font-semibold tabular" data-numeric>{failureProfiles.coverage.attributed_events}</div>
              <div className="app-kicker mt-1">Judged Events</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(({ entry, meta, primaryFailure, latestBattle, latestOutcome, winRate, slug }) => {
          const medalTone = entry.rank <= 3 ? "border-accent/30 bg-accent/[0.05]" : "border-border bg-bg-elevated/60";

          return (
            <Link
              key={entry.model}
              href={`/models/${slug}`}
              className={`card-hover group rounded-[24px] border px-5 py-5 backdrop-blur-sm ${medalTone}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta?.color ?? "var(--fg-dim)" }}
                    />
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-fg-dim">
                      Rank #{entry.rank}
                    </span>
                  </div>
                  <h2 className="mt-3 truncate text-lg font-semibold text-fg">{meta?.short_name ?? entry.model}</h2>
                  <p className="mt-1 text-sm text-fg-muted">{meta?.provider}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-fg-dim transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-border-subtle bg-bg/65 px-3 py-3">
                  <div className="font-mono text-xl font-bold tabular" data-numeric>{entry.elo.toFixed(1)}</div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Final Elo</div>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-bg/65 px-3 py-3">
                  <div className="font-mono text-xl font-bold tabular" data-numeric>{winRate.toFixed(1)}%</div>
                  <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Win Rate</div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex h-2 overflow-hidden rounded-full bg-border-subtle">
                  <div
                    className="h-full bg-verdict-much-better"
                    style={{ width: `${entry.matches > 0 ? (entry.wins / entry.matches) * 100 : 0}%` }}
                  />
                  <div
                    className="h-full bg-verdict-tie"
                    style={{ width: `${entry.matches > 0 ? (entry.ties / entry.matches) * 100 : 0}%` }}
                  />
                  <div
                    className="h-full bg-verdict-failure"
                    style={{ width: `${entry.matches > 0 ? (entry.losses / entry.matches) * 100 : 0}%` }}
                  />
                </div>
                <p className="mt-2 font-mono text-xs text-fg-dim" data-numeric>
                  {entry.wins}W / {entry.losses}L / {entry.ties}T across {entry.matches} matches
                </p>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border-subtle/80 bg-bg/55 px-3 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Primary answer breakdown</div>
                  <div className="mt-1 text-sm font-medium text-fg">{primaryFailure}</div>
                </div>
                <div className="rounded-2xl border border-border-subtle/80 bg-bg/55 px-3 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">Latest result</div>
                  <div className="mt-1 text-sm font-medium text-fg">
                    {latestBattle ? `${latestOutcome} on ${latestBattle.tree_id}` : "No recent battle"}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
