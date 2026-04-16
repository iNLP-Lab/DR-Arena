import type { TopologyNode, TreeStats } from "./types";

/**
 * Compute TreeStats from a TopologyNode tree (the ground-truth structure),
 * replacing the stale stats baked into metadata.json.
 */
export function computeTopologyStats(root: TopologyNode): TreeStats {
  const nodesByDepth: Record<string, number> = {};
  const minWidthAtDepth: Record<string, number> = {};
  const maxWidthAtDepth: Record<string, number> = {};
  let totalNodes = 0;
  let crawledNodes = 0;
  let failedNodes = 0;
  let maxDepth = 0;

  function traverse(node: TopologyNode, depth: number) {
    totalNodes++;
    if (depth > maxDepth) maxDepth = depth;

    if (node.crawled) crawledNodes++;
    else failedNodes++;

    const key = String(depth);
    nodesByDepth[key] = (nodesByDepth[key] ?? 0) + 1;

    const children = node.children ?? [];
    if (children.length > 0) {
      const w = children.length;
      const depthKey = String(depth);
      if (minWidthAtDepth[depthKey] === undefined) {
        minWidthAtDepth[depthKey] = w;
        maxWidthAtDepth[depthKey] = w;
      } else {
        if (w < minWidthAtDepth[depthKey]) minWidthAtDepth[depthKey] = w;
        if (w > maxWidthAtDepth[depthKey]) maxWidthAtDepth[depthKey] = w;
      }

      for (const child of children) {
        traverse(child, depth + 1);
      }
    }
  }

  traverse(root, 0);

  const depthCount = Object.keys(nodesByDepth).length;
  const avgWidth = depthCount > 0 ? totalNodes / depthCount : 0;

  return {
    max_depth: maxDepth,
    total_nodes: totalNodes,
    crawled_nodes: crawledNodes,
    failed_nodes: failedNodes,
    nodes_by_depth: nodesByDepth,
    min_width_at_depth: minWidthAtDepth,
    max_width_at_depth: maxWidthAtDepth,
    avg_width: avgWidth,
  };
}
