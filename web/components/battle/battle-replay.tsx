"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BattleReplay, ModelMetaMap } from "@/lib/types";
import { formatVerdictTag, verdictTone } from "@/lib/models";

interface Props {
  replay: BattleReplay;
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
      return "border-border-subtle bg-bg/40 text-fg-muted";
  }
}

function failureTone(tag: string | null | undefined): string {
  switch (tag) {
    case "DEEP":
      return "border-tag-deep/20 bg-tag-deep/12 text-tag-deep";
    case "WIDE":
      return "border-tag-wide/20 bg-tag-wide/12 text-tag-wide";
    case "BOTH":
      return "border-tag-both/20 bg-tag-both/12 text-tag-both";
    case "NONE":
      return "border-tag-none/20 bg-tag-none/12 text-tag-none";
    default:
      return "border-border-subtle bg-bg/40 text-fg-dim";
  }
}

function formatSeconds(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}s`;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

function normalizeStructuredText(value: string): string {
  return value
    .replace(/\s+:\s+/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLogicChainPart(value: string): string {
  return normalizeStructuredText(value);
}

function formatEvolutionLine(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || /^[=~-]{8,}$/.test(trimmed)) {
    return null;
  }

  return normalizeStructuredText(
    trimmed
      .replace(/^>>>?\s*/, "")
      .replace(/\s*<<<$/, "")
      .replace(/^\[EVOLUTION\]\s*/i, "")
      .replace(/^->\s*/, "")
  );
}

function isSparseRound(round: BattleReplay["rounds"][number]): boolean {
  return (
    !hasText(round.question) &&
    !hasText(round.answer_a) &&
    !hasText(round.answer_b) &&
    !hasText(round.judge_reasoning) &&
    round.score_a === null &&
    round.score_b === null
  );
}

export function BattleReplayView({ replay, modelMeta }: Props) {
  const [roundIndex, setRoundIndex] = useState(0);
  const currentRound = replay.rounds[roundIndex];
  const sparseRound = isSparseRound(currentRound);
  const finalVerdict = hasKnownVerdict(replay.final_verdict) ? replay.final_verdict : null;
  const currentVerdict = hasKnownVerdict(currentRound.verdict) ? currentRound.verdict : null;
  const modelALabel = modelMeta[replay.model_a]?.short_name ?? replay.model_a;
  const modelBLabel = modelMeta[replay.model_b]?.short_name ?? replay.model_b;
  const winnerLabel = replay.winner ? (modelMeta[replay.winner]?.short_name ?? replay.winner) : "Tie";

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "j") {
        setRoundIndex((value) => Math.min(value + 1, replay.rounds.length - 1));
      }
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "k") {
        setRoundIndex((value) => Math.max(value - 1, 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [replay.rounds.length]);

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-[30px] border border-border bg-bg-elevated/76 px-6 py-6 shadow-[0_18px_60px_-30px_rgba(31,26,23,0.18)] backdrop-blur-sm md:px-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="app-kicker">Battle replay</div>
            <h1 className="font-display mt-4 text-3xl leading-[0.96] tracking-tight md:text-[3.6rem]">
              {modelALabel} vs {modelBLabel}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-fg-muted md:text-base">
              {replay.tree_id} · {replay.tree_title}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {finalVerdict && (
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(verdictTone(finalVerdict))}`}>
                {winnerLabel} · {formatVerdictTag(finalVerdict)}
              </div>
            )}
            {replay.final_failure_type && (
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${failureTone(replay.final_failure_type)}`}>
                {replay.final_failure_type}
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Rounds" value={String(replay.total_rounds)} />
          <Metric label="Final Score" value={`${replay.final_score_a ?? "—"} - ${replay.final_score_b ?? "—"}`} />
          <Metric label="Tokens" value={replay.total_tokens ? replay.total_tokens.toLocaleString() : "—"} />
          <Metric label="Cost" value={replay.estimated_cost ? `$${replay.estimated_cost.toFixed(2)}` : "—"} />
          <Metric label="Mode" value={replay.type === "onboarding" ? `Onboarding R${replay.tournament_round ?? "?"}` : `Round ${replay.tournament_round ?? "?"}`} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <Link href="/battles" className="text-accent transition-colors hover:text-accent-hover">
            &larr; Back to battles
          </Link>
          {replay.tree_url && (
            <>
              <span className="text-fg-dim">·</span>
              <a
                href={replay.tree_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fg-muted transition-colors hover:text-fg"
              >
                View source page
              </a>
            </>
          )}
          <span className="text-fg-dim">·</span>
          <span className="min-w-0 break-words text-fg-muted [overflow-wrap:anywhere]">{replay.source_log}</span>
        </div>
      </section>

      <section className="overflow-hidden rounded-[28px] border border-border bg-bg-elevated/72 p-5 shadow-[0_14px_42px_-28px_rgba(31,26,23,0.16)] backdrop-blur-sm md:p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="app-kicker">Timeline</h2>
            <p className="mt-1 text-sm text-fg-muted">Arrow keys or j/k move between rounds.</p>
          </div>
          <div className="text-sm text-fg-dim">
            Round {currentRound.round} of {replay.total_rounds}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {replay.rounds.map((round, index) => {
            const active = index === roundIndex;
            const height = 24 + ((round.depth ?? 1) * 7) + ((round.width ?? 1) * 5);
            return (
              <button
                key={round.round}
                type="button"
                onClick={() => setRoundIndex(index)}
                className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                  active
                    ? "border-accent/30 bg-accent/[0.08]"
                    : "border-border-subtle bg-bg/42 hover:border-accent/20 hover:bg-accent/[0.04]"
                }`}
              >
                <div className="flex items-end gap-2">
                  <div
                    className={`w-4 rounded-md ${
                      hasKnownVerdict(round.verdict) && round.verdict?.startsWith("A_")
                        ? "bg-data-1"
                        : hasKnownVerdict(round.verdict) && round.verdict?.startsWith("B_")
                          ? "bg-data-2"
                          : round.verdict === "Tie"
                            ? "bg-verdict-tie"
                            : "bg-border"
                    }`}
                    style={{ height }}
                  />
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-fg-dim">R{round.round}</div>
                    {!isSparseRound(round) && hasKnownVerdict(round.verdict) && (
                      <div className="mt-1 break-words text-sm font-medium text-fg [overflow-wrap:anywhere]">
                        {formatVerdictTag(round.verdict)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-fg-dim">
                  D{round.depth ?? "—"} · W{round.width ?? "—"}
                </div>
                {round.evolution.summary && (
                  <div className="mt-1 break-words text-[11px] text-fg-muted [overflow-wrap:anywhere]">
                    {round.evolution.summary}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="overflow-hidden rounded-[26px] border border-border bg-bg-elevated/72 p-5 shadow-[0_14px_42px_-28px_rgba(31,26,23,0.16)] backdrop-blur-sm md:p-6">
            <h2 className="app-kicker">Round Context</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill label={`Depth ${currentRound.depth ?? "—"}`} />
              <Pill label={`Width ${currentRound.width ?? "—"}`} />
              {currentRound.evolution.summary && <Pill label={currentRound.evolution.summary} />}
            </div>

            {currentRound.logic_chain.length > 0 && (
              <div className="mt-5">
                <div className="app-kicker">Logic Chain</div>
                <div className="mt-3 flex flex-col gap-2">
                  {currentRound.logic_chain.map((part, index) => (
                    <div
                      key={`${index}-${part}`}
                      className="grid grid-cols-[auto_1fr] items-start gap-3 rounded-2xl border border-border-subtle bg-bg/40 px-3 py-3"
                    >
                      <span className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-fg-dim">
                        {index === 0 ? "Root" : `Step ${index + 1}`}
                      </span>
                      <p className="min-w-0 break-words text-sm leading-relaxed text-fg-muted">
                        {formatLogicChainPart(part)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasText(currentRound.question) && (
              <div className="mt-5">
                <div className="app-kicker">Question</div>
                <p className="font-display mt-3 break-words text-2xl leading-[1.15] text-fg [overflow-wrap:anywhere]">
                  {currentRound.question}
                </p>
                {currentRound.word_limit_instruction && (
                  <p className="mt-3 break-words text-sm text-fg-muted [overflow-wrap:anywhere]">
                    {currentRound.word_limit_instruction}
                  </p>
                )}
              </div>
            )}

            {(currentRound.checklist_depth.length > 0 || currentRound.checklist_width.length > 0) && (
              <details className="mt-5 rounded-2xl border border-border-subtle bg-bg/38 p-4">
                <summary className="cursor-pointer text-sm font-medium text-fg">Show hidden checklists</summary>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Checklist title="Depth checklist" items={currentRound.checklist_depth} />
                  <Checklist title="Width checklist" items={currentRound.checklist_width} />
                </div>
              </details>
            )}

            {currentRound.rationale && (
              <div className="mt-5 rounded-2xl border border-border-subtle bg-bg/38 p-4">
                <div className="app-kicker">Examiner rationale</div>
                <p className="mt-2 break-words text-sm leading-relaxed text-fg-muted [overflow-wrap:anywhere]">
                  {currentRound.rationale}
                </p>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-[26px] border border-border bg-bg-elevated/72 p-5 shadow-[0_14px_42px_-28px_rgba(31,26,23,0.16)] backdrop-blur-sm md:p-6">
            <h2 className="app-kicker">Judgment</h2>
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {!sparseRound && currentVerdict && (
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(verdictTone(currentVerdict))}`}>
                  {formatVerdictTag(currentVerdict)}
                </div>
              )}
              {currentRound.failure_type && (
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${failureTone(currentRound.failure_type)}`}>
                  {currentRound.failure_type}
                </div>
              )}
              {currentRound.score_a !== null && currentRound.score_b !== null && (
                <div className="font-mono text-xs text-fg-dim">
                  Score {currentRound.score_a} - {currentRound.score_b}
                </div>
              )}
            </div>
            {currentRound.judge_reasoning && (
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg-muted [overflow-wrap:anywhere]">
                {currentRound.judge_reasoning}
              </p>
            )}
            {sparseRound && (
              <div className="mt-4 rounded-2xl border border-border-subtle bg-bg/38 px-4 py-4 text-sm leading-relaxed text-fg-muted">
                This round ended before a full replay record was written to the source log.
              </div>
            )}
            {currentRound.evolution.lines.length > 0 && (
              <div className="mt-4 rounded-2xl border border-border-subtle bg-bg/38 p-4">
                <div className="app-kicker">Evolution step</div>
                <div className="mt-3 space-y-2">
                  {currentRound.evolution.lines
                    .map(formatEvolutionLine)
                    .filter((line): line is string => Boolean(line))
                    .map((line, index) => (
                      <div
                        key={`${index}-${line}`}
                        className="break-words rounded-xl border border-border-subtle/80 bg-bg/40 px-3 py-2 text-sm leading-relaxed text-fg-muted"
                      >
                        {line}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {(hasText(currentRound.answer_a) || hasText(currentRound.answer_b)) && (
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            {hasText(currentRound.answer_a) && (
              <AnswerPanel
                title={modelALabel}
                provider={modelMeta[replay.model_a]?.provider ?? replay.model_a}
                color={modelMeta[replay.model_a]?.color}
                duration={currentRound.duration_a_seconds}
                answer={currentRound.answer_a}
              />
            )}
            {hasText(currentRound.answer_b) && (
              <AnswerPanel
                title={modelBLabel}
                provider={modelMeta[replay.model_b]?.provider ?? replay.model_b}
                color={modelMeta[replay.model_b]?.color}
                duration={currentRound.duration_b_seconds}
                answer={currentRound.answer_b}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg/48 px-4 py-4">
      <div className="break-words font-mono text-lg font-semibold text-fg [overflow-wrap:anywhere]" data-numeric>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-fg-dim">{label}</div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <span className="max-w-full break-words rounded-full border border-border-subtle bg-bg/42 px-3 py-1.5 text-xs text-fg-muted [overflow-wrap:anywhere]">
      {label}
    </span>
  );
}

function Checklist({ items, title }: { items: string[]; title: string }) {
  return (
    <div>
      <div className="app-kicker">{title}</div>
      <ul className="mt-2 flex flex-col gap-2">
        {items.length > 0 ? items.map((item) => (
          <li key={item} className="break-words rounded-xl border border-border-subtle bg-bg/42 px-3 py-2 text-sm text-fg-muted [overflow-wrap:anywhere]">
            {item}
          </li>
        )) : (
          <li className="text-sm text-fg-dim">No checklist items recorded.</li>
        )}
      </ul>
    </div>
  );
}

function AnswerPanel({
  title,
  provider,
  color,
  duration,
  answer,
}: {
  title: string;
  provider: string;
  color?: string;
  duration: number | null;
  answer: string;
}) {
  return (
    <div className="overflow-hidden rounded-[26px] border border-border bg-bg-elevated/72 p-5 shadow-[0_14px_42px_-28px_rgba(31,26,23,0.16)] backdrop-blur-sm md:p-6">
      <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color ?? "var(--fg-dim)" }} />
            <h2 className="min-w-0 break-words text-lg font-semibold tracking-tight text-fg [overflow-wrap:anywhere]">{title}</h2>
          </div>
          <p className="mt-1 break-words text-sm text-fg-dim [overflow-wrap:anywhere]">{provider}</p>
        </div>
        <div className="font-mono text-xs text-fg-dim">{formatSeconds(duration)}</div>
      </div>

      <div className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-fg [overflow-wrap:anywhere]">{answer}</div>
    </div>
  );
}
