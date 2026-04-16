import type { Battle, FailureProfileEntry, FailureType } from "./types";

export function modelToSlug(model: string): string {
  return model
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function slugToModel(models: string[], slug: string): string | null {
  return models.find((model) => modelToSlug(model) === slug) ?? null;
}

export function getPrimaryFailureType(profile?: FailureProfileEntry): FailureType | null {
  if (!profile || profile.total === 0) return null;

  const ordered: FailureType[] = ["BOTH", "DEEP", "WIDE", "NONE"];
  let best: FailureType = ordered[0];

  for (const type of ordered) {
    if (profile.distribution[type] > profile.distribution[best]) {
      best = type;
    }
  }

  return best;
}

export function formatFailureType(type: FailureType | null): string {
  switch (type) {
    case "DEEP":
      return "Deep reasoning";
    case "WIDE":
      return "Wide coverage";
    case "BOTH":
      return "Deep + wide";
    case "NONE":
      return "Soft-factor loss";
    default:
      return "No taxonomy signal";
  }
}

export function getBattleOutcome(model: string, battle: Battle): "W" | "L" | "T" {
  if (battle.winner === null) return "T";
  return battle.winner === model ? "W" : "L";
}

export function formatVerdictTag(verdict: string | null | undefined): string {
  switch (verdict) {
    case "A_MUCH_BETTER":
    case "B_MUCH_BETTER":
      return "Much Better";
    case "A_BETTER":
    case "B_BETTER":
      return "Better";
    case "Tie":
    case "TIE":
      return "Tie";
    case "UNKNOWN":
      return "Unknown";
    default:
      return verdict ? verdict.replaceAll("_", " ") : "Summary";
  }
}

export function verdictTone(verdict: string | null | undefined): "strong" | "mid" | "tie" | "neutral" {
  switch (verdict) {
    case "A_MUCH_BETTER":
    case "B_MUCH_BETTER":
      return "strong";
    case "A_BETTER":
    case "B_BETTER":
      return "mid";
    case "Tie":
    case "TIE":
      return "tie";
    default:
      return "neutral";
  }
}
