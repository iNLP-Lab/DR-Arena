"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import type { BattleIndexEntry, FailureType, ModelMetaMap } from "@/lib/types";
import { formatVerdictTag, verdictTone } from "@/lib/models";

interface Props {
  entries: BattleIndexEntry[];
  modelMeta: ModelMetaMap;
}

function hasKnownVerdict(verdict: string | null | undefined): boolean {
  return Boolean(verdict && verdict !== "UNKNOWN");
}

function toneClasses(tone: ReturnType<typeof verdictTone>): string {
  switch (tone) {
    case "strong":
      return "border-verdict-much-better/20 bg-verdict-much-better/10 text-verdict-much-better";
    case "mid":
      return "border-verdict-better/20 bg-verdict-better/10 text-verdict-better";
    case "tie":
      return "border-verdict-tie/20 bg-verdict-tie/10 text-verdict-tie";
    default:
      return "border-border-subtle bg-bg/50 text-fg-muted";
  }
}

function roundLabel(entry: BattleIndexEntry): string {
  if (entry.type === "onboarding") {
    return `Onboarding · R${entry.round ?? entry.tournament_round ?? "?"}`;
  }
  if (entry.tournament_round) {
    return `Round ${entry.tournament_round}`;
  }
  return "Tournament";
}

function failureLabel(tag: FailureType | null | undefined): string {
  switch (tag) {
    case "DEEP":
      return "Deep";
    case "WIDE":
      return "Wide";
    case "BOTH":
      return "Both";
    case "NONE":
      return "None";
    default:
      return "—";
  }
}

function failureTone(tag: FailureType | null | undefined): string {
  switch (tag) {
    case "DEEP":
      return "bg-tag-deep/12 text-tag-deep border-tag-deep/20";
    case "WIDE":
      return "bg-tag-wide/12 text-tag-wide border-tag-wide/20";
    case "BOTH":
      return "bg-tag-both/12 text-tag-both border-tag-both/20";
    case "NONE":
      return "bg-tag-none/12 text-tag-none border-tag-none/20";
    default:
      return "bg-bg/50 text-fg-dim border-border-subtle";
  }
}

function roundStateColor(verdict: string | null | undefined): string {
  if (verdict?.startsWith("A_")) return "bg-data-1/80";
  if (verdict?.startsWith("B_")) return "bg-data-2/80";
  if (verdict === "Tie") return "bg-verdict-tie/70";
  return "bg-border";
}

export function BattleBrowser({ entries, modelMeta }: Props) {
  const [modelFilter, setModelFilter] = useState("all");
  const [treeFilter, setTreeFilter] = useState("all");
  const [verdictFilter, setVerdictFilter] = useState("all");
  const [failureFilter, setFailureFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("replay");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const modelOptions = useMemo(() => (
    [...new Set(entries.flatMap((entry) => [entry.model_a, entry.model_b]))]
      .sort((a, b) => a.localeCompare(b))
  ), [entries]);
  const treeOptions = useMemo(() => (
    [...new Set(entries.map((entry) => entry.tree_id))].sort()
  ), [entries]);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (modelFilter !== "all" && entry.model_a !== modelFilter && entry.model_b !== modelFilter) {
        return false;
      }
      if (treeFilter !== "all" && entry.tree_id !== treeFilter) {
        return false;
      }
      const finalVerdict = hasKnownVerdict(entry.final_verdict) ? entry.final_verdict : "summary";
      if (verdictFilter !== "all" && finalVerdict !== verdictFilter) {
        return false;
      }
      if (failureFilter !== "all" && (entry.final_failure_type ?? "none") !== failureFilter) {
        return false;
      }
      if (stageFilter === "replay" && !entry.replay_available) {
        return false;
      }
      if (stageFilter === "onboarding" && entry.type !== "onboarding") {
        return false;
      }
      if (stageFilter === "tournament" && entry.type === "onboarding") {
        return false;
      }
      if (!deferredSearch) {
        return true;
      }
      const haystack = [
        entry.model_a,
        entry.model_b,
        entry.tree_id,
        entry.tree_title,
        entry.question_preview ?? "",
        ...entry.questions,
      ].join(" ").toLowerCase();
      return haystack.includes(deferredSearch);
    });
  }, [
    deferredSearch,
    entries,
    failureFilter,
    modelFilter,
    stageFilter,
    treeFilter,
    verdictFilter,
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="surface-ledger rounded-[28px] px-5 py-5 md:px-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="flex flex-col gap-1.5">
            <span className="app-kicker">Search</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Question, model, or tree"
              className="h-11 rounded-xl border border-border-subtle bg-bg/60 px-3 text-sm text-fg outline-none transition-colors focus:border-accent/30"
            />
          </label>

          <FilterSelect label="Model" value={modelFilter} onChange={setModelFilter}>
            <option value="all">All models</option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {modelMeta[model]?.short_name ?? model}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Tree" value={treeFilter} onChange={setTreeFilter}>
            <option value="all">All trees</option>
            {treeOptions.map((treeId) => (
              <option key={treeId} value={treeId}>
                {treeId}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Verdict" value={verdictFilter} onChange={setVerdictFilter}>
            <option value="all">All verdicts</option>
            <option value="A_MUCH_BETTER">A much better</option>
            <option value="A_BETTER">A better</option>
            <option value="B_BETTER">B better</option>
            <option value="B_MUCH_BETTER">B much better</option>
            <option value="Tie">Tie</option>
            <option value="summary">Summary only</option>
          </FilterSelect>

          <FilterSelect label="Failure" value={failureFilter} onChange={setFailureFilter}>
            <option value="all">All tags</option>
            <option value="DEEP">Deep</option>
            <option value="WIDE">Wide</option>
            <option value="BOTH">Both</option>
            <option value="NONE">None</option>
          </FilterSelect>

          <FilterSelect label="Stage" value={stageFilter} onChange={setStageFilter}>
            <option value="all">All battles</option>
            <option value="replay">Replay available</option>
            <option value="tournament">Tournament only</option>
            <option value="onboarding">Onboarding only</option>
          </FilterSelect>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-muted">
          {filtered.length} battles shown. Replay pages are available for matched official logs only.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-2">
        {filtered.map((entry) => {
          const modelALabel = modelMeta[entry.model_a]?.short_name ?? entry.model_a;
          const modelBLabel = modelMeta[entry.model_b]?.short_name ?? entry.model_b;
          const winnerLabel = entry.winner ? (modelMeta[entry.winner]?.short_name ?? entry.winner) : "Tie";
          const finalVerdict = hasKnownVerdict(entry.final_verdict) ? entry.final_verdict : null;
          const verdictText = finalVerdict ? `${winnerLabel} · ${formatVerdictTag(finalVerdict)}` : (entry.winner ? `${winnerLabel} wins` : "Summary only");

          return (
            <article
              key={entry.id}
              className="rounded-[28px] border border-border bg-bg-elevated/72 p-5 shadow-[0_16px_48px_-28px_rgba(31,26,23,0.18)] backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="app-kicker">{roundLabel(entry)}</div>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-fg">
                    {modelALabel} vs {modelBLabel}
                  </h2>
                  <p className="mt-1 text-sm text-fg-muted">
                    {entry.tree_id} · {entry.tree_title}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(verdictTone(finalVerdict))}`}>
                    {verdictText}
                  </div>
                  <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${failureTone(entry.final_failure_type)}`}>
                    {failureLabel(entry.final_failure_type)}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-end gap-1 rounded-2xl border border-border-subtle bg-bg/40 px-3 py-3">
                  {entry.round_states.length > 0 ? entry.round_states.map((state) => {
                    const height = 18 + ((state.depth ?? 1) * 8) + ((state.width ?? 1) * 5);
                    return (
                      <div key={state.round} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className={`w-full max-w-10 rounded-t-md ${roundStateColor(state.verdict)}`}
                          style={{ height }}
                        />
                        <span className="font-mono text-[10px] text-fg-dim">{state.round}</span>
                      </div>
                    );
                  }) : (
                    <div className="py-3 text-sm text-fg-dim">No round timeline available.</div>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCell label="Rounds" value={String(entry.rounds)} />
                <StatCell label="Questions" value={String(entry.questions.length || entry.rounds)} />
                <StatCell label="Tokens" value={entry.total_tokens ? formatCompact(entry.total_tokens) : "—"} />
                <StatCell label="Cost" value={entry.estimated_cost ? `$${entry.estimated_cost.toFixed(2)}` : "—"} />
              </div>

              {entry.question_preview && (
                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-fg-muted">
                  {entry.question_preview}
                </p>
              )}

              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-fg-dim">
                  {entry.replay_available ? "Replay ready" : "Summary only"}
                </span>
                {entry.replay_available && entry.replay_id ? (
                  <Link
                    href={`/battles/${entry.replay_id}`}
                    className="text-sm font-medium text-accent transition-colors hover:text-accent-hover"
                  >
                    Open replay &rarr;
                  </Link>
                ) : (
                  <span className="text-sm font-medium text-fg-dim">No replay match</span>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg/45 px-3 py-3">
      <div className="font-mono text-sm font-semibold text-fg" data-numeric>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">{label}</div>
    </div>
  );
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: React.ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="app-kicker">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-xl border border-border-subtle bg-bg/60 px-3 text-sm text-fg outline-none transition-colors focus:border-accent/30"
      >
        {children}
      </select>
    </label>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return String(value);
}
