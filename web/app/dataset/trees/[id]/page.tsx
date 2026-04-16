import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { getMetadata, getBattles, getModelMeta } from "@/lib/data";
import type { TopologyNode } from "@/lib/types";
import { computeTopologyStats } from "@/lib/topology-stats";
import { TreeDetailShell } from "@/components/dataset/tree-detail-shell";

export const dynamicParams = false;

export function generateStaticParams() {
  const dir = join(process.cwd(), "public", "data", "trees");
  const meta = getMetadata();
  const topoFiles = new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
  );
  return meta.trees
    .filter((t) => topoFiles.has(t.tree_id))
    .map((t) => ({ id: t.tree_id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meta = getMetadata();
  const tree = meta.trees.find((t) => t.tree_id === id);
  const title = tree
    ? `${tree.domain} — ${tree.topic.split(">")[0].trim()}`
    : id;
  return {
    title: `Tree ${id}`,
    description: `Interactive topology viewer for ${title}`,
  };
}

export default async function TreeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meta = getMetadata();
  const rawTreeMeta = meta.trees.find((t) => t.tree_id === id)!;
  const modelMeta = getModelMeta();

  // Load topology
  const topoPath = join(process.cwd(), "public", "data", "trees", `${id}.json`);
  const topology = JSON.parse(readFileSync(topoPath, "utf-8")) as TopologyNode;

  // Override stale metadata stats with ground-truth from topology
  const treeMeta = { ...rawTreeMeta, stats: computeTopologyStats(topology) };

  // Battles on this tree
  const allBattles = getBattles();
  const treeBattles = allBattles.filter((b) => b.tree_id === id);

  return (
    <div className="relative w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-12 lg:px-12">
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 -z-10 h-[420px] w-[520px] rounded-full bg-accent-2/[0.05] blur-[140px]"
      />

      <TreeDetailShell
        treeMeta={treeMeta}
        topology={topology}
        battles={treeBattles}
        modelMeta={modelMeta}
      />
    </div>
  );
}
