"use client";

import { useState } from "react";
import Link from "next/link";
import type { TreeMetadataEntry, TopologyNode, Battle, ModelMetaMap } from "@/lib/types";
import { TreeTopology } from "./tree-topology";

interface Props {
  treeMeta: TreeMetadataEntry;
  topology: TopologyNode;
  battles: Battle[];
  modelMeta: ModelMetaMap;
}

function topicTag(topic: string): string {
  return topic.split(">")[0].trim();
}

export function TreeDetailShell({ treeMeta, topology, battles, modelMeta }: Props) {
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(topology);
  const s = treeMeta.stats;

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-fg-dim">
          <Link href="/dataset" className="transition-colors hover:text-accent-2">
            Dataset
          </Link>
          <span className="text-border-strong">/</span>
          <span className="text-fg-muted">{treeMeta.tree_id}</span>
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <span className="self-start rounded-full border border-accent-2/20 bg-accent-2/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-2">
              {topicTag(treeMeta.topic)}
            </span>
            <h1 className="app-title mt-3 break-words">
              {treeMeta.root_url.replace(/^https?:\/\//, "").split("/").slice(0, 2).join("/")}
            </h1>
            <p className="mt-2 text-sm text-fg-muted">
              {treeMeta.topic} &middot; Crawled{" "}
              {new Date(treeMeta.crawled_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Stats strip */}
          <div className="grid grid-cols-4 gap-x-5 border-l-0 border-border-subtle pl-0 lg:border-l lg:pl-6">
            <div>
              <div className="font-mono text-xl font-semibold tabular" data-numeric>
                {s.total_nodes}
              </div>
              <div className="app-kicker mt-0.5">Nodes</div>
            </div>
            <div>
              <div className="font-mono text-xl font-semibold tabular" data-numeric>
                D{s.max_depth}
              </div>
              <div className="app-kicker mt-0.5">Depth</div>
            </div>
            <div>
              <div className="font-mono text-xl font-semibold tabular" data-numeric>
                W{s.avg_width.toFixed(0)}
              </div>
              <div className="app-kicker mt-0.5">Avg width</div>
            </div>
            <div>
              <div className="font-mono text-xl font-semibold tabular" data-numeric>
                {battles.length}
              </div>
              <div className="app-kicker mt-0.5">Battles</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive topology */}
      <TreeTopology data={topology} onNodeSelect={setSelectedNode} />

      {/* Node inspector + tree info */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Selected node info */}
        <div className="rounded-[20px] border border-border bg-bg-elevated/60 p-5 lg:col-span-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
            Selected node
          </div>
          {selectedNode ? (
              <div className="mt-3 flex flex-col gap-2">
                <div className="text-sm font-medium text-fg line-clamp-2">
                  {selectedNode.title || "Untitled"}
                </div>
                <a
                  href={selectedNode.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block break-all text-xs leading-relaxed text-accent-2 transition-colors hover:text-accent"
                >
                  {selectedNode.url}
                </a>
              <div className="flex flex-wrap gap-2 text-[11px] text-fg-muted">
                <span className="rounded-md bg-bg-raised/60 px-2 py-0.5">
                  Depth {selectedNode.depth}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 ${
                    selectedNode.crawled
                      ? "bg-accent-2/[0.08] text-accent-2"
                      : "bg-verdict-failure/[0.08] text-verdict-failure"
                  }`}
                >
                  {selectedNode.crawled ? "Crawled" : selectedNode.error || "Failed"}
                </span>
                {selectedNode.rc && (
                  <span className="rounded-md bg-accent/[0.08] px-2 py-0.5 text-accent">
                    {selectedNode.rc}
                  </span>
                )}
                {(selectedNode.children?.length ?? 0) > 0 && (
                  <span className="rounded-md bg-bg-raised/60 px-2 py-0.5">
                    {selectedNode.children!.length} children
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-fg-dim">
              Open a branch in the map to inspect one page in detail.
            </p>
          )}

          {/* Tree metadata */}
          <div className="mt-5 border-t border-border-subtle/50 pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
              Source
            </div>
            <div className="mt-2 flex flex-col gap-1.5 text-xs text-fg-muted">
              <div>
                <span className="text-fg-dim">Domain:</span>{" "}
                <span className="text-fg">{treeMeta.domain}</span>
              </div>
              <div>
                <span className="text-fg-dim">Query:</span>{" "}
                <span className="text-fg">{treeMeta.search_query}</span>
              </div>
              <div>
                <span className="text-fg-dim">Crawled:</span>{" "}
                <span className="font-mono" data-numeric>
                  {s.crawled_nodes}
                </span>{" "}
                / {s.total_nodes} nodes
                {s.failed_nodes > 0 && (
                  <span className="ml-1 text-verdict-failure">
                    ({s.failed_nodes} failed)
                  </span>
                )}
              </div>
            </div>
            <a
              href={treeMeta.root_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 rounded-lg border border-border bg-bg-raised/50 px-3 py-1.5 text-[11px] font-medium text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg"
            >
              Visit source
              <svg
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Depth distribution */}
        <div className="rounded-[20px] border border-border bg-bg-elevated/60 p-5 lg:col-span-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
            Depth distribution
          </div>
          <div className="mt-3 flex flex-col gap-1">
            {Object.entries(s.nodes_by_depth)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([depth, count]) => {
                const pct = s.total_nodes > 0 ? (count / s.total_nodes) * 100 : 0;
                return (
                  <div key={depth} className="flex items-center gap-2">
                    <span className="w-8 text-right font-mono text-[10px] text-fg-dim" data-numeric>
                      D{depth}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-bg-raised/60 h-2.5">
                      <div
                        className="h-full rounded-full bg-accent-2/60 transition-all"
                        style={{ width: `${Math.max(pct, 1)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-[10px] text-fg-muted" data-numeric>
                      {count}
                    </span>
                  </div>
                );
              })}
          </div>

          {/* Width stats */}
          <div className="mt-5 border-t border-border-subtle/50 pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
              Width by depth
            </div>
            <div className="mt-2 flex flex-col gap-0.5 text-[10px]">
              <div className="flex items-center gap-3 text-fg-dim">
                <span className="w-8" />
                <span className="w-10 text-right">Min</span>
                <span className="w-10 text-right">Max</span>
              </div>
              {Object.entries(s.max_width_at_depth)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([depth]) => (
                  <div key={depth} className="flex items-center gap-3 text-fg-muted">
                    <span className="w-8 text-right font-mono text-fg-dim" data-numeric>
                      D{depth}
                    </span>
                    <span className="w-10 text-right font-mono" data-numeric>
                      {s.min_width_at_depth[depth] ?? "–"}
                    </span>
                    <span className="w-10 text-right font-mono" data-numeric>
                      {s.max_width_at_depth[depth] ?? "–"}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Battles on this tree */}
        <div className="rounded-[20px] border border-border bg-bg-elevated/60 p-5 lg:col-span-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
            Battles ({battles.length})
          </div>
          {battles.length > 0 ? (
            <div className="mt-3 flex max-h-[340px] flex-col gap-1.5 overflow-y-auto scrollbar-thin">
              {battles.map((b) => {
                const colorA = modelMeta[b.model_a]?.color ?? "var(--fg-muted)";
                const colorB = modelMeta[b.model_b]?.color ?? "var(--fg-muted)";
                const shortA = modelMeta[b.model_a]?.short_name ?? b.model_a.slice(0, 12);
                const shortB = modelMeta[b.model_b]?.short_name ?? b.model_b.slice(0, 12);
                const isTie = b.winner === null;

                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 rounded-lg bg-bg-raised/40 px-3 py-2 text-[11px]"
                  >
                    <span
                      className={`font-medium ${b.winner === b.model_a ? "text-fg" : "text-fg-muted"}`}
                      style={b.winner === b.model_a ? { color: colorA } : undefined}
                    >
                      {shortA}
                    </span>
                    <span className="font-mono text-fg-dim" data-numeric>
                      {b.score_a}–{b.score_b}
                    </span>
                    <span
                      className={`font-medium ${b.winner === b.model_b ? "text-fg" : "text-fg-muted"}`}
                      style={b.winner === b.model_b ? { color: colorB } : undefined}
                    >
                      {shortB}
                    </span>
                    {isTie && (
                      <span className="ml-auto rounded-full bg-border-subtle/40 px-1.5 py-0.5 text-[9px] font-medium text-fg-dim">
                        TIE
                      </span>
                    )}
                    <span className="ml-auto font-mono text-[10px] text-fg-disabled" data-numeric>
                      R{b.rounds}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-fg-dim">
              No battles have been played on this tree yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
