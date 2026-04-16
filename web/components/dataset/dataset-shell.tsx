"use client";

import { useState, useMemo } from "react";
import type { TreeMetadataEntry, TopologyNode, Battle, DatasetSummary } from "@/lib/types";
import { DistributionCharts } from "./distribution-charts";
import { TreeCard } from "./tree-card";

interface Props {
  trees: TreeMetadataEntry[];
  topologyMap: Record<string, TopologyNode>;
  battleCounts: Record<string, number>;
  summary: DatasetSummary;
}

function groupTopics(treesByTopic: Record<string, number>): { category: string; count: number }[] {
  const groups: Record<string, number> = {};
  for (const [topic, count] of Object.entries(treesByTopic)) {
    const cat = topic.split(">")[0].trim();
    groups[cat] = (groups[cat] ?? 0) + count;
  }
  return Object.entries(groups)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

function domainCounts(trees: TreeMetadataEntry[]): { domain: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const t of trees) {
    counts[t.domain] = (counts[t.domain] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function depthHistogram(trees: TreeMetadataEntry[]): { depth: string; nodes: number }[] {
  const agg: Record<string, number> = {};
  for (const t of trees) {
    for (const [d, n] of Object.entries(t.stats.nodes_by_depth)) {
      agg[d] = (agg[d] ?? 0) + n;
    }
  }
  return Object.entries(agg)
    .map(([depth, nodes]) => ({ depth, nodes }))
    .sort((a, b) => Number(a.depth) - Number(b.depth));
}

export function DatasetShell({ trees, topologyMap, battleCounts, summary }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const topicData = useMemo(() => groupTopics(summary.trees_by_topic), [summary]);
  const domainData = useMemo(() => domainCounts(trees), [trees]);
  const depthData = useMemo(() => depthHistogram(trees), [trees]);

  const filtered = useMemo(() => {
    let result = trees;

    if (activeCategory) {
      result = result.filter((t) => t.topic.split(">")[0].trim() === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.root_url.toLowerCase().includes(q) ||
          t.domain.toLowerCase().includes(q) ||
          t.topic.toLowerCase().includes(q) ||
          t.tree_id.toLowerCase().includes(q)
      );
    }

    return result;
  }, [trees, activeCategory, searchQuery]);

  const totalNodes = trees.reduce((s, t) => s + t.stats.total_nodes, 0);

  return (
    <div className="flex flex-col gap-8">
      {/* Distribution charts */}
      <DistributionCharts
        topicData={topicData}
        domainData={domainData}
        depthData={depthData}
        onTopicClick={setActiveCategory}
        activeCategory={activeCategory}
      />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search trees…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 rounded-xl border border-border bg-bg-elevated/50 px-4 text-sm text-fg placeholder:text-fg-disabled focus:border-accent-2/40 focus:outline-none focus:ring-2 focus:ring-accent-2/20 w-64"
        />

        {activeCategory && (
          <button
            onClick={() => setActiveCategory(null)}
            className="flex items-center gap-1.5 rounded-full border border-accent-2/25 bg-accent-2/[0.06] px-3 py-1.5 text-[11px] font-medium text-accent-2 transition-colors hover:bg-accent-2/[0.12]"
          >
            {activeCategory}
            <span className="text-accent-2/60">&times;</span>
          </button>
        )}

        <span className="ml-auto text-xs text-fg-dim">
          {filtered.length} tree{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== trees.length ? ` of ${trees.length}` : ""}
          {" · "}
          <span className="font-mono" data-numeric>{totalNodes.toLocaleString()}</span> nodes
        </span>
      </div>

      {/* Tree card grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((meta) => (
          <TreeCard
            key={meta.tree_id}
            meta={meta}
            topology={topologyMap[meta.tree_id] ?? null}
            battleCount={battleCounts[meta.tree_id] ?? 0}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center text-sm text-fg-dim">
          No trees match your filters.
        </div>
      )}
    </div>
  );
}
