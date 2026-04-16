# config.py

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from repo root (next to this file)
load_dotenv(Path(__file__).resolve().parent / ".env")

# --- API Key & Retry Strategy ---
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise RuntimeError(
        "OPENROUTER_API_KEY is not set. Add it to .env at the repo root "
        "or export it in your shell before running."
    )
API_MAX_RETRY = 3
API_RETRY_SLEEP = 20

# --- Model Configurations ---

# Models to be tested in the arena
AVAILABLE_SEARCH_MODELS = {
    "claude-opus-4.6-search": {
        "id": "anthropic/claude-opus-4.6",
        "supported_params": [],
    },
    "gemini-3.1-pro-grounding": {
        "id": "google/gemini-3.1-pro-preview",
        "supported_params": [],
    },
    "gpt-5.4-search": {
        "id": "openai/gpt-5.4",
        "supported_params": [],
    },
    "grok-4.20-multi-agent-beta": {
        "id": "x-ai/grok-4.20-multi-agent-beta",
        "supported_params": [],
    },
    "sonar-deep-research": {
        "id": "perplexity/sonar-deep-research",
        "supported_params": ["temperature", "max_tokens"],
    },
    "Kimi-k2.5": {
        "id": "moonshotai/kimi-k2.5",
        "supported_params": [],
    },
    "glm-5.1": {
        "id": "z-ai/glm-5.1",
        "supported_params": [],
    },

    # ---- Previously evaluated / leaderboard models ----
    "grok-4-fast-search": {
        "id": "x-ai/grok-4-fast",
        "supported_params": [],
    },
    "gemini-2.5-pro-grounding": {
        "id": "google/gemini-2.5-pro",
        "supported_params": [],
    },
    "o3-search": {
        "id": "openai/o3",
        "supported_params": [],
    },
    "grok-4-search": {
        "id": "x-ai/grok-4",
        "supported_params": [],
    },
    "ppl-sonar-pro-high": {
        "id": "perplexity/sonar-pro",
        "supported_params": [],
    },
    "gpt-5.1-search": {
        "id": "openai/gpt-5.1",
        "supported_params": [],
    },
    "gpt-5-search": {
        "id": "openai/gpt-5",
        "supported_params": [],
    },
    "claude-opus-4-search": {
        "id": "anthropic/claude-opus-4",
        "supported_params": [],
    },
    "claude-opus-4-1-search": {
        "id": "anthropic/claude-opus-4.1",
        "supported_params": [],
    },
    "ppl-sonar-reasoning-pro-high": {
        "id": "perplexity/sonar-reasoning-pro",
        "supported_params": [],
    },
    "tongyi-deep-research": {
        "id": "alibaba/tongyi-deepresearch-30b-a3b",
        "supported_params": [],
    },
    "api-gpt-4o-search": {
        "id": "openai/gpt-4o-search-preview",
        "supported_params": [],
    },
    "gpt4o-mini-search": {
        "id": "openai/gpt-4o-mini-search-preview",
        "supported_params": [],
    },
    "minimax-m2.1": {
        "id": "minimax/minimax-m2.1",
        "supported_params": [],
    },
    "Qwen3-235b-a22b": {
        "id": "qwen/qwen3-235b-a22b-2507",
        "supported_params": [],
    },
    "Kimi-k2": {
        "id": "moonshotai/kimi-k2-thinking",
        "supported_params": [],
    },
    "deepseek-v3.2": {
        "id": "deepseek/deepseek-v3.2",
        "supported_params": [],
    },
    "seed-1.6": {
        "id": "bytedance-seed/seed-1.6",
        "supported_params": [],
    },
    "glm-4.7": {
        "id": "z-ai/glm-4.7",
        "supported_params": [],
    },
    "claude-opus-4.6": {
        "id": "anthropic/claude-opus-4.6",
        "supported_params": [],
    },

    "gpt-5.2-chat": {
        "id": "openai/gpt-5.2-chat",
        "supported_params": []
    },
}

TASK_GENERATOR_MODEL_CONFIG = {
    "id": "openai/gpt-5.2-chat", #anthropic/claude-opus-4.6, google/gemini-3-pro-preview, openai/gpt-5.2-chat
    "supported_params": ["temperature"]
}
# Hyperparameters
MIN_ROUNDS = 1
MAX_ROUNDS = 10
WIN_THRESHOLD = 2.0
ESTIMATED_COST_PER_1M_TOKENS = 10.0
