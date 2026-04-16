#!/usr/bin/env python3
"""
prepare-trees.py — Strip raw tree JSONs to topology-only for the dashboard.

Reads from:  web_tree/data/dataset/trees/*.json  (1.4 GB total)
Writes to:   web/public/data/trees/*.json         (~16 MB total)

Keeps: url, title, domain, depth, crawled, error, relationship_cluster (as "rc"), children
Drops: content, description, link_contexts, surrounding_text
"""

import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RAW_TREES_DIR = REPO_ROOT / "web_tree" / "data" / "dataset" / "trees"
OUT_TREES_DIR = REPO_ROOT / "web" / "public" / "data" / "trees"

# Files that are duplicates or artifacts — skip them
SKIP_FILES = {
    "tree_0028 2.json",
    "tree_0028 3.json",
}


def strip_node(node: dict) -> dict:
    """Recursively strip a tree node to topology-only fields."""
    stripped = {
        "url": node.get("url", ""),
        "title": node.get("title", ""),
        "domain": node.get("domain", ""),
        "depth": node.get("depth", 0),
        "crawled": node.get("crawled", False),
    }

    if node.get("error"):
        stripped["error"] = node["error"]

    rc = node.get("relationship_cluster")
    if rc:
        stripped["rc"] = rc

    children = node.get("children", [])
    if children:
        stripped["children"] = [strip_node(c) for c in children]

    return stripped


def count_nodes(node: dict) -> int:
    """Count total nodes in a tree."""
    return 1 + sum(count_nodes(c) for c in node.get("children", []))


def main():
    if not RAW_TREES_DIR.exists():
        print(f"Error: raw trees directory not found: {RAW_TREES_DIR}", file=sys.stderr)
        sys.exit(1)

    OUT_TREES_DIR.mkdir(parents=True, exist_ok=True)

    tree_files = sorted(
        f for f in os.listdir(RAW_TREES_DIR)
        if f.endswith(".json") and f not in SKIP_FILES
    )

    print(f"Processing {len(tree_files)} tree files...")
    total_raw = 0
    total_out = 0

    for filename in tree_files:
        raw_path = RAW_TREES_DIR / filename
        out_path = OUT_TREES_DIR / filename

        raw_size = raw_path.stat().st_size
        total_raw += raw_size

        with open(raw_path, "r") as f:
            tree = json.load(f)

        stripped = strip_node(tree)
        nodes = count_nodes(stripped)

        out_json = json.dumps(stripped, ensure_ascii=False, separators=(",", ":"))
        with open(out_path, "w") as f:
            f.write(out_json)

        out_size = len(out_json.encode("utf-8"))
        total_out += out_size

        reduction = (1 - out_size / raw_size) * 100 if raw_size > 0 else 0
        print(f"  {filename}: {raw_size/1024:.0f}KB → {out_size/1024:.0f}KB "
              f"({reduction:.0f}% reduction, {nodes} nodes)")

    print(f"\nDone. {len(tree_files)} trees processed.")
    print(f"Total: {total_raw/1024/1024:.1f}MB → {total_out/1024/1024:.1f}MB "
          f"({(1 - total_out/total_raw)*100:.1f}% reduction)")
    print(f"Output: {OUT_TREES_DIR}")


if __name__ == "__main__":
    main()
