"use client";

import Link from "next/link";
import type { TreeMetadataEntry, TopologyNode } from "@/lib/types";
import { MiniTreeSvg } from "./mini-tree-svg";

interface Props {
  meta: TreeMetadataEntry;
  topology: TopologyNode | null;
  battleCount: number;
}

function topicTag(topic: string): string {
  const first = topic.split(">")[0].trim();
  return first;
}

export function TreeCard({ meta, topology, battleCount }: Props) {
  const s = meta.stats;

  return (
    <Link
      href={`/dataset/trees/${meta.tree_id}`}
      className="group flex flex-col overflow-hidden rounded-[20px] border border-border bg-bg-elevated/60 outline-none backdrop-blur-sm transition-all duration-400 hover:border-accent-2/30 hover:shadow-lg hover:shadow-accent-2/[0.08] focus:outline-none focus-visible:border-accent-2/40 focus-visible:ring-2 focus-visible:ring-accent-2/15"
    >
      {/* Mini topology */}
      <div className="relative flex items-center justify-center bg-bg-raised/40 px-4 pt-5 pb-3 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent-2/[0.04] to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        />
        {topology ? (
          <MiniTreeSvg data={topology} />
        ) : (
          <div className="flex h-[140px] w-full items-center justify-center text-xs text-fg-dim">
            No topology data
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 px-5 py-4">
        {/* Topic pill */}
        <span className="self-start rounded-full border border-accent-2/20 bg-accent-2/[0.06] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent-2">
          {topicTag(meta.topic)}
        </span>

        {/* Title */}
        <h3 className="text-sm font-semibold leading-snug text-fg line-clamp-2 group-hover:text-accent transition-colors">
          {meta.root_url.replace(/^https?:\/\//, "").split("/").slice(0, 2).join("/")}
        </h3>

        {/* Domain */}
        <div className="flex items-center gap-1.5 text-[11px] text-fg-dim">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-border-subtle" aria-hidden />
          <span className="truncate">{meta.domain}</span>
        </div>

        {/* Stats row */}
        <div className="mt-auto flex items-center gap-3 border-t border-border-subtle/50 pt-3 text-[11px] font-medium text-fg-muted">
          <span className="font-mono" data-numeric>
            D{s.max_depth}
          </span>
          <span className="text-border-strong">&middot;</span>
          <span className="font-mono" data-numeric>
            {s.total_nodes} nodes
          </span>
          <span className="text-border-strong">&middot;</span>
          <span className="font-mono" data-numeric>
            W{s.avg_width.toFixed(0)}
          </span>
          {battleCount > 0 && (
            <>
              <span className="ml-auto rounded-full bg-accent/[0.08] px-2 py-0.5 text-[10px] font-semibold text-accent">
                {battleCount} battles
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
