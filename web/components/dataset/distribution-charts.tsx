"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TopicData {
  category: string;
  count: number;
}

interface DomainData {
  domain: string;
  count: number;
}

interface DepthData {
  depth: string;
  nodes: number;
}

interface Props {
  topicData: TopicData[];
  domainData: DomainData[];
  depthData: DepthData[];
  onTopicClick?: (category: string | null) => void;
  activeCategory?: string | null;
}

const PALETTE = [
  "#d4a04a", "#2dd4bf", "#e86452", "#6dc8ec", "#945fb9",
  "#5ad8a6", "#f6bd16", "#7262fd", "#78d3f8", "#f7a4b8",
  "#b0d992", "#ff9845", "#a18cd1", "#4ecdc4", "#ff6b6b",
];

export function DistributionCharts({
  topicData,
  domainData,
  depthData,
  onTopicClick,
  activeCategory,
}: Props) {
  const chartCardClassName =
    "rounded-[20px] border border-border bg-bg-elevated/60 p-5 " +
    "[&_*:focus]:outline-none [&_*:focus-visible]:outline-none " +
    "[&_.recharts-sector:focus]:outline-none [&_.recharts-rectangle:focus]:outline-none " +
    "[&_.recharts-layer:focus]:outline-none [&_.recharts-surface:focus]:outline-none";

  return (
    <div className="grid gap-5 md:grid-cols-3">
      {/* Topic donut */}
      <div className={chartCardClassName}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
          Topics
        </div>
        <p className="mt-1 text-[11px] text-fg-muted">Tree count by top-level category</p>
        <div className="mt-3 h-[200px] outline-none">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <PieChart>
              <Pie
                data={topicData}
                cx="50%"
                cy="50%"
                innerRadius="38%"
                outerRadius="72%"
                dataKey="count"
                nameKey="category"
                stroke="var(--bg-elevated)"
                strokeWidth={2}
                onClick={(_, idx) => {
                  const cat = topicData[idx]?.category;
                  onTopicClick?.(activeCategory === cat ? null : cat);
                }}
                cursor="pointer"
              >
                {topicData.map((entry, i) => (
                  <Cell
                    key={entry.category}
                    fill={PALETTE[i % PALETTE.length]}
                    opacity={activeCategory && activeCategory !== entry.category ? 0.25 : 0.85}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as TopicData;
                  return (
                    <div className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs shadow-lg">
                      <div className="font-medium text-fg">{d.category}</div>
                      <div className="mt-1 font-mono text-fg-muted" data-numeric>
                        {d.count} tree{d.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {/* Compact legend */}
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {topicData.slice(0, 8).map((d, i) => (
            <button
              key={d.category}
              className={`flex items-center gap-1 rounded-full px-1 py-0.5 text-[10px] outline-none transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-2/15 ${
                activeCategory && activeCategory !== d.category ? "opacity-30" : ""
              }`}
              onClick={() => onTopicClick?.(activeCategory === d.category ? null : d.category)}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="text-fg-dim">{d.category}</span>
            </button>
          ))}
          {topicData.length > 8 && (
            <span className="text-[10px] text-fg-disabled">+{topicData.length - 8}</span>
          )}
        </div>
      </div>

      {/* Domain bar */}
      <div className={chartCardClassName}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
          Domains
        </div>
        <p className="mt-1 text-[11px] text-fg-muted">Top sources by tree count</p>
        <div className="mt-3 h-[220px] outline-none">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart
              data={domainData}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="domain"
                width={100}
                tick={{ fontSize: 10, fill: "var(--fg-dim)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) =>
                  v.length > 16 ? v.slice(0, 15) + "…" : v
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as DomainData;
                  return (
                    <div className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs shadow-lg">
                      <div className="font-medium text-fg">{d.domain}</div>
                      <div className="mt-1 font-mono text-fg-muted" data-numeric>
                        {d.count} tree{d.count !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" fill="var(--accent-2)" radius={[0, 6, 6, 0]} barSize={14} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Depth histogram */}
      <div className={chartCardClassName}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim">
          Node Depth
        </div>
        <p className="mt-1 text-[11px] text-fg-muted">Aggregate nodes across all trees</p>
        <div className="mt-3 h-[220px] outline-none">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart
              data={depthData}
              margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
            >
              <XAxis
                dataKey="depth"
                tick={{ fontSize: 10, fill: "var(--fg-dim)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border-subtle)" }}
                tickFormatter={(v: string) => `D${v}`}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--fg-dim)" }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as DepthData;
                  return (
                    <div className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-xs shadow-lg">
                      <div className="font-medium text-fg">Depth {d.depth}</div>
                      <div className="mt-1 font-mono text-fg-muted" data-numeric>
                        {d.nodes.toLocaleString()} nodes
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="nodes" fill="var(--accent)" radius={[4, 4, 0, 0]} barSize={28} fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
