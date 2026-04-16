#!/usr/bin/env python3
"""
build-data.py — Transform tournament results into dashboard-ready JSON.

Reads from:  DR-Arena/tournament_results_cli_12models/
Writes to:   web/public/data/
  - leaderboard.json
  - battles.json
  - pairwise.json
  - model-meta.json
  - verdicts.json
  - failure-profiles.json
  - battle-index.json
  - battle-replays/*.json

Also copies:
  web_tree/data/dataset/metadata.json → web/public/data/metadata.json
  web_tree/data/dataset/summary.json  → web/public/data/summary.json
"""

from __future__ import annotations

import csv
import json
import re
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
TOURNAMENT_DIR = REPO_ROOT / "tournament_results_cli_12models"
OUT_DIR = REPO_ROOT / "web" / "public" / "data"
REPLAY_DIR = OUT_DIR / "battle-replays"
SITE_META_OUT = OUT_DIR / "site-meta.json"

# Source files for copy
METADATA_SRC = REPO_ROOT / "web_tree" / "data" / "dataset" / "metadata.json"
SUMMARY_SRC = REPO_ROOT / "web_tree" / "data" / "dataset" / "summary.json"
FAILURE_TYPES = ("DEEP", "WIDE", "BOTH", "NONE")

# Model metadata — hand-maintained per design doc §13A
MODEL_META = {
    "gpt-5.1-search": {
        "provider": "OpenAI",
        "color": "#10A37F",
        "short_name": "GPT-5.1",
    },
    "gemini-2.5-pro-grounding": {
        "provider": "Google",
        "color": "#4285F4",
        "short_name": "Gemini 2.5 Pro",
    },
    "o3-search": {
        "provider": "OpenAI",
        "color": "#0EA5E9",
        "short_name": "o3",
    },
    "grok-4-search": {
        "provider": "xAI",
        "color": "#E5484D",
        "short_name": "Grok 4",
    },
    "claude-opus-4-1-search": {
        "provider": "Anthropic",
        "color": "#D97706",
        "short_name": "Claude Opus 4.1",
    },
    "Kimi-k2": {
        "provider": "Moonshot AI",
        "color": "#8B5CF6",
        "short_name": "Kimi K2",
    },
    "ppl-sonar-pro-high": {
        "provider": "Perplexity",
        "color": "#22D3EE",
        "short_name": "Sonar Pro",
    },
    "deepseek-v3.2": {
        "provider": "DeepSeek",
        "color": "#3B82F6",
        "short_name": "DeepSeek V3.2",
    },
    "glm-4.7": {
        "provider": "Zhipu AI",
        "color": "#F59E0B",
        "short_name": "GLM-4.7",
    },
    "Qwen3-235b-a22b": {
        "provider": "Alibaba",
        "color": "#F97316",
        "short_name": "Qwen3-235B",
    },
    "seed-1.6": {
        "provider": "ByteDance",
        "color": "#EC4899",
        "short_name": "Seed 1.6",
    },
}

# -----------------------------------------------------------------------------
# Auto-meta for models not listed in MODEL_META above.
#
# Goal: adding a new model should be zero-config — infer provider/color/name
# from the model key alone. Manual MODEL_META entries still take precedence
# (use them when you want hand-picked display values).
# -----------------------------------------------------------------------------

# Vendor → canonical provider name + single brand color. Models from the same
# provider intentionally share one color across the UI.
VENDOR_BRAND = {
    "anthropic":  {"name": "Anthropic",   "color": "#D97706"},
    "openai":     {"name": "OpenAI",      "color": "#10A37F"},
    "google":     {"name": "Google",      "color": "#4285F4"},
    "x-ai":       {"name": "xAI",         "color": "#E5484D"},
    "moonshotai": {"name": "Moonshot AI", "color": "#8B5CF6"},
    "deepseek":   {"name": "DeepSeek",    "color": "#3B82F6"},
    "z-ai":       {"name": "Zhipu AI",    "color": "#F59E0B"},
    "alibaba":    {"name": "Alibaba",     "color": "#F97316"},
    "bytedance":  {"name": "ByteDance",   "color": "#EC4899"},
    "perplexity": {"name": "Perplexity",  "color": "#22D3EE"},
    "minimax":    {"name": "MiniMax",     "color": "#14B8A6"},
}

# Substrings → vendor key. First match wins, order matters for ambiguous cases.
VENDOR_KEYWORDS = [
    ("anthropic",  ["claude"]),
    ("openai",     ["gpt", "gpt4o", "o3", "o4"]),
    ("google",     ["gemini"]),
    ("x-ai",       ["grok"]),
    ("moonshotai", ["kimi"]),
    ("deepseek",   ["deepseek"]),
    ("z-ai",       ["glm", "zhipu"]),
    ("alibaba",    ["qwen", "tongyi"]),
    ("bytedance",  ["seed"]),
    ("perplexity", ["sonar", "ppl"]),
    ("minimax",    ["minimax"]),
]

# Decorator suffixes stripped from the model key before generating a short name
# (e.g. "claude-opus-4.6-search" → "claude-opus-4.6" → "Claude Opus 4.6").
SUFFIX_STRIP_RE = re.compile(
    r"-(search|grounding|chat|preview|beta\d*|high|thinking|multi-agent(?:-beta)?|deep-research)$",
    re.IGNORECASE,
)

# Word-level formatting overrides (keep acronyms uppercase, etc.)
WORD_FORMAT = {
    "gpt": "GPT",
    "glm": "GLM",
    "ppl": "Perplexity",
    "deepseek": "DeepSeek",
    "minimax": "MiniMax",
    "bytedance": "ByteDance",
}


def _infer_vendor(model_key: str) -> str | None:
    key = model_key.lower()
    for vendor, keywords in VENDOR_KEYWORDS:
        if any(kw in key for kw in keywords):
            return vendor
    return None


def _derive_short_name(model_key: str) -> str:
    base = SUFFIX_STRIP_RE.sub("", model_key)
    parts = base.split("-")
    formatted = []
    for part in parts:
        lower = part.lower()
        if re.match(r"^\d", part):                       # version like "4.6", "3.1"
            formatted.append(part)
        elif re.match(r"^o\d+(\.\d+)?$", lower):         # o3, o4
            formatted.append(lower)
        elif re.match(r"^[vk]\d", lower):                # v3.2, k2, k2.5
            formatted.append(part.upper())
        elif lower in WORD_FORMAT:
            formatted.append(WORD_FORMAT[lower])
        else:
            formatted.append(part.capitalize())
    return " ".join(formatted)


def canonical_provider_meta(model_key: str) -> tuple[str, str]:
    vendor = _infer_vendor(model_key)
    brand = VENDOR_BRAND.get(vendor) if vendor else None
    if not brand:
        return ("Unknown", "#64748B")
    return (brand["name"], brand["color"])


def auto_model_meta(model_key: str) -> dict:
    """Auto-derive provider/color/short_name for a model key."""
    provider, color = canonical_provider_meta(model_key)
    return {
        "provider": provider,
        "color": color,
        "short_name": _derive_short_name(model_key),
    }


def normalize_model_meta(model_meta: dict[str, dict[str, str]]) -> dict[str, dict[str, str]]:
    """Force a single canonical color per provider across all model entries."""
    normalized: dict[str, dict[str, str]] = {}
    for model_key, meta in model_meta.items():
        provider, color = canonical_provider_meta(model_key)
        normalized[model_key] = {
            **meta,
            "provider": provider,
            "color": color,
        }
    return normalized


def parse_leaderboard_csv(path: Path) -> dict[str, float]:
    """Parse leaderboard CSV into {model: elo} dict.

    Tolerates two formats:
      - Old tournament runner: first row is a pandas index header (",0")
      - add_model.py: no header, data starts on line 1
    """
    elos = {}
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue
            try:
                elos[row[0].strip()] = float(row[1])
            except ValueError:
                # Header row (e.g. ",0" or "model,elo") — skip
                continue
    return elos


def parse_debate_history(path: Path) -> list[dict]:
    """Parse all_debate_history.jsonl into list of match dicts."""
    matches = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            matches.append(json.loads(line))
    return matches


def resolve_winner(entry: dict) -> str | None:
    """
    Resolve the winner model name from a debate history entry.

    For ties (score_a == score_b), returns None.
    For non-ties, extracts model name from the winner string parenthetical.
    """
    result = entry["result"]
    if result["score_a"] == result["score_b"]:
        return None

    winner_str = result["winner"]
    if winner_str == "Tie":
        return None

    match = re.search(r"\((.+?)\)", winner_str)
    return match.group(1) if match else None


def make_battle_id(entry: dict, idx: int) -> str:
    """Generate a stable summary ID for a battle entry."""
    gk = entry["gamekey"]
    tree = gk[0]
    model_a = gk[1][:10].replace(".", "").replace("-", "")
    model_b = gk[2][:10].replace(".", "").replace("-", "")
    return f"{tree}_{model_a}_vs_{model_b}_{idx}"


def build_leaderboard(elos: dict[str, float], matches: list[dict]) -> list[dict]:
    """Build leaderboard.json from Elo ratings and match history."""
    stats: dict[str, dict[str, int]] = defaultdict(
        lambda: {"wins": 0, "losses": 0, "ties": 0, "matches": 0}
    )

    for entry in matches:
        model_a = entry["gamekey"][1]
        model_b = entry["gamekey"][2]
        winner = resolve_winner(entry)

        stats[model_a]["matches"] += 1
        stats[model_b]["matches"] += 1

        if winner is None:
            stats[model_a]["ties"] += 1
            stats[model_b]["ties"] += 1
        elif winner == model_a:
            stats[model_a]["wins"] += 1
            stats[model_b]["losses"] += 1
        elif winner == model_b:
            stats[model_b]["wins"] += 1
            stats[model_a]["losses"] += 1

    leaderboard = []
    for rank, (model, elo) in enumerate(sorted(elos.items(), key=lambda x: -x[1]), start=1):
        s = stats.get(model, {"wins": 0, "losses": 0, "ties": 0, "matches": 0})
        leaderboard.append(
            {
                "rank": rank,
                "model": model,
                "elo": round(elo, 2),
                "matches": s["matches"],
                "wins": s["wins"],
                "losses": s["losses"],
                "ties": s["ties"],
            }
        )
    return leaderboard


def build_pairwise(matches: list[dict], models: list[str]) -> dict:
    """Build pairwise.json — head-to-head win rate matrix."""
    n = len(models)
    model_idx = {m: i for i, m in enumerate(models)}
    wins = [[0] * n for _ in range(n)]
    counts = [[0] * n for _ in range(n)]

    for entry in matches:
        model_a = entry["gamekey"][1]
        model_b = entry["gamekey"][2]
        winner = resolve_winner(entry)

        if model_a not in model_idx or model_b not in model_idx:
            continue

        i, j = model_idx[model_a], model_idx[model_b]
        counts[i][j] += 1
        counts[j][i] += 1

        if winner == model_a:
            wins[i][j] += 1
        elif winner == model_b:
            wins[j][i] += 1

    matrix = [[None] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                matrix[i][j] = None
            elif counts[i][j] > 0:
                matrix[i][j] = round(wins[i][j] / counts[i][j], 4)
            else:
                matrix[i][j] = None

    return {
        "models": models,
        "matrix": matrix,
        "counts": counts,
    }


def load_tree_metadata() -> dict[str, dict[str, Any]]:
    if not METADATA_SRC.exists():
        return {}
    metadata = json.loads(METADATA_SRC.read_text(encoding="utf-8"))
    return {tree["tree_id"]: tree for tree in metadata.get("trees", [])}


def parse_log_identity(log_path: Path, content: str) -> tuple[str | None, str | None, str | None]:
    """Resolve model A/B and tree_id from the log header or filename."""
    start_match = re.search(r"Start Loop: Agent A \((.+?)\) vs Agent B \((.+?)\)", content)
    model_a = start_match.group(1) if start_match else None
    model_b = start_match.group(2) if start_match else None

    tree_match = re.search(r"(tree_\d{4})$", log_path.stem)
    tree_id = tree_match.group(1) if tree_match else None

    stem_match = re.match(r"^R\d+(?:_M\d+)?_(.+?)_vs_(.+?)_tree_\d{4}$", log_path.stem)
    if not stem_match:
        stem_match = re.match(r"^R\d+(?:_M\d+)?_(.+?)_(.+?)_tree_\d{4}$", log_path.stem)
    if stem_match and model_a is None:
        model_a = stem_match.group(1)
        model_b = stem_match.group(2)

    return model_a, model_b, tree_id


def extract_json_block(lines: list[str], start_idx: int) -> tuple[dict | None, int]:
    """Parse the JSON block immediately following a marker line."""
    buffer: list[str] = []
    depth = 0
    seen_open = False
    idx = start_idx

    while idx < len(lines):
        line = lines[idx]
        if not seen_open:
            if "{" not in line:
                idx += 1
                continue
            seen_open = True

        buffer.append(line)
        depth += line.count("{")
        depth -= line.count("}")
        idx += 1

        if seen_open and depth == 0:
            try:
                return json.loads("\n".join(buffer)), idx
            except json.JSONDecodeError:
                return None, idx

    return None, idx


def collect_text_block(lines: list[str], start_idx: int, stop_patterns: tuple[re.Pattern[str], ...]) -> tuple[str, int]:
    """Collect raw text until any stop pattern matches."""
    buffer: list[str] = []
    idx = start_idx
    while idx < len(lines):
        line = lines[idx]
        if any(pattern.search(line) for pattern in stop_patterns):
            break
        buffer.append(line)
        idx += 1
    return "\n".join(buffer).strip(), idx


def normalize_verdict(verdict: str | None) -> str:
    """Convert [[A_MUCH_BETTER]] style tags into stable values."""
    if not verdict:
        return "UNKNOWN"
    return verdict.strip().replace("[[", "").replace("]]", "")


def parse_resources(line: str) -> tuple[int | None, float | None]:
    match = re.search(r"Tokens:\s*([\d,]+)\s*\|\s*Est\. Cost:\s*\$([0-9.]+)", line)
    if not match:
        return None, None
    tokens = int(match.group(1).replace(",", ""))
    cost = float(match.group(2))
    return tokens, cost


def summarize_evolution(lines: list[str]) -> tuple[str | None, str | None]:
    if not lines:
        return None, None

    text = " ".join(lines)
    if "Mercy Rule Triggered" in text:
        return "Mercy rule", "mercy_rule"
    if "BACKTRACK" in text:
        return "Backtrack", "backtrack"
    if "Pressure Test" in text or "PRESSURE TEST" in text:
        return "Pressure test", "pressure_test"
    if "Deep+1 (Drill Down)" in text:
        return "Drill down", "drill_down"
    if "Wide+1 (Increase Context Width)" in text:
        return "Increase width", "increase_width"
    if "Expanding Depth" in text:
        return "Expand depth", "expand_depth"

    cleaned = lines[0].strip()
    return cleaned if cleaned else None, None


def build_round_state(round_data: dict) -> dict:
    return {
        "round": round_data["round"],
        "depth": round_data.get("depth"),
        "width": round_data.get("width"),
        "verdict": round_data.get("verdict"),
        "failure_type": round_data.get("failure_type"),
        "score_a": round_data.get("score_a"),
        "score_b": round_data.get("score_b"),
        "evolution_kind": round_data.get("evolution", {}).get("kind"),
    }


def round_has_complete_replay_content(round_data: dict) -> bool:
    """Return True only when a round has the core fields needed for a usable replay."""
    verdict = round_data.get("verdict")
    return bool(
        round_data.get("question")
        and round_data.get("answer_a")
        and round_data.get("answer_b")
        and round_data.get("score_a") is not None
        and round_data.get("score_b") is not None
        and verdict
        and verdict != "UNKNOWN"
    )


def has_complete_replay_content(replay: dict) -> bool:
    """A battle is replay-ready only if every round has complete core replay content."""
    rounds = replay.get("rounds", [])
    return bool(rounds) and all(round_has_complete_replay_content(round_data) for round_data in rounds)


def parse_battle_replay(log_path: Path, tree_meta: dict[str, dict[str, Any]]) -> dict | None:
    """Extract replay-capable structured data from a battle log."""
    content = log_path.read_text(encoding="utf-8", errors="replace")
    model_a, model_b, tree_id = parse_log_identity(log_path, content)
    if not model_a or not model_b or not tree_id:
        return None

    overall_match = re.search(r"Overall Domain/Topic:\s*(.+)", content)
    overall_topic = overall_match.group(1).strip() if overall_match else None

    round_re = re.compile(r"=== ROUND (\d+) ===")
    state_re = re.compile(r"\[STATE\]\s+Depth:\s*(\d+)\s*\|\s*Width Constraint:\s*(\d+)")
    logic_re = re.compile(r"\[LOGIC CHAIN\]\s*(.+)")
    agent_a_re = re.compile(r"=== \[AGENT A\] \(([0-9.]+)s\) ===")
    agent_b_re = re.compile(r"=== \[AGENT B\] \(([0-9.]+)s\) ===")
    score_re = re.compile(r"\[SCORE\]\s+A:\s*([0-9.]+)\s*\|\s*B:\s*([0-9.]+)")
    final_score_re = re.compile(r"Final Score:\s+A\s+\(([0-9.]+)\)\s+-\s+B\s+\(([0-9.]+)\)")
    final_winner_re = re.compile(r"WINNER:\s*(.+)")
    final_results_re = re.compile(r"=== FINAL RESULTS")

    answer_stop_patterns = (
        agent_a_re,
        agent_b_re,
        re.compile(r"^\[VERDICT FULL\]"),
        round_re,
        final_results_re,
    )

    lines = content.splitlines()
    rounds: list[dict[str, Any]] = []
    idx = 0

    while idx < len(lines):
        line = lines[idx]
        round_match = round_re.search(line)
        if not round_match:
            idx += 1
            continue

        round_number = int(round_match.group(1))
        round_data: dict[str, Any] = {
            "round": round_number,
            "depth": None,
            "width": None,
            "logic_chain": [],
            "question": None,
            "word_limit_instruction": None,
            "checklist_width": [],
            "checklist_depth": [],
            "rationale": None,
            "source_nodes": [],
            "meta_context_snippet": None,
            "judge_max_limit": None,
            "answer_a": "",
            "answer_b": "",
            "duration_a_seconds": None,
            "duration_b_seconds": None,
            "verdict": "UNKNOWN",
            "tie_quality": "N/A",
            "failure_type": None,
            "judge_reasoning": None,
            "score_a": None,
            "score_b": None,
            "evolution": {"summary": None, "kind": None, "lines": []},
        }

        idx += 1
        while idx < len(lines):
            line = lines[idx]
            if round_re.search(line) or final_results_re.search(line):
                break

            state_match = state_re.search(line)
            if state_match:
                round_data["depth"] = int(state_match.group(1))
                round_data["width"] = int(state_match.group(2))
                idx += 1
                continue

            logic_match = logic_re.search(line)
            if logic_match:
                round_data["logic_chain"] = [part.strip() for part in logic_match.group(1).split("->")]
                idx += 1
                continue

            if line.strip() == "[TASK JSON]":
                payload, next_idx = extract_json_block(lines, idx + 1)
                if payload:
                    round_data["question"] = payload.get("question")
                    round_data["word_limit_instruction"] = payload.get("word_limit_instruction")
                    round_data["checklist_width"] = payload.get("checklist_width", [])
                    round_data["checklist_depth"] = payload.get("checklist_depth", [])
                    round_data["rationale"] = payload.get("rationale")
                    round_data["source_nodes"] = payload.get("source_nodes", [])
                    round_data["meta_context_snippet"] = payload.get("meta_context_snippet")
                    round_data["judge_max_limit"] = payload.get("judge_max_limit")
                idx = next_idx
                continue

            agent_a_match = agent_a_re.search(line)
            if agent_a_match:
                round_data["duration_a_seconds"] = float(agent_a_match.group(1))
                answer, idx = collect_text_block(lines, idx + 1, answer_stop_patterns)
                round_data["answer_a"] = answer
                continue

            agent_b_match = agent_b_re.search(line)
            if agent_b_match:
                round_data["duration_b_seconds"] = float(agent_b_match.group(1))
                answer, idx = collect_text_block(lines, idx + 1, answer_stop_patterns)
                round_data["answer_b"] = answer
                continue

            if line.strip() == "[VERDICT FULL]":
                verdict_payload, next_idx = extract_json_block(lines, idx + 1)
                if verdict_payload:
                    failure_type = verdict_payload.get("loser_failure_type")
                    round_data["verdict"] = normalize_verdict(verdict_payload.get("verdict"))
                    round_data["tie_quality"] = verdict_payload.get("tie_quality", "N/A")
                    round_data["failure_type"] = failure_type if failure_type in FAILURE_TYPES else None
                    round_data["judge_reasoning"] = verdict_payload.get("reasoning")
                idx = next_idx
                continue

            score_match = score_re.search(line)
            if score_match:
                round_data["score_a"] = float(score_match.group(1))
                round_data["score_b"] = float(score_match.group(2))
                evolution_lines: list[str] = []
                idx += 1
                while idx < len(lines):
                    next_line = lines[idx]
                    if round_re.search(next_line) or final_results_re.search(next_line):
                        break
                    if next_line.strip():
                        evolution_lines.append(next_line.strip())
                    idx += 1
                summary, kind = summarize_evolution(evolution_lines)
                round_data["evolution"] = {
                    "summary": summary,
                    "kind": kind,
                    "lines": evolution_lines,
                }
                continue

            idx += 1

        rounds.append(round_data)

    if not rounds:
        return None

    final_score_a = rounds[-1]["score_a"]
    final_score_b = rounds[-1]["score_b"]
    winner = None
    total_tokens = None
    estimated_cost = None

    final_score_match = final_score_re.search(content)
    if final_score_match:
        final_score_a = float(final_score_match.group(1))
        final_score_b = float(final_score_match.group(2))

    final_winner_match = final_winner_re.search(content)
    if final_winner_match:
        raw_winner = final_winner_match.group(1).strip()
        winner_match = re.search(r"\((.+?)\)", raw_winner)
        if winner_match:
            winner = winner_match.group(1)
        elif raw_winner == "Tie":
            winner = None

    resources_match = re.search(r"Resources:\s*(.+)", content)
    if resources_match:
        total_tokens, estimated_cost = parse_resources(resources_match.group(0))

    tournament_round_match = re.match(r"^R(\d+)", log_path.stem)
    pairing_match = re.search(r"_M(\d+)_", log_path.stem)
    battle_type = "onboarding" if "onboarding" in log_path.parent.name else None
    tree_entry = tree_meta.get(tree_id, {})

    return {
        "id": log_path.stem,
        "source_group": log_path.parent.name,
        "source_log": str(log_path.relative_to(TOURNAMENT_DIR)),
        "tree_id": tree_id,
        "tree_title": overall_topic or tree_entry.get("subtopic") or tree_entry.get("topic") or tree_id,
        "tree_topic": tree_entry.get("topic"),
        "tree_subtopic": tree_entry.get("subtopic"),
        "tree_crawled_at": tree_entry.get("crawled_at"),
        "tree_url": tree_entry.get("selected_url") or tree_entry.get("root_url"),
        "model_a": model_a,
        "model_b": model_b,
        "winner": winner,
        "final_score_a": final_score_a,
        "final_score_b": final_score_b,
        "total_rounds": len(rounds),
        "type": battle_type,
        "tournament_round": int(tournament_round_match.group(1)) if tournament_round_match else None,
        "pairing_index": int(pairing_match.group(1)) if pairing_match else None,
        "mercy_rule": "[GAME OVER] Mercy Rule Triggered" in content,
        "overall_topic": overall_topic,
        "questions": [round_data["question"] for round_data in rounds if round_data.get("question")],
        "round_states": [build_round_state(round_data) for round_data in rounds],
        "final_verdict": rounds[-1].get("verdict"),
        "final_failure_type": rounds[-1].get("failure_type"),
        "total_tokens": total_tokens,
        "estimated_cost": estimated_cost,
        "rounds": rounds,
    }


def source_group_rank(source_group: str) -> tuple[int, str]:
    if re.fullmatch(r"round\d+", source_group):
        return (0, source_group)
    if source_group == "onboarding_battles":
        return (1, source_group)
    if source_group == "onboarding_battles1":
        return (2, source_group)
    if source_group == "onboarding_battles2":
        return (3, source_group)
    return (9, source_group)


def official_battle_signature(entry: dict) -> tuple:
    gamekey = entry["gamekey"]
    winner = resolve_winner(entry)
    rounds = entry["result"].get("rounds")
    meta = entry.get("meta", {})
    models = tuple(sorted((gamekey[1], gamekey[2])))
    if meta.get("type") == "onboarding":
        return ("onboarding", gamekey[0], models, rounds, winner, meta.get("round"))
    return ("tournament", gamekey[0], models, rounds, winner)


def replay_signature(replay: dict) -> tuple:
    models = tuple(sorted((replay["model_a"], replay["model_b"])))
    if replay.get("type") == "onboarding":
        return (
            "onboarding",
            replay["tree_id"],
            models,
            replay["total_rounds"],
            replay.get("winner"),
            replay.get("tournament_round"),
        )
    return (
        "tournament",
        replay["tree_id"],
        models,
        replay["total_rounds"],
        replay.get("winner"),
    )


def choose_replay_candidate(candidates: list[dict]) -> tuple[dict | None, bool]:
    if not candidates:
        return None, False
    ordered = sorted(candidates, key=lambda replay: source_group_rank(replay["source_group"]))
    return ordered[0], len(ordered) > 1


def match_replays_to_official(matches: list[dict], replay_candidates: list[dict]) -> tuple[dict[str, dict], dict]:
    buckets: dict[tuple, list[dict]] = defaultdict(list)
    for replay in replay_candidates:
        buckets[replay_signature(replay)].append(replay)

    matched_by_summary_id: dict[str, dict] = {}
    coverage = {
        "official_battles": len(matches),
        "matched_replays": 0,
        "unmatched_battles": 0,
        "ambiguous_candidates": 0,
    }

    for idx, entry in enumerate(matches):
        summary_id = make_battle_id(entry, idx)
        signature = official_battle_signature(entry)
        chosen, ambiguous = choose_replay_candidate(buckets.get(signature, []))
        if chosen:
            matched_by_summary_id[summary_id] = chosen
            coverage["matched_replays"] += 1
            if ambiguous:
                coverage["ambiguous_candidates"] += 1
        else:
            coverage["unmatched_battles"] += 1

    return matched_by_summary_id, coverage


def orient_scores_to_summary(entry: dict, replay: dict | None) -> tuple[float, float]:
    if not replay:
        result = entry["result"]
        return result["score_a"], result["score_b"]

    summary_a = entry["gamekey"][1]
    summary_b = entry["gamekey"][2]
    replay_a = replay["model_a"]
    replay_b = replay["model_b"]
    score_a = replay["final_score_a"]
    score_b = replay["final_score_b"]

    if summary_a == replay_a and summary_b == replay_b:
        return score_a, score_b
    if summary_a == replay_b and summary_b == replay_a:
        return score_b, score_a
    return entry["result"]["score_a"], entry["result"]["score_b"]


def build_battles(matches: list[dict], matched_replays: dict[str, dict]) -> list[dict]:
    """Build battles.json from official match history plus replay mapping."""
    battles = []

    for idx, entry in enumerate(matches):
        summary_id = make_battle_id(entry, idx)
        gamekey = entry["gamekey"]
        winner = resolve_winner(entry)
        meta = entry.get("meta", {})
        replay = matched_replays.get(summary_id)
        replay_id = replay["id"] if replay and has_complete_replay_content(replay) else None
        score_a, score_b = orient_scores_to_summary(entry, replay)

        battle = {
            "id": summary_id,
            "replay_id": replay_id,
            "tree_id": gamekey[0],
            "model_a": gamekey[1],
            "model_b": gamekey[2],
            "score_a": score_a,
            "score_b": score_b,
            "winner": winner,
            "rounds": entry["result"]["rounds"],
        }

        if meta.get("type"):
            battle["type"] = meta["type"]
        if meta.get("round"):
            battle["round"] = meta["round"]
        if meta.get("timestamp"):
            battle["timestamp"] = meta["timestamp"]
        if replay:
            battle["source_group"] = replay["source_group"]

        battles.append(battle)

    return battles


def build_battle_index(
    battles: list[dict],
    matched_replays: dict[str, dict],
    tree_meta: dict[str, dict[str, Any]],
) -> list[dict]:
    """Build battle-index.json for the M6 browser."""
    entries = []

    for battle in battles:
        tree_entry = tree_meta.get(battle["tree_id"], {})
        replay = matched_replays.get(battle["id"])

        entry = {
            "id": battle["id"],
            "replay_id": battle.get("replay_id"),
            "replay_available": battle.get("replay_id") is not None,
            "tree_id": battle["tree_id"],
            "tree_title": (
                replay.get("tree_title")
                if replay
                else tree_entry.get("subtopic") or tree_entry.get("topic") or battle["tree_id"]
            ),
            "tree_topic": replay.get("tree_topic") if replay else tree_entry.get("topic"),
            "model_a": battle["model_a"],
            "model_b": battle["model_b"],
            "score_a": battle["score_a"],
            "score_b": battle["score_b"],
            "winner": battle["winner"],
            "rounds": battle["rounds"],
            "type": battle.get("type"),
            "round": battle.get("round"),
            "tournament_round": replay.get("tournament_round") if replay else battle.get("round"),
            "timestamp": battle.get("timestamp"),
            "source_group": replay.get("source_group") if replay else battle.get("source_group"),
            "question_preview": replay["questions"][0] if replay and replay.get("questions") else None,
            "questions": replay.get("questions", []) if replay else [],
            "final_verdict": replay.get("final_verdict") if replay else None,
            "final_failure_type": replay.get("final_failure_type") if replay else None,
            "total_tokens": replay.get("total_tokens") if replay else None,
            "estimated_cost": replay.get("estimated_cost") if replay else None,
            "round_states": replay.get("round_states", []) if replay else [],
            "overall_topic": replay.get("overall_topic") if replay else None,
        }
        entries.append(entry)

    entries.reverse()  # newest-ish first from append order
    return entries


def build_verdicts_and_failure_profiles(models: list[str], replay_candidates: list[dict]) -> tuple[list[dict], dict]:
    """Build verdicts.json and failure-profiles.json from parsed log rounds."""
    verdicts: list[dict] = []

    zero_counts = {failure_type: 0 for failure_type in FAILURE_TYPES}
    model_counts = {
        model: {
            "counts": dict(zero_counts),
            "total": 0,
        }
        for model in models
    }
    population_counts = dict(zero_counts)
    coverage = {
        "logs_total": len(list(TOURNAMENT_DIR.rglob("*.log"))),
        "logs_with_verdicts": 0,
        "rounds_total": 0,
        "rounds_with_failure_type": 0,
        "attributed_events": 0,
    }

    for replay in replay_candidates:
        verdict_rounds = []
        for round_data in replay["rounds"]:
            verdict_rounds.append(
                {
                    "round": round_data["round"],
                    "verdict": round_data["verdict"],
                    "tie_quality": round_data["tie_quality"],
                    "failure_type": round_data["failure_type"],
                    "score_a": round_data["score_a"],
                    "score_b": round_data["score_b"],
                }
            )

        if not verdict_rounds:
            continue

        verdicts.append(
            {
                "battle_id": replay["id"],
                "source_group": replay["source_group"],
                "tree_id": replay["tree_id"],
                "model_a": replay["model_a"],
                "model_b": replay["model_b"],
                "rounds": verdict_rounds,
            }
        )
        coverage["logs_with_verdicts"] += 1
        coverage["rounds_total"] += len(verdict_rounds)

        for round_data in verdict_rounds:
            failure_type = round_data.get("failure_type")
            if failure_type in FAILURE_TYPES:
                coverage["rounds_with_failure_type"] += 1

            for model in attribute_failure_models(replay["model_a"], replay["model_b"], round_data):
                if model not in model_counts:
                    continue
                model_counts[model]["counts"][failure_type] += 1
                model_counts[model]["total"] += 1
                population_counts[failure_type] += 1
                coverage["attributed_events"] += 1

    population_total = sum(population_counts.values()) or 1
    profiles = {}
    for model in models:
        counts = model_counts[model]["counts"]
        total = model_counts[model]["total"]
        denom = total or 1
        profiles[model] = {
            "counts": counts,
            "total": total,
            "distribution": {
                failure_type: round(counts[failure_type] / denom, 4)
                for failure_type in FAILURE_TYPES
            },
        }

    failure_profiles = {
        "models": profiles,
        "population_average": {
            failure_type: round(population_counts[failure_type] / population_total, 4)
            for failure_type in FAILURE_TYPES
        },
        "coverage": coverage,
    }

    return verdicts, failure_profiles


def attribute_failure_models(model_a: str, model_b: str, round_data: dict) -> list[str]:
    """Map a judged answer failure to the model(s) it should count against."""
    failure_type = round_data.get("failure_type")
    if failure_type not in FAILURE_TYPES:
        return []

    score_a = round_data.get("score_a")
    score_b = round_data.get("score_b")
    if score_a is None or score_b is None:
        return []

    if score_a == score_b:
        return [model_a, model_b] if round_data.get("tie_quality") == "LOW" else []
    if score_a > score_b:
        return [model_b]
    return [model_a]


def write_json(data: Any, path: Path, label: str, *, report: bool = True):
    """Write JSON file with size reporting."""
    out = json.dumps(data, ensure_ascii=False, indent=2)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(out, encoding="utf-8")
    if report:
        size = len(out.encode("utf-8"))
        print(f"  {label}: {path.relative_to(OUT_DIR)} ({size/1024:.1f} KB)")


def latest_mtime_iso(paths: list[Path]) -> str | None:
    """Return the newest file mtime as an ISO-8601 timestamp with local offset."""
    existing = [path for path in paths if path.exists()]
    if not existing:
        return None

    latest_mtime = max(path.stat().st_mtime for path in existing)
    return datetime.fromtimestamp(latest_mtime).astimezone().isoformat(timespec="seconds")


def main():
    if not TOURNAMENT_DIR.exists():
        print(f"Error: tournament directory not found: {TOURNAMENT_DIR}", file=sys.stderr)
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tree_meta = load_tree_metadata()

    print("Parsing tournament results...")
    elos = parse_leaderboard_csv(TOURNAMENT_DIR / "current_leaderboard.csv")
    matches = parse_debate_history(TOURNAMENT_DIR / "all_debate_history.jsonl")
    print(f"  {len(elos)} models, {len(matches)} official matches")

    print("Parsing battle logs for replay data...")
    replay_candidates = []
    for log_path in sorted(TOURNAMENT_DIR.rglob("*.log")):
        replay = parse_battle_replay(log_path, tree_meta)
        if replay:
            replay_candidates.append(replay)
    print(f"  {len(replay_candidates)} replay-capable logs parsed")

    models = sorted(elos.keys(), key=lambda model: -elos[model])
    matched_replays, replay_coverage = match_replays_to_official(matches, replay_candidates)
    print(
        "  Replay coverage: "
        f"{replay_coverage['matched_replays']} matched / {replay_coverage['official_battles']} official, "
        f"{replay_coverage['unmatched_battles']} unmatched, "
        f"{replay_coverage['ambiguous_candidates']} chosen from duplicate candidates"
    )

    print("\nBuilding output files...")
    leaderboard = build_leaderboard(elos, matches)
    write_json(leaderboard, OUT_DIR / "leaderboard.json", "Leaderboard")

    battles = build_battles(matches, matched_replays)
    write_json(battles, OUT_DIR / "battles.json", "Battles")

    pairwise = build_pairwise(matches, models)
    write_json(pairwise, OUT_DIR / "pairwise.json", "Pairwise")

    # Auto-generate entries for models in the leaderboard but not in MODEL_META.
    # Hand-curated MODEL_META entries above take precedence; anything new gets
    # a brand-inferred entry via auto_model_meta(). Adding a model to the arena
    # requires zero edits to this file as long as its vendor is in VENDOR_KEYWORDS.
    for model in models:
        if model not in MODEL_META:
            MODEL_META[model] = auto_model_meta(model)
            print(f"  Auto-meta for '{model}': {MODEL_META[model]}")

    normalized_model_meta = normalize_model_meta(MODEL_META)
    write_json(normalized_model_meta, OUT_DIR / "model-meta.json", "Model meta")

    battle_index = build_battle_index(battles, matched_replays, tree_meta)
    write_json(battle_index, OUT_DIR / "battle-index.json", "Battle index")

    if REPLAY_DIR.exists():
        shutil.rmtree(REPLAY_DIR)
    REPLAY_DIR.mkdir(parents=True, exist_ok=True)
    replay_written = 0
    for battle in battles:
        replay = matched_replays.get(battle["id"])
        if not replay or battle.get("replay_id") is None:
            continue
        replay_payload = dict(replay)
        replay_payload["summary_id"] = battle["id"]
        write_json(
            replay_payload,
            REPLAY_DIR / f"{replay['id']}.json",
            f"Replay {replay['id']}",
            report=False,
        )
        replay_written += 1
    print(f"  Replay files written: {replay_written}")

    verdicts, failure_profiles = build_verdicts_and_failure_profiles(models, replay_candidates)
    write_json(verdicts, OUT_DIR / "verdicts.json", "Verdicts")
    write_json(failure_profiles, OUT_DIR / "failure-profiles.json", "Failure profiles")

    site_meta = {
        "tournament_last_updated_at": latest_mtime_iso([
            TOURNAMENT_DIR / "current_leaderboard.csv",
            TOURNAMENT_DIR / "all_debate_history.jsonl",
        ]),
        "tournament_source_files": [
            "tournament_results_cli_12models/current_leaderboard.csv",
            "tournament_results_cli_12models/all_debate_history.jsonl",
        ],
    }
    write_json(site_meta, SITE_META_OUT, "Site meta")

    print("\nCopying metadata files...")
    for src, label in ((METADATA_SRC, "metadata.json"), (SUMMARY_SRC, "summary.json")):
        dst = OUT_DIR / label
        if src.exists():
            shutil.copy2(src, dst)
            print(f"  {label}: {dst.stat().st_size/1024:.1f} KB")
        else:
            print(f"  Warning: {src} not found, skipping", file=sys.stderr)

    print(f"\nDone. Output: {OUT_DIR}")


if __name__ == "__main__":
    main()
