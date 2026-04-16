"use client";

import { useMemo } from "react";
import { hierarchy, tree as d3Tree } from "d3-hierarchy";
import type { TopologyNode } from "@/lib/types";

interface Props {
  data: TopologyNode;
  width?: number;
  height?: number;
}

interface FlatNode {
  x: number;
  y: number;
  depth: number;
  crawled: boolean;
  parentX?: number;
  parentY?: number;
}

export function MiniTreeSvg({ data, width = 220, height = 140 }: Props) {
  const { nodes, links, maxDepth } = useMemo(() => {
    const root = hierarchy(data, (d) => d.children ?? []);

    // Limit nodes for performance on massive trees
    const MAX_NODES = 300;
    let nodeCount = 0;
    root.eachBefore((n) => {
      nodeCount++;
      if (nodeCount > MAX_NODES && n.children) {
        n.children = undefined as unknown as typeof n.children;
      }
    });

    const layout = d3Tree<TopologyNode>()
      .size([width - 24, height - 28])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

    layout(root);

    const flatNodes: FlatNode[] = [];
    const flatLinks: { x1: number; y1: number; x2: number; y2: number }[] = [];
    let md = 0;

    root.each((n) => {
      const nx = (n.x ?? 0) + 12;
      const ny = (n.y ?? 0) + 14;
      if (n.depth > md) md = n.depth;
      flatNodes.push({
        x: nx,
        y: ny,
        depth: n.depth,
        crawled: n.data.crawled,
      });
      if (n.parent) {
        flatLinks.push({
          x1: (n.parent.x ?? 0) + 12,
          y1: (n.parent.y ?? 0) + 14,
          x2: nx,
          y2: ny,
        });
      }
    });

    return { nodes: flatNodes, links: flatLinks, maxDepth: md };
  }, [data, width, height]);

  function depthColor(depth: number): string {
    const t = maxDepth > 0 ? depth / maxDepth : 0;
    // teal gradient: lighter at root, richer at leaves
    const r = Math.round(30 + t * 15);
    const g = Math.round(190 + t * 22);
    const b = Math.round(175 + t * 16);
    return `rgb(${r},${g},${b})`;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full transition-transform duration-500 group-hover:scale-[1.04]"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges */}
      {links.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="var(--accent-2)"
          strokeWidth={0.6}
          strokeOpacity={0.25}
        />
      ))}
      {/* Nodes */}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={n.depth === 0 ? 3 : 1.5}
          fill={n.crawled ? depthColor(n.depth) : "var(--fg-disabled)"}
          opacity={n.crawled ? 0.8 : 0.35}
          className="transition-opacity duration-500 group-hover:opacity-100"
        />
      ))}
    </svg>
  );
}
