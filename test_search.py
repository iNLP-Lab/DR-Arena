"""
Smoke test for search behavior across one or more model sets.

Examples:
    python test_search.py gpt-5.4-search
    python test_search.py --group tournament
    python test_search.py --group leaderboard --output leaderboard_search_test.txt
    python test_search.py --group all --output all_search_test.txt
"""

import argparse
import json
from datetime import datetime

from openai import OpenAI

import config


DEFAULT_WEB_SEARCH_TOOL = [
    {
        "type": "openrouter:web_search",
        "parameters": {
            "engine": "auto",
            "max_results": 5,
            "max_total_results": 15,
        },
    }
]


EXTRA_MODELS = {
    "claude-opus-4-6-search": {
        "id": "anthropic/claude-opus-4.6",
        "supported_params": [],
    },
    "claude-sonnet-4-6-search": {
        "id": "anthropic/claude-sonnet-4.6",
        "supported_params": [],
    },
    "gpt-5.2-search": {
        "id": "openai/gpt-5.2",
        "supported_params": [],
    },
    "gemini-3-flash-grounding": {
        "id": "google/gemini-3-flash-preview",
        "supported_params": [],
    },
    "grok-4.20-multi-agent-beta-0309": {
        "id": "x-ai/grok-4.20-multi-agent-beta",
        "supported_params": [],
    },
    "gemini-3-pro-grounding": {
        "id": "google/gemini-3-pro-preview",
        "supported_params": [],
    },
    "grok-4.20-beta1": {
        "id": "x-ai/grok-4.20-beta",
        "supported_params": [],
    },
}


# Based on all_search_test.txt, these already showed strong evidence of live search.
VERIFIED_SEARCH_MODELS = {
    "claude-opus-4.6-search",
    "claude-opus-4-6-search",
    "gemini-3.1-pro-grounding",
    "gpt-5.4-search",
}


GROUPS = {
    "tournament": [
        "grok-4.20-multi-agent-beta",
        "sonar-deep-research",
        "Kimi-k2.5",
        "glm-5.1",
    ],
    "leaderboard": [
        "claude-sonnet-4-6-search",
        "gpt-5.2-search",
        "gemini-3-flash-grounding",
        "grok-4.20-multi-agent-beta-0309",
        "gemini-3-pro-grounding",
        "grok-4.20-beta1",
        "gpt-5.1-search",
    ],
    "redo": [
        "tongyi-deep-research",
        "minimax-m2.1",
    ],
    "tool_probe": [
        "tongyi-deep-research",
        "minimax-m2.1",
    ],
}
GROUPS["verified"] = sorted(VERIFIED_SEARCH_MODELS)
GROUPS["all"] = GROUPS["tournament"] + [
    model for group in ("leaderboard", "redo") for model in GROUPS[group] if model not in GROUPS["tournament"]
]


QUESTION = (
    "What are the 3 most recent major AI model releases (within the past month)? "
    "For each one, give the release date and the official source URL. "
    "Do not guess — only include releases you can verify with a real source."
)


def build_model_catalog():
    catalog = dict(config.AVAILABLE_SEARCH_MODELS)
    for key, spec in EXTRA_MODELS.items():
        if key not in catalog:
            catalog[key] = spec
    return catalog


def resolve_targets(args, catalog):
    if args.group:
        return GROUPS[args.group]
    return [args.model_key]


def make_writer(output_path):
    handle = open(output_path, "w", encoding="utf-8") if output_path else None

    def write(text=""):
        print(text)
        if handle:
            handle.write(text + "\n")

    return write, handle


def safe_model_dump(obj):
    if obj is None:
        return None
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if hasattr(obj, "dict"):
        return obj.dict()
    return str(obj)


def json_block(value):
    return json.dumps(value, indent=2, ensure_ascii=False, default=str)


def run_single_test(client, model_key, model_config, use_tools, debug_raw, write):
    api_kwargs = {}
    if use_tools:
        api_kwargs["tools"] = model_config.get("tools", DEFAULT_WEB_SEARCH_TOOL)

    write("=" * 80)
    write(f"MODEL KEY:  {model_key}")
    write(f"MODEL ID:   {model_config['id']}")
    if use_tools:
        write("PLUGIN:     YES (openrouter:web_search attached)")
    else:
        write("PLUGIN:     NO (relies on the model's own search behavior, if any)")
    write(f"QUESTION:   {QUESTION}")
    write("CALLING OPENROUTER...")
    write("")

    response = client.chat.completions.create(
        model=model_config["id"],
        messages=[{"role": "user", "content": QUESTION}],
        **api_kwargs,
    )

    msg = response.choices[0].message
    content = msg.content
    choice = response.choices[0]
    usage = response.usage
    server_tool_use = safe_model_dump(getattr(usage, "server_tool_use", None))
    tool_calls = safe_model_dump(getattr(msg, "tool_calls", None))

    write("ANSWER")
    write("-" * 80)
    write(str(content))
    write("")

    write("RESPONSE META")
    write("-" * 80)
    write(f"finish_reason: {getattr(choice, 'finish_reason', None)}")
    write(f"tool_calls:    {'present' if tool_calls else 'none'}")
    write(
        "server_tool_use: "
        + (json.dumps(server_tool_use, ensure_ascii=False) if server_tool_use else "none")
    )
    write("")

    write("ANNOTATIONS (URL citations attached by the tool)")
    write("-" * 80)
    annotations = getattr(msg, "annotations", None)
    if annotations:
        for i, annotation in enumerate(annotations, 1):
            write(f"{i}. {annotation}")
        write(f"-> {len(annotations)} citations found.")
    else:
        write("(none)")
        write("-> No annotations on the response.")
    write("")

    write("USAGE")
    write("-" * 80)
    write(f"prompt:     {usage.prompt_tokens}")
    write(f"completion: {usage.completion_tokens}")
    write(f"total:      {usage.total_tokens}")
    write("")

    should_dump_raw = debug_raw or content is None
    if should_dump_raw:
        write("RAW MESSAGE")
        write("-" * 80)
        write(json_block(safe_model_dump(msg)))
        write("")

        write("RAW CHOICE")
        write("-" * 80)
        write(json_block(safe_model_dump(choice)))
        write("")

        write("RAW USAGE")
        write("-" * 80)
        write(json_block(safe_model_dump(usage)))
        write("")

        if debug_raw:
            write("RAW RESPONSE")
            write("-" * 80)
            write(json_block(safe_model_dump(response)))
            write("")


def parse_args():
    parser = argparse.ArgumentParser(description="Smoke test OpenRouter web search across one or more models.")
    parser.add_argument("model_key", nargs="?", help="Single model key to test.")
    parser.add_argument(
        "--group",
        choices=sorted(GROUPS.keys()),
        help="Run a predefined model group instead of a single model key.",
    )
    parser.add_argument(
        "--output",
        help="Optional text file to write the full output to.",
    )
    parser.add_argument(
        "--with-tools",
        action="store_true",
        help="Attach OpenRouter web search tools to the request.",
    )
    parser.add_argument(
        "--debug-raw",
        action="store_true",
        help="Dump raw message/choice/usage objects. Full response is dumped too when enabled.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    catalog = build_model_catalog()

    if not args.group and not args.model_key:
        print("Usage: python test_search.py <model_key>")
        print("   or: python test_search.py --group <group_name> [--output file.txt]")
        print()
        print("Available groups:")
        for group_name, members in GROUPS.items():
            print(f"  {group_name:12} {', '.join(members)}")
        print()
        print("Available models:")
        for key in sorted(catalog):
            tag = "[verified]" if key in VERIFIED_SEARCH_MODELS else "[pending]"
            print(f"  {tag:12} {key}")
        return

    if args.group and args.model_key:
        raise SystemExit("Use either a single model key or --group, not both.")

    targets = resolve_targets(args, catalog)
    unknown = [key for key in targets if key not in catalog]
    if unknown:
        raise SystemExit(f"Unknown models: {', '.join(unknown)}")

    write, handle = make_writer(args.output)
    try:
        write(f"Started:    {datetime.now().isoformat(timespec='seconds')}")
        write(f"Target set: {args.group or args.model_key}")
        write(f"With tools: {'yes' if args.with_tools else 'no'}")
        write("")

        client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=config.OPENROUTER_API_KEY,
        )

        for model_key in targets:
            try:
                run_single_test(
                    client,
                    model_key,
                    catalog[model_key],
                    args.with_tools,
                    args.debug_raw,
                    write,
                )
            except Exception as exc:
                write("=" * 80)
                write(f"MODEL KEY:  {model_key}")
                write(f"ERROR:      {exc}")
                write("")
    finally:
        if handle:
            handle.close()


if __name__ == "__main__":
    main()
