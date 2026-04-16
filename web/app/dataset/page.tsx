import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getMetadata, getSummary, getBattles, getTopologyTreeIds } from "@/lib/data";
import type { TopologyNode, TreeStats } from "@/lib/types";
import { computeTopologyStats } from "@/lib/topology-stats";
import { DatasetShell } from "@/components/dataset/dataset-shell";

export const metadata = {
  title: "Dataset",
  description:
    "The information trees used in the Deep Research Arena benchmark — topology thumbnails, topic distribution, and depth statistics.",
};

function formatDatasetSnapshot(timestamp: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  }).format(new Date(timestamp));
}

function loadTopologyMap(ids?: Set<string>): Record<string, TopologyNode> {
  const dir = join(process.cwd(), "public", "data", "trees");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !ids || ids.has(f.replace(".json", "")));
  const map: Record<string, TopologyNode> = {};

  for (const file of files) {
    const id = file.replace(".json", "");
    const raw = readFileSync(join(dir, file), "utf-8");
    map[id] = JSON.parse(raw) as TopologyNode;
  }
  return map;
}

export default function DatasetPage() {
  const meta = getMetadata();
  const summary = getSummary();
  const battles = getBattles();
  const topologyIds = new Set(getTopologyTreeIds());
  const topologyMap = loadTopologyMap(topologyIds);
  const frozenAt = formatDatasetSnapshot(summary.dataset_info.updated_at);

  // Compute ground-truth stats from topology files
  const statsMap: Record<string, TreeStats> = {};
  for (const [id, topo] of Object.entries(topologyMap)) {
    statsMap[id] = computeTopologyStats(topo);
  }

  // Count battles per tree
  const battleCounts: Record<string, number> = {};
  for (const b of battles) {
    battleCounts[b.tree_id] = (battleCounts[b.tree_id] ?? 0) + 1;
  }

  // Only include trees that have topology files, override stale stats
  const treesWithTopology = meta.trees
    .filter((t) => topologyIds.has(t.tree_id))
    .map((t) => (statsMap[t.tree_id] ? { ...t, stats: statsMap[t.tree_id] } : t));

  const totalNodes = treesWithTopology.reduce((s, t) => s + t.stats.total_nodes, 0);

  return (
    <div className="relative w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-12 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[420px] w-[520px] rounded-full bg-accent-2/[0.05] blur-[140px]"
      />

      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="app-kicker">Information trees</div>
            <span className="inline-flex items-center rounded-full border border-border-strong bg-bg-elevated/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-fg">
              Dataset frozen
            </span>
          </div>
          <h1 className="app-title mt-3">Dataset Atlas</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted md:text-base">
            {treesWithTopology.length} pre-crawled information trees spanning {Object.keys(summary.trees_by_topic).length} topics.
            Each tree is a web-sourced knowledge structure used to generate adaptive research questions.
          </p>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-fg-dim md:text-sm">
            This dataset is kept as a fixed snapshot for browsing and benchmark context. No new trees will be added.
            Snapshot frozen on {frozenAt} SGT.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-4 border-l-0 border-border-subtle pl-0 lg:border-l lg:pl-8">
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{treesWithTopology.length}</div>
            <div className="app-kicker mt-1">Trees</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{totalNodes.toLocaleString()}</div>
            <div className="app-kicker mt-1">Nodes</div>
          </div>
          <div>
            <div className="font-mono text-2xl font-semibold tabular" data-numeric>{Object.keys(summary.trees_by_topic).length}</div>
            <div className="app-kicker mt-1">Topics</div>
          </div>
        </div>
      </div>

      <DatasetShell
        trees={treesWithTopology}
        topologyMap={topologyMap}
        battleCounts={battleCounts}
        summary={summary}
      />
    </div>
  );
}
