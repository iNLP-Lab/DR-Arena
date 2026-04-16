import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Code2, Network, Scale, Trophy } from "lucide-react";
import { getLeaderboard, getModelMeta, getBattles, getMetadata, getTopologyTreeIds } from "@/lib/data";
import { publicAssetPath } from "@/lib/site";
import { EvidenceToggle } from "@/components/methodology/evidence-toggle";

/* ── Information tree — the signature background visual ── */

const TREE_NODES = [
  // Root
  { id: "r", x: 500, y: 55, size: 6 },
  // Level 1
  { id: "a", x: 230, y: 175, size: 4.5 },
  { id: "b", x: 500, y: 185, size: 4.5 },
  { id: "c", x: 770, y: 175, size: 4.5 },
  // Level 2
  { id: "d", x: 120, y: 300, size: 3.5 },
  { id: "e", x: 320, y: 290, size: 3.5 },
  { id: "f", x: 480, y: 310, size: 3.5 },
  { id: "g", x: 670, y: 290, size: 3.5 },
  { id: "h", x: 880, y: 300, size: 3.5 },
  // Level 3 — leaf nodes
  { id: "i", x: 60, y: 410, size: 2.5 },
  { id: "j", x: 180, y: 420, size: 2.5 },
  { id: "k", x: 270, y: 400, size: 2.5 },
  { id: "l", x: 400, y: 420, size: 2.5 },
  { id: "m", x: 560, y: 415, size: 2.5 },
  { id: "n", x: 730, y: 405, size: 2.5 },
  { id: "o", x: 830, y: 420, size: 2.5 },
  { id: "p", x: 940, y: 410, size: 2.5 },
] as const;

const TREE_EDGES: readonly [string, string][] = [
  ["r", "a"],
  ["r", "b"],
  ["r", "c"],
  ["a", "d"],
  ["a", "e"],
  ["b", "f"],
  ["b", "g"],
  ["c", "g"],
  ["c", "h"],
  ["d", "i"],
  ["d", "j"],
  ["e", "k"],
  ["f", "l"],
  ["f", "m"],
  ["g", "n"],
  ["h", "o"],
  ["h", "p"],
];

const NODE_MAP = Object.fromEntries(TREE_NODES.map((n) => [n.id, n]));

const FEATURES = [
  {
    icon: Network,
    title: "Dynamic Trees",
    desc: "Real-time information trees built from fresh web trends. Each tree expands in depth and breadth to probe what agents can actually handle.",
    accent: "text-accent-2",
    accentBg: "bg-accent-2/10",
    cardTint: "bg-bg-elevated/60",
    glowColor: "rgba(45, 212, 191, 0.15)",
    lineColor: "var(--accent-2)",
  },
  {
    icon: Scale,
    title: "Automated Judging",
    desc: "An LLM examiner generates questions that test both deep reasoning and wide coverage, then grades the answers against hidden checklists. No human annotators in the loop.",
    accent: "text-accent",
    accentBg: "bg-accent/10",
    cardTint: "bg-bg-elevated/60",
    glowColor: "rgba(212, 160, 74, 0.2)",
    lineColor: "var(--accent)",
  },
  {
    icon: Trophy,
    title: "Elo Rankings",
    desc: "Head-to-head results feed into a Bradley-Terry model to produce Elo scores. Our rankings track closely with LMSYS Search Arena.",
    accent: "text-data-4",
    accentBg: "bg-data-4/10",
    cardTint: "bg-bg-elevated/60",
    glowColor: "rgba(232, 100, 82, 0.15)",
    lineColor: "var(--data-4)",
  },
];

const FAILURE_TAXONOMY = [
  {
    tag: "DEEP",
    criteriaLead: "Logic Failure.",
    criteriaRest:
      "Failed to identify the correct core entity due to a broken reasoning chain.",
    color: "text-[#cc0f35]",
    bg: "bg-[#feecf0]",
    border: "border-[#f8b6c3]",
  },
  {
    tag: "WIDE",
    criteriaLead: "Coverage Failure.",
    criteriaRest:
      "Failed to aggregate specific attribute details (Data Gap).",
    color: "text-[#946c00]",
    bg: "bg-[#fffaeb]",
    border: "border-[#ffe08a]",
  },
  {
    tag: "BOTH",
    criteriaLead: "Systemic Failure.",
    criteriaRest:
      "Failed on both logical identification and factual completeness.",
    color: "text-[#363636]",
    bg: "bg-[#f5f5f5]",
    border: "border-[#dbdbdb]",
  },
  {
    tag: "NONE",
    criteriaLead: "Soft Gap.",
    criteriaRest:
      "The loss was determined solely by soft filters (formatting or utility preferences).",
    color: "text-[#1d72aa]",
    bg: "bg-[#eef6fc]",
    border: "border-[#b5dcf3]",
  },
];

const EVOLVEMENT_TRANSITIONS = [
  {
    verdictLead: "Tie",
    verdictRest: " (High Quality)",
    signal: "N/A",
    action: "Pressure Test",
    detail: "D ↑ 1 & W ↑ 1",
    rationale: "Current task too easy; find ceiling.",
    actionColor: "text-white",
    actionBg: "bg-[#00d1b2]",
    actionBorder: "border-[#00d1b2]",
    detailColor: "text-[#00947e]",
    actionBold: false,
  },
  {
    verdictLead: "Tie",
    verdictRest: " (Low Quality)",
    signal: "N/A",
    action: "Backtrack",
    detail: "Move to Parent",
    rationale: "Current task too hard; re-establish baseline.",
    actionColor: "text-[#363636]",
    actionBg: "bg-[#f5f5f5]",
    actionBorder: "border-[#dbdbdb]",
    detailColor: "text-fg-dim",
    actionBold: false,
  },
  {
    verdictLead: "Winner Decided",
    verdictRest: "",
    signalTag: "DEEP",
    signalRest: " (Logic Failure)",
    signalColor: "text-[#cc0f35]",
    signalBg: "bg-[#feecf0]",
    signalBorder: "border-[#f8b6c3]",
    action: "Probe Depth",
    detail: "D ↑ 1",
    rationale: "Challenge loser's reasoning capabilities.",
    actionColor: "text-[#cc0f35]",
    actionBg: "bg-transparent",
    actionBorder: "border-transparent",
    detailColor: "text-[#cc0f35]",
    actionBold: true,
  },
  {
    verdictLead: "Winner Decided",
    verdictRest: "",
    signalTag: "WIDE",
    signalRest: " (Retrieval Failure)",
    signalColor: "text-[#946c00]",
    signalBg: "bg-[#fffaeb]",
    signalBorder: "border-[#ffe08a]",
    action: "Probe Width",
    detail: "W ↑ 1",
    rationale: "Challenge loser's information coverage.",
    actionColor: "text-[#946c00]",
    actionBg: "bg-transparent",
    actionBorder: "border-transparent",
    detailColor: "text-[#946c00]",
    actionBold: true,
  },
  {
    verdictLead: "Winner Decided",
    verdictRest: "",
    signalTag: "BOTH / NONE",
    signalRest: "",
    signalColor: "text-[#363636]",
    signalBg: "bg-[#f5f5f5]",
    signalBorder: "border-[#dbdbdb]",
    action: "Pressure Test",
    detail: "D ↑ 1 & W ↑ 1",
    rationale: "Ambiguous failure; increase difficulty.",
    actionColor: "text-[#363636]",
    actionBg: "bg-transparent",
    actionBorder: "border-transparent",
    detailColor: "text-[#363636]",
    actionBold: true,
  },
];

export default function HomePage() {
  const leaderboard = getLeaderboard();
  const modelMeta = getModelMeta();
  const battles = getBattles();
  const metadata = getMetadata();
  const topologyIds = new Set(getTopologyTreeIds());
  const explorableTreeCount = metadata.trees.filter((tree) => topologyIds.has(tree.tree_id)).length;
  const top5 = leaderboard.slice(0, 5);
  const STATS = [
    { value: "0.94", label: "Human Alignment", highlight: true },
    { value: String(leaderboard.length), label: "Models Evaluated", highlight: false },
    { value: `${battles.length}+`, label: "Matches Played", highlight: false },
    { value: String(explorableTreeCount), label: "Information Trees", highlight: false },
  ];

  return (
    <div className="relative flex flex-col items-center overflow-hidden w-full">
      {/* ── Ambient lighting — warm gold + cool teal depth ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -z-10 h-[700px] w-[1000px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-accent/[0.07] blur-[160px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[80px] right-[8%] -z-10 h-[450px] w-[450px] rounded-full bg-accent-2/[0.06] blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[250px] left-[3%] -z-10 h-[350px] w-[350px] rounded-full bg-data-4/[0.05] blur-[110px]"
      />

      {/* ── Information tree visualization (teal / data layer) ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center h-[520px]"
      >
        <svg
          viewBox="0 0 1000 480"
          className="w-full max-w-[1440px] text-accent-2"
          style={{ opacity: 0.12 }}
          preserveAspectRatio="xMidYMin meet"
        >
          <defs>
            <filter id="node-glow">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Edges */}
          {TREE_EDGES.map(([from, to]) => {
            const a = NODE_MAP[from];
            const b = NODE_MAP[to];
            return (
              <line
                key={`${from}-${to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="currentColor"
                strokeWidth="1.2"
                opacity="0.5"
                className="tree-edge"
              />
            );
          })}
          {/* Nodes */}
          {TREE_NODES.map((node, i) => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={node.size}
              fill="currentColor"
              filter="url(#node-glow)"
              className="tree-node"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          ))}
        </svg>
      </div>

      {/* ── Hero ── */}
      <section className="flex w-full max-w-[1440px] flex-col items-center px-3 pt-14 pb-10 text-center sm:px-6 md:px-10 md:pt-20 md:pb-14 lg:px-12">
        {/* Headline */}
        <h1
          className="animate-fade-in-up max-w-full whitespace-nowrap font-display text-[16px] leading-none min-[390px]:text-[22px] sm:text-[40px] md:text-[64px] lg:text-[72px]"
          style={{ animationDelay: "0.1s" }}
        >
          Which{" "}
          <span className="text-accent italic drop-shadow-[0_0_32px_rgba(212,160,74,0.4)]">
            deep research agent
          </span>{" "}
          actually wins?
        </h1>

        {/* Subtitle */}
        <p
          className="animate-fade-in-up mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-fg-muted md:max-w-[1180px] md:text-xl"
          style={{ animationDelay: "0.2s" }}
        >
          We pit deep research agents against each other on real-time
          research tasks that get harder as they play. Fully automated,
          yet our rankings track closely with human-verified LMSYS Search
          Arena rankings (0.94 Spearman correlation).
        </p>

        {/* CTA row */}
        <div
          className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3"
          style={{ animationDelay: "0.3s" }}
        >
          <Link
            href="/leaderboard"
            className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-xl bg-accent px-7 text-sm font-semibold text-fg-inverse shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/30"
          >
            View Leaderboard
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="https://arxiv.org/abs/2601.10504"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-border-strong bg-bg-elevated/50 px-6 text-sm font-medium text-fg backdrop-blur-sm transition-all hover:border-accent/30 hover:bg-bg-elevated"
          >
            <BookOpen className="h-4 w-4" />
            Read Paper
          </a>
          <a
            href="https://github.com/iNLP-Lab/DR-Arena"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-border-strong bg-bg-elevated/50 px-6 text-sm font-medium text-fg backdrop-blur-sm transition-all hover:border-accent-2/30 hover:bg-bg-elevated"
          >
            <Code2 className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </section>

      {/* ── Stats ribbon ── */}
      <section
        className="animate-fade-in-up w-full border-y border-border-subtle bg-bg-elevated/40 backdrop-blur-sm"
        style={{ animationDelay: "0.4s" }}
      >
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 px-6 md:grid-cols-4 md:px-10 lg:px-12">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="stat-cell group relative flex flex-col items-center gap-1.5 px-4 py-6 md:py-7"
            >
              {i > 0 && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-px bg-border-subtle hidden md:block" />
              )}
              <span
                className={`font-display text-[34px] leading-none md:text-[48px] transition-colors ${
                  stat.highlight
                    ? "text-accent-2"
                    : "text-fg group-hover:text-accent"
                }`}
              >
                {stat.value}
              </span>
              <span className="text-xs font-medium uppercase tracking-wider text-fg-dim">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Current rankings — compact top 5 ── */}
      <section
        className="animate-fade-in-up w-full max-w-[1440px] px-6 py-10 md:px-10 md:py-14 lg:px-12"
        style={{ animationDelay: "0.45s" }}
      >
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-display text-4xl leading-none md:text-[52px]">Current Rankings</h2>
            <p className="mt-1 text-sm text-fg-muted md:text-base">
              Top 5 deep research agents by Elo rating
              <span className="hidden text-fg-dim sm:inline"> · </span>
              <span className="hidden font-mono text-accent-2 sm:inline">0.94 Spearman</span>
              <span className="hidden text-fg-dim sm:inline"> vs LMSYS Search Arena</span>
            </p>
          </div>
          <Link
            href="/leaderboard"
            className="group inline-flex items-center gap-2 self-start whitespace-nowrap font-display text-[24px] leading-none text-accent transition-colors hover:text-accent-hover sm:pt-10 md:pt-14 md:text-[30px]"
          >
            Full leaderboard
            <ArrowRight className="mt-1 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-bg-elevated/60 backdrop-blur-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left">
                <th className="w-12 py-3 pl-4 pr-2 text-xs font-medium uppercase tracking-wider text-fg-dim">#</th>
                <th className="py-3 px-3 text-xs font-medium uppercase tracking-wider text-fg-dim">Model</th>
                <th className="py-3 px-3 text-right text-xs font-medium uppercase tracking-wider text-fg-dim">Elo</th>
                <th className="hidden py-3 px-3 text-right text-xs font-medium uppercase tracking-wider text-fg-dim sm:table-cell">Matches</th>
                <th className="hidden py-3 px-3 text-right text-xs font-medium uppercase tracking-wider text-fg-dim md:table-cell">W / L / T</th>
                <th className="py-3 px-3 pr-4 text-right text-xs font-medium uppercase tracking-wider text-fg-dim">Win %</th>
              </tr>
            </thead>
            <tbody>
              {top5.map((entry) => {
                const meta = modelMeta[entry.model];
                const winRate = entry.matches > 0
                  ? ((entry.wins / entry.matches) * 100).toFixed(1)
                  : "—";
                return (
                  <tr
                    key={entry.model}
                    className="border-b border-border-subtle/50 transition-colors last:border-0 hover:bg-accent/[0.04]"
                  >
                    <td className="py-3 pl-4 pr-2 font-mono text-xs text-fg-dim">
                      {String(entry.rank).padStart(2, "0")}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: meta?.color ?? "var(--fg-dim)" }}
                        />
                        <span className="font-medium text-fg">{meta?.short_name ?? entry.model}</span>
                        <span className="hidden text-xs text-fg-dim lg:inline">{meta?.provider}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-base font-semibold tabular" data-numeric>
                      {entry.elo.toFixed(1)}
                    </td>
                    <td className="hidden py-3 px-3 text-right font-mono text-fg-muted sm:table-cell" data-numeric>
                      {entry.matches}
                    </td>
                    <td className="hidden py-3 px-3 text-right font-mono text-xs text-fg-muted md:table-cell" data-numeric>
                      {entry.wins}/{entry.losses}/{entry.ties}
                    </td>
                    <td className="py-3 px-3 pr-4 text-right font-mono text-fg-muted" data-numeric>
                      {winRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </section>

      {/* ── Feature cards ── */}
      <section className="mx-auto w-full max-w-[1440px] px-6 py-10 md:px-10 md:py-14 lg:px-12">
        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((card, i) => (
            <div
              key={card.title}
              className={`animate-fade-in-up accent-line-top feature-card group rounded-2xl border border-border ${card.cardTint} px-7 py-7 backdrop-blur-sm`}
              style={{
                animationDelay: `${0.5 + i * 0.1}s`,
                "--card-line-color": card.lineColor,
                "--card-glow": card.glowColor,
              } as React.CSSProperties}
            >
              <div
                className={`mb-4 inline-flex rounded-lg ${card.accentBg} p-2.5 ${card.accent} transition-transform group-hover:scale-110`}
              >
                <card.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-semibold text-fg">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                {card.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        className="animate-fade-in-up w-full border-t border-border-subtle bg-bg-elevated/30"
        style={{ animationDelay: "0.65s" }}
      >
        <div className="mx-auto w-full max-w-[1440px] px-6 py-12 md:px-10 md:py-16 lg:px-12">
          <div className="mb-10">
            <h2 className="font-display text-4xl leading-none text-fg md:text-[52px]">
              How it works
            </h2>
          </div>

          {/* Framework diagram from the original DR-Arena paper */}
          <figure className="mb-10 overflow-hidden rounded-2xl border border-border bg-bg-elevated/60 p-4 backdrop-blur-sm md:p-7">
            <div className="mb-3 flex items-baseline justify-between">
              <figcaption className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-dim">
                Figure 1: Overview of DR-Arena
              </figcaption>
              <span className="font-mono text-[10px] uppercase tracking-wider text-accent">
                Closed-loop framework
              </span>
            </div>
            <Image
              src={publicAssetPath("/images/how-it-works/framework.png")}
              alt="Framework overview: Examiner constructs an information tree, generates questions and rubrics, the two agents respond, and the Examiner grades and refines the next round."
              width={1600}
              height={420}
              className="h-auto w-full"
              priority={false}
            />
            <p className="mt-3 text-xs leading-relaxed text-fg-dim">
              The system operates as a closed-loop ecosystem with three stages: Dynamic Tree Construction, Automated Task Generation, and the Adaptive Evolvement Loop.
            </p>
          </figure>

          {/* ── Editorial three-act methodology ── */}
          <ol className="space-y-6 md:space-y-8">
            {/* ─── Act 01 — Automated Task Generation ─── */}
            <li className="relative overflow-hidden rounded-3xl border border-accent-2/20 bg-bg-elevated/50 backdrop-blur-sm">
              <div className="grid gap-8 px-6 py-8 md:grid-cols-[170px_1fr] md:gap-12 md:px-10 md:py-12">
                <div className="flex flex-col gap-3 md:gap-4">
                  <span className="font-display text-[88px] leading-[0.85] text-accent-2 md:text-[120px]">
                    01
                  </span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-2">
                    Automated
                    <br />
                    Task Generation
                  </span>
                </div>
                <div className="space-y-6">
                  <div>
                    <h3 className="font-display text-2xl leading-[1.15] tracking-tight text-fg md:text-[32px]">
                      Automated Task Generation
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-fg-muted md:text-lg">
                      To ensure task diversity, the Examiner samples a seed topic from Google Trends and constructs an information tree by scraping high-quality informative websites. The tree is expanded via <strong className="font-semibold text-fg">Depth Expansion</strong> (for reasoning chains) and <strong className="font-semibold text-fg">Width Expansion</strong> (for sibling aggregations). The Examiner then generates &quot;Deep &amp; Wide&quot; questions that require traversing this topology, strictly avoiding data contamination.
                    </p>
                  </div>

                  {/* Depth vs Width visual */}
                  <div className="grid gap-3 rounded-2xl border border-border-subtle bg-bg/40 p-4 sm:grid-cols-2 sm:gap-6 sm:p-6">
                    <div className="flex items-center gap-5">
                      <svg viewBox="0 0 60 110" className="h-24 w-14 shrink-0 text-accent-2">
                        <line x1="30" y1="14" x2="30" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                        <line x1="30" y1="50" x2="30" y2="74" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                        <line x1="30" y1="86" x2="30" y2="100" stroke="currentColor" strokeWidth="1.5" opacity="0.4" strokeDasharray="2 3" />
                        <circle cx="30" cy="10" r="5" fill="currentColor" />
                        <circle cx="30" cy="44" r="4.5" fill="currentColor" opacity="0.85" />
                        <circle cx="30" cy="80" r="4" fill="currentColor" opacity="0.7" />
                      </svg>
                      <div>
                        <div className="font-mono text-xs font-semibold uppercase tracking-wider text-accent-2">
                          Depth Expansion
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-fg-muted">
                          Extends a chain of reasoning from a single fact.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-5">
                      <svg viewBox="0 0 110 80" className="h-20 w-24 shrink-0 text-accent-2">
                        <line x1="55" y1="14" x2="20" y2="56" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                        <line x1="55" y1="14" x2="55" y2="56" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                        <line x1="55" y1="14" x2="90" y2="56" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
                        <circle cx="55" cy="10" r="5" fill="currentColor" />
                        <circle cx="20" cy="62" r="4.5" fill="currentColor" opacity="0.85" />
                        <circle cx="55" cy="62" r="4.5" fill="currentColor" opacity="0.85" />
                        <circle cx="90" cy="62" r="4.5" fill="currentColor" opacity="0.85" />
                      </svg>
                      <div>
                        <div className="font-mono text-xs font-semibold uppercase tracking-wider text-accent-2">
                          Width Expansion
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-fg-muted">
                          Aggregates siblings under a shared parent.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <EvidenceToggle eyebrow="Figure 2: Task Generation" label="figure">
                <figure className="px-4 pb-4 md:px-6 md:pb-6">
                  <Image
                    src={publicAssetPath("/images/how-it-works/task_generation.png")}
                    alt="Task generation example: the Examiner transforms topological web structures into complex research queries."
                    width={1864}
                    height={726}
                    className="h-auto w-full"
                    priority={false}
                  />
                  <p className="mt-3 text-xs leading-relaxed text-fg-dim">
                    The Examiner transforms topological web structures into complex research queries.
                  </p>
                </figure>
              </EvidenceToggle>
            </li>

            {/* ─── Act 02 — Evidence-Based Judgement ─── */}
            <li className="relative overflow-hidden rounded-3xl border border-accent/20 bg-bg-elevated/50 backdrop-blur-sm">
              <div className="grid gap-8 px-6 py-8 md:grid-cols-[170px_1fr] md:gap-12 md:px-10 md:py-12">
                <div className="flex flex-col gap-3 md:gap-4">
                  <span className="font-display text-[88px] leading-[0.85] text-accent md:text-[120px]">
                    02
                  </span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                    Evidence-Based
                    <br />
                    Judgement
                  </span>
                </div>
                <div className="space-y-5">
                  <div>
                    <h3 className="font-display text-2xl leading-[1.15] tracking-tight text-fg md:text-[32px]">
                      Evidence-Based Judgement
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-fg-muted md:text-lg">
                      Evaluating open-ended reports is inherently challenging. DR-Arena employs the Examiner as a Judge using a strict two-stage protocol:
                    </p>
                  </div>
                  <ul className="grid gap-3 text-base leading-relaxed text-fg-muted md:text-lg">
                    <li className="rounded-xl border border-border-subtle bg-bg/35 px-4 py-3">
                      <strong className="font-semibold text-fg">Hard Constraints:</strong> Verifying against the generated <i>Checklist-Depth</i> (Logic) and <i>Checklist-Width</i> (Data Completeness). Critical errors result in immediate penalties.
                    </li>
                    <li className="rounded-xl border border-border-subtle bg-bg/35 px-4 py-3">
                      <strong className="font-semibold text-fg">Soft Constraints:</strong> Assessing user experience aspects such as presentation quality, formatting, and information density.
                    </li>
                  </ul>
                  <p className="text-base leading-relaxed text-fg-muted md:text-lg">
                    Based on these constraints, the system assigns a tiered verdict (<strong className="font-semibold text-fg">Much Better</strong>, <strong className="font-semibold text-fg">Better</strong>, or <strong className="font-semibold text-fg">Tie</strong>) and diagnoses the specific failure type of the losing agent to guide future rounds.
                  </p>
                </div>
              </div>
              <EvidenceToggle eyebrow="Table 1: Taxonomy of Failure Types" label="table">
                <div className="px-4 pb-4 md:px-6 md:pb-6">
                  <div className="overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle">
                    <div className="grid grid-cols-[120px_1fr] bg-bg-raised/70 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim md:grid-cols-[170px_1fr]">
                      <div>Failure Tag</div>
                      <div>Diagnostic Criteria</div>
                    </div>
                    {FAILURE_TAXONOMY.map((row) => (
                      <div
                        key={row.tag}
                        className="grid grid-cols-[120px_1fr] gap-px border-t border-border-subtle bg-bg-elevated/80 md:grid-cols-[170px_1fr]"
                      >
                        <div className="flex items-start px-4 py-4">
                          <span className={`inline-flex rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider ${row.border} ${row.bg} ${row.color}`}>
                            {row.tag}
                          </span>
                        </div>
                        <div className="px-4 py-4 text-sm leading-relaxed text-fg-muted md:text-base">
                          <strong className="font-semibold text-fg">{row.criteriaLead}</strong>{" "}
                          {row.criteriaRest}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </EvidenceToggle>
            </li>

            {/* ─── Act 03 — Adaptive Evolvement Loop ─── */}
            <li className="relative overflow-hidden rounded-3xl border border-data-4/20 bg-bg-elevated/50 backdrop-blur-sm">
              <div className="grid gap-8 px-6 py-8 md:grid-cols-[170px_1fr] md:gap-12 md:px-10 md:py-12">
                <div className="flex flex-col gap-3 md:gap-4">
                  <span className="font-display text-[88px] leading-[0.85] text-data-4 md:text-[120px]">
                    03
                  </span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-data-4">
                    Adaptive
                    <br />
                    Evolvement Loop
                  </span>
                </div>
                <div className="space-y-5">
                  <div>
                    <h3 className="font-display text-2xl leading-[1.15] tracking-tight text-fg md:text-[32px]">
                      Adaptive Evolvement Loop
                    </h3>
                    <p className="mt-4 text-base leading-relaxed text-fg-muted md:text-lg">
                      After each round, the Examiner operates on a targeted probing strategy. If agents reach a stalemate, the system intervenes to amplify differences:
                    </p>
                  </div>
                  <ul className="grid gap-3 text-base leading-relaxed text-fg-muted md:text-lg">
                    <li className="rounded-xl border border-border-subtle bg-bg/35 px-4 py-3">
                      <strong className="font-semibold text-fg">High-Quality Tie:</strong> The task is too easy. The system triggers a <strong className="font-semibold text-fg">Pressure Test</strong>, increasing both Depth (<span className="font-mono text-sm">$D$</span>) and Width (<span className="font-mono text-sm">$W$</span>) to locate the capability ceiling.
                    </li>
                    <li className="rounded-xl border border-border-subtle bg-bg/35 px-4 py-3">
                      <strong className="font-semibold text-fg">Marginal Win:</strong> The system aggressively targets the loser&apos;s specific weakness (probing either Depth or Width) to force a decisive breakdown.
                    </li>
                  </ul>
                  <p className="text-base leading-relaxed text-fg-muted md:text-lg">
                    This adaptive mechanism ensures the system efficiently converges to a verdict by continuously pushing agents toward their specific breakdown points, acting as an efficient sorting algorithm for AI capabilities.
                  </p>
                </div>
              </div>
              <EvidenceToggle eyebrow="Table 2: The Evolvement Loop Transition Matrix" label="table">
                <div className="px-4 pb-4 md:px-6 md:pb-6">
                  <div className="overflow-hidden rounded-2xl border border-border-subtle bg-border-subtle">
                    <div className="hidden grid-cols-[1fr_1fr_1fr_1.2fr] bg-bg-raised/70 px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-dim md:grid">
                      <div>Adjudication Verdict</div>
                      <div>Diagnostic Signal</div>
                      <div>Evolution Action</div>
                      <div>Strategic Rationale</div>
                    </div>
                    {EVOLVEMENT_TRANSITIONS.map((row) => (
                      <div
                        key={`${row.verdictLead}-${row.verdictRest}-${row.signal ?? row.signalTag}`}
                        className="grid gap-3 border-t border-border-subtle bg-bg-elevated/80 px-4 py-4 text-sm leading-relaxed text-fg-muted md:grid-cols-[1fr_1fr_1fr_1.2fr] md:gap-4"
                      >
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim md:hidden">
                            Adjudication Verdict
                          </div>
                          <strong className="font-semibold text-fg">{row.verdictLead}</strong>
                          {row.verdictRest}
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim md:hidden">
                            Diagnostic Signal
                          </div>
                          {row.signalTag ? (
                            <>
                              <span className={`inline-flex rounded-md border px-2.5 py-1 font-mono text-[11px] font-bold tracking-wide ${row.signalBorder} ${row.signalBg} ${row.signalColor}`}>
                                {row.signalTag}
                              </span>
                              {row.signalRest}
                            </>
                          ) : (
                            row.signal
                          )}
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim md:hidden">
                            Evolution Action
                          </div>
                          <span className={`inline-flex rounded-md border px-2.5 py-1 font-mono text-[11px] tracking-wide ${row.actionBorder} ${row.actionBg} ${row.actionColor} ${row.actionBold ? "font-bold" : "font-semibold"}`}>
                            {row.action}
                          </span>
                          <div className={`mt-1 font-mono text-xs ${row.detailColor}`}>
                            ({row.detail})
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim md:hidden">
                            Strategic Rationale
                          </div>
                          {row.rationale}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </EvidenceToggle>
            </li>
          </ol>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section
        className="animate-fade-in-up w-full border-t border-border-subtle"
        style={{ animationDelay: "0.8s" }}
      >
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 px-6 py-12 text-center md:py-16">
          <p className="text-base text-fg-muted md:text-lg">
            Built at{" "}
            <a
              href="https://isakzhang.github.io/group.html"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fg transition-colors hover:text-accent"
            >
              SUTD iNLP Lab
            </a>
            {" · "}
            open-source & reproducible
          </p>
          <div className="flex items-center gap-3">
            <Link
              href="/dataset"
              className="text-sm font-medium text-accent transition-colors hover:text-accent-hover md:text-base"
            >
              Explore dataset &rarr;
            </Link>
            <span className="text-fg-dim">·</span>
            <Link
              href="/battles"
              className="text-sm font-medium text-accent-2 transition-colors hover:text-accent-2-hover md:text-base"
            >
              Browse battles &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
