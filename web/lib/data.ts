import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type {
  LeaderboardEntry,
  Battle,
  PairwiseData,
  ModelMetaMap,
  DatasetMetadata,
  DatasetSummary,
  SiteMeta,
  VerdictEntry,
  FailureProfiles,
  BattleIndexEntry,
  BattleReplay,
} from "./types";

const DATA_DIR = join(process.cwd(), "public", "data");

function readJson<T>(filename: string): T {
  const raw = readFileSync(join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

export function getLeaderboard(): LeaderboardEntry[] {
  return readJson<LeaderboardEntry[]>("leaderboard.json");
}

export function getBattles(): Battle[] {
  return readJson<Battle[]>("battles.json");
}

export function getPairwise(): PairwiseData {
  return readJson<PairwiseData>("pairwise.json");
}

export function getModelMeta(): ModelMetaMap {
  return readJson<ModelMetaMap>("model-meta.json");
}

export function getMetadata(): DatasetMetadata {
  return readJson<DatasetMetadata>("metadata.json");
}

export function getTopologyTreeIds(): string[] {
  return readdirSync(join(DATA_DIR, "trees"))
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) => filename.replace(".json", ""));
}

export function getSummary(): DatasetSummary {
  return readJson<DatasetSummary>("summary.json");
}

export function getSiteMeta(): SiteMeta | null {
  try {
    return readJson<SiteMeta>("site-meta.json");
  } catch {
    return null;
  }
}

export function getVerdicts(): VerdictEntry[] {
  return readJson<VerdictEntry[]>("verdicts.json");
}

export function getFailureProfiles(): FailureProfiles {
  return readJson<FailureProfiles>("failure-profiles.json");
}

export function getBattleIndex(): BattleIndexEntry[] {
  return readJson<BattleIndexEntry[]>("battle-index.json");
}

export function getBattleReplay(id: string): BattleReplay {
  return readJson<BattleReplay>(`battle-replays/${id}.json`);
}
