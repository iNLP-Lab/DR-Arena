// ============================================================================
// Deep Research Arena Dashboard — Data types
// Matches the JSON schemas produced by scripts/build-data.py
// ============================================================================

// --- leaderboard.json ---

export interface LeaderboardEntry {
  rank: number;
  model: string;
  elo: number;
  matches: number;
  wins: number;
  losses: number;
  ties: number;
}

// --- battles.json ---

export interface Battle {
  id: string;
  replay_id?: string | null;
  tree_id: string;
  model_a: string;
  model_b: string;
  score_a: number;
  score_b: number;
  /** Resolved winner model name, or null for ties */
  winner: string | null;
  /** Number of rounds played in this match */
  rounds: number;
  /** "onboarding" for calibration matches, absent for regular tournament */
  type?: string;
  /** Tournament round number (from meta, when available) */
  round?: number;
  /** ISO timestamp (when available) */
  timestamp?: string;
  /** Source log group when a replay match exists */
  source_group?: string;
}

// --- pairwise.json ---

export interface PairwiseData {
  /** Ordered model names (same order as leaderboard) */
  models: string[];
  /** matrix[i][j] = win rate of model i vs model j. null for diagonal or unplayed */
  matrix: (number | null)[][];
  /** counts[i][j] = total matches between model i and model j */
  counts: number[][];
}

// --- model-meta.json ---

export interface ModelMeta {
  provider: string;
  color: string;
  short_name: string;
}

export type ModelMetaMap = Record<string, ModelMeta>;

// --- metadata.json (from web_tree/data/dataset/) ---

export interface TreeStats {
  max_depth: number;
  total_nodes: number;
  crawled_nodes: number;
  failed_nodes: number;
  nodes_by_depth: Record<string, number>;
  min_width_at_depth: Record<string, number>;
  max_width_at_depth: Record<string, number>;
  avg_width: number;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface TreeMetadataEntry {
  tree_id: string;
  filename: string;
  root_url: string;
  domain: string;
  crawled_at: string;
  topic: string;
  subtopic: string;
  category_id: number;
  search_query: string;
  search_results: SearchResult[];
  selected_url: string;
  llm_reasoning: string;
  stats: TreeStats;
}

export interface DatasetMetadata {
  created_at: string;
  updated_at: string;
  total_trees: number;
  trees: TreeMetadataEntry[];
}

// --- summary.json ---

export interface DatasetSummary {
  dataset_info: {
    created_at: string;
    updated_at: string;
    total_trees: number;
    dataset_dir: string;
  };
  trees_by_topic: Record<string, number>;
}

// --- site-meta.json ---

export interface SiteMeta {
  tournament_last_updated_at: string | null;
  tournament_source_files: string[];
}

// --- verdicts.json / failure-profiles.json ---

export type FailureType = "DEEP" | "WIDE" | "BOTH" | "NONE";

export interface VerdictRound {
  round: number;
  verdict: string;
  tie_quality: "LOW" | "HIGH" | "N/A" | string;
  failure_type: FailureType | null;
  score_a: number | null;
  score_b: number | null;
}

export interface VerdictEntry {
  battle_id: string;
  source_group: string;
  tree_id: string | null;
  model_a: string;
  model_b: string;
  rounds: VerdictRound[];
}

export interface FailureProfileEntry {
  counts: Record<FailureType, number>;
  total: number;
  distribution: Record<FailureType, number>;
}

export interface FailureProfiles {
  models: Record<string, FailureProfileEntry>;
  population_average: Record<FailureType, number>;
  coverage: {
    logs_total: number;
    logs_with_verdicts: number;
    rounds_total: number;
    rounds_with_failure_type: number;
    attributed_events: number;
  };
}

// --- battle-index.json / battle-replays/*.json ---

export interface BattleRoundState {
  round: number;
  depth: number | null;
  width: number | null;
  verdict: string | null;
  failure_type: FailureType | null;
  score_a: number | null;
  score_b: number | null;
  evolution_kind: string | null;
}

export interface BattleIndexEntry {
  id: string;
  replay_id: string | null;
  replay_available: boolean;
  tree_id: string;
  tree_title: string;
  tree_topic?: string | null;
  model_a: string;
  model_b: string;
  score_a: number;
  score_b: number;
  winner: string | null;
  rounds: number;
  type?: string;
  round?: number;
  tournament_round?: number | null;
  timestamp?: string;
  source_group?: string | null;
  question_preview?: string | null;
  questions: string[];
  final_verdict?: string | null;
  final_failure_type?: FailureType | null;
  total_tokens?: number | null;
  estimated_cost?: number | null;
  round_states: BattleRoundState[];
  overall_topic?: string | null;
}

export interface BattleReplayRound {
  round: number;
  depth: number | null;
  width: number | null;
  logic_chain: string[];
  question: string | null;
  word_limit_instruction: string | null;
  checklist_width: string[];
  checklist_depth: string[];
  rationale: string | null;
  source_nodes: (string | null)[];
  meta_context_snippet: string | null;
  judge_max_limit: number | null;
  answer_a: string;
  answer_b: string;
  duration_a_seconds: number | null;
  duration_b_seconds: number | null;
  verdict: string;
  tie_quality: string;
  failure_type: FailureType | null;
  judge_reasoning: string | null;
  score_a: number | null;
  score_b: number | null;
  evolution: {
    summary: string | null;
    kind: string | null;
    lines: string[];
  };
}

export interface BattleReplay {
  id: string;
  summary_id: string;
  source_group: string;
  source_log: string;
  tree_id: string;
  tree_title: string;
  tree_topic?: string | null;
  tree_subtopic?: string | null;
  tree_crawled_at?: string | null;
  tree_url?: string | null;
  model_a: string;
  model_b: string;
  winner: string | null;
  final_score_a: number | null;
  final_score_b: number | null;
  total_rounds: number;
  type?: string | null;
  tournament_round?: number | null;
  pairing_index?: number | null;
  mercy_rule: boolean;
  overall_topic?: string | null;
  questions: string[];
  round_states: BattleRoundState[];
  final_verdict?: string | null;
  final_failure_type?: FailureType | null;
  total_tokens?: number | null;
  estimated_cost?: number | null;
  rounds: BattleReplayRound[];
}

// --- Topology tree files (web/public/data/trees/tree_XXXX.json) ---

export interface TopologyNode {
  url: string;
  title: string;
  domain: string;
  depth: number;
  crawled: boolean;
  error?: string;
  /** Abbreviated relationship_cluster */
  rc?: string;
  children?: TopologyNode[];
}
