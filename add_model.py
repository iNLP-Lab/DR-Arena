"""
add_model.py — Batch onboarding for new models into an existing DR-Arena leaderboard.

Uses a Swiss-system approach (aligned with Auto-Arena):
  - ceil(log2(N)) rounds per new model
  - Round 1: median-region opponents from existing leaderboard
  - Round 2+: closest-Elo opponent, no rematches
  - New models can play each other
  - Elo recomputed globally after each round

Usage:
    python add_model.py \
        --models "gpt-5-search,claude-opus-4-search" \
        --output-dir ./tournament_results_cli_12models \
        --workers 4
"""

import os
import sys
import json
import argparse
import math
import logging
import random
import signal
import filelock
import pandas as pd
from datetime import datetime
from concurrent.futures import ProcessPoolExecutor, as_completed


def _init_worker():
    """ProcessPoolExecutor initializer: make workers ignore SIGINT and SIGTERM
    so that shutdown signals hit only the parent. The parent then cancels
    pending futures and force-kills in-flight workers explicitly."""
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    signal.signal(signal.SIGTERM, signal.SIG_IGN)

# ================= Path setup =================
script_dir = os.path.dirname(os.path.abspath(__file__))
web_tree_dir = os.path.join(script_dir, 'web_tree')

if web_tree_dir not in sys.path:
    sys.path.insert(0, web_tree_dir)
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

from core.score_utils import compute_mle_elo

TREE_DIR = os.path.join(script_dir, "web_tree/data/dataset/trees")
INIT_RATING = 1000

# Hard wall-clock timeout per battle. A well-behaved battle completes in
# ~2-5 minutes; 900s (15 min) is a safety net for catching runaway crawls,
# stuck API retries, or judge loops. See batch-onboarding-plan.md Known
# Issues #6 (2026-04-11). Timed-out battles are NOT written to the JSONL
# and will be retried on the next resume.
MAX_BATTLE_SECONDS = 900

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("BatchOnboard")


# ================= Helpers =================

def get_tree_files():
    target_files = []
    for i in range(1, 31):
        fname = f"tree_{i:04d}.json"
        fpath = os.path.join(TREE_DIR, fname)
        if os.path.exists(fpath):
            target_files.append(fpath)
    return target_files


def load_history(debate_file):
    """Load all debate history and compute Elo, match history, and completed tasks."""
    results_for_elo = []
    match_history = {}
    participants = set()
    completed_tasks = set()

    if os.path.exists(debate_file):
        with open(debate_file, 'r') as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    data = json.loads(line)
                    gk = data.get("gamekey")
                    result = data.get("result", {})
                    meta = data.get("meta", {})

                    if gk and result:
                        tree_id, m_a, m_b = gk[0], gk[1], gk[2]
                        participants.add(m_a)
                        participants.add(m_b)

                        if m_a not in match_history:
                            match_history[m_a] = set()
                        if m_b not in match_history:
                            match_history[m_b] = set()
                        match_history[m_a].add(m_b)
                        match_history[m_b].add(m_a)

                        r_num = meta.get("round", 1)
                        completed_tasks.add(f"R{r_num}_{m_a}_{m_b}_{tree_id}")
                        completed_tasks.add(f"R{r_num}_{m_b}_{m_a}_{tree_id}")

                        raw_winner = result.get("winner", "Tie")
                        winner_code = "tie"
                        if m_a in raw_winner:
                            winner_code = "A"
                        elif m_b in raw_winner:
                            winner_code = "B"

                        results_for_elo.append({
                            "gamekey": gk,
                            "winner": winner_code,
                            "final_winner": [winner_code],
                            "judges": ["system_auto"]
                        })
                except Exception:
                    pass

    scores = {p: INIT_RATING for p in participants}
    if results_for_elo:
        try:
            dict_ratings, _ = compute_mle_elo(
                results_for_elo, judge_debate_rounds=0, INIT_RATING=INIT_RATING
            )
            for m, s in dict_ratings.items():
                scores[m] = float(s)
        except Exception as e:
            logger.error(f"Error computing Elo: {e}")

    return scores, match_history, participants, completed_tasks


def recompute_and_save_elo(debate_file, leaderboard_csv):
    """Recompute Elo from full debate history and write leaderboard CSV."""
    scores, _, _, _ = load_history(debate_file)
    if not scores:
        return scores

    sorted_models = sorted(scores.items(), key=lambda x: -x[1])
    rows = []
    for model, elo in sorted_models:
        rows.append({"model": model, "elo": elo})

    df = pd.DataFrame(rows)
    df.to_csv(leaderboard_csv, index=False, header=False,
              columns=["model", "elo"])

    return scores


# ================= Pairing Logic =================

def generate_pairings_round1(new_models, scores, match_history):
    """Round 1: spread new models across the median region of existing leaderboard.
    Leftover new models are paired with each other."""
    existing = [m for m in scores if m not in new_models]
    existing_sorted = sorted(existing, key=lambda m: scores.get(m, INIT_RATING), reverse=True)

    pairings = []
    paired_new = set()

    if existing_sorted:
        median_idx = len(existing_sorted) // 2
        # Build opponent pool sorted by distance from median
        opponent_pool = sorted(
            existing_sorted,
            key=lambda m: abs(scores.get(m, INIT_RATING)
                              - scores.get(existing_sorted[median_idx], INIT_RATING))
        )

        shuffled_new = list(new_models)
        random.shuffle(shuffled_new)

        used_opponents = set()
        for nm in shuffled_new:
            # Find closest unused existing opponent in median region
            opponent = None
            for candidate in opponent_pool:
                if candidate not in used_opponents and candidate not in match_history.get(nm, set()):
                    opponent = candidate
                    break
            if opponent:
                pairings.append((nm, opponent))
                used_opponents.add(opponent)
                paired_new.add(nm)

    # Pair remaining new models with each other
    unpaired = [nm for nm in new_models if nm not in paired_new]
    random.shuffle(unpaired)
    while len(unpaired) >= 2:
        a = unpaired.pop()
        b = unpaired.pop()
        pairings.append((a, b))
        paired_new.add(a)
        paired_new.add(b)

    # If one leftover new model, pair with any available existing model
    if unpaired:
        nm = unpaired[0]
        for candidate in existing_sorted:
            if candidate not in match_history.get(nm, set()):
                pairings.append((nm, candidate))
                paired_new.add(nm)
                break

    return pairings


def generate_pairings_subsequent(new_models, scores, match_history):
    """Round 2+: each new model plays its closest-Elo unplayed opponent.
    Opponents can be existing models or other new models."""
    pairings = []
    paired_this_round = set()

    # Sort new models by Elo descending for deterministic ordering
    sorted_new = sorted(new_models, key=lambda m: scores.get(m, INIT_RATING), reverse=True)
    all_models = list(scores.keys())

    for nm in sorted_new:
        if nm in paired_this_round:
            continue

        current_elo = scores.get(nm, INIT_RATING)
        played = match_history.get(nm, set())

        # All unplayed opponents, sorted by Elo distance
        candidates = [
            m for m in all_models
            if m != nm and m not in played and m not in paired_this_round
        ]
        candidates.sort(key=lambda m: abs(scores.get(m, INIT_RATING) - current_elo))

        if not candidates:
            # Fallback: allow rematches, pick closest Elo not paired this round
            candidates = [
                m for m in all_models
                if m != nm and m not in paired_this_round
            ]
            candidates.sort(key=lambda m: abs(scores.get(m, INIT_RATING) - current_elo))

        if candidates:
            opponent = candidates[0]
            pairings.append((nm, opponent))
            paired_this_round.add(nm)
            # If opponent is also a new model, mark it as paired
            if opponent in new_models:
                paired_this_round.add(opponent)

    return pairings


# ================= Battle Execution =================

def run_single_battle(args):
    """Worker function: runs one EvolvementLoop battle. Designed for ProcessPoolExecutor."""
    model_a, model_b, tree_file, debate_file, log_dir, round_num = args
    tree_id = os.path.basename(tree_file).replace('.json', '')

    # Each worker must set up its own imports (fresh process)
    import sys as _sys
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    _web_tree_dir = os.path.join(_script_dir, 'web_tree')
    if _web_tree_dir not in _sys.path:
        _sys.path.insert(0, _web_tree_dir)
    if _script_dir not in _sys.path:
        _sys.path.insert(0, _script_dir)
    from core.evolvement_loop import EvolvementLoop

    # Random A/B swap for fairness
    if random.random() > 0.5:
        real_a, real_b = model_a, model_b
    else:
        real_a, real_b = model_b, model_a

    log_path = os.path.join(
        log_dir, f"R{round_num}_{real_a}_vs_{real_b}_{tree_id}.log"
    )
    temp_q = os.path.join(
        log_dir, f"temp_{tree_id}_{datetime.now().strftime('%H%M%S%f')}.jsonl"
    )

    # Per-battle wall-clock timeout via SIGALRM. Fires in the worker process,
    # unwinds as TimeoutError, and is cancelled in finally:. Workers already
    # ignore SIGINT/SIGTERM (see _init_worker) but SIGALRM is separate and
    # still delivered. See batch-onboarding-plan.md Known Issues #6.
    def _battle_timeout_handler(signum, frame):
        raise TimeoutError(f"Battle exceeded {MAX_BATTLE_SECONDS}s")
    signal.signal(signal.SIGALRM, _battle_timeout_handler)
    signal.alarm(MAX_BATTLE_SECONDS)

    try:
        # Set up per-battle file logger
        battle_logger = logging.getLogger(f"Battle_{tree_id}_{real_a}_{real_b}")
        battle_logger.setLevel(logging.INFO)
        battle_logger.propagate = False
        os.makedirs(os.path.dirname(log_path), exist_ok=True)
        fh = logging.FileHandler(log_path, encoding='utf-8')
        fh.setFormatter(logging.Formatter('%(message)s'))
        battle_logger.addHandler(fh)

        loop = EvolvementLoop(real_a, real_b, tree_file, temp_q, logger=battle_logger)
        result = loop.start()

        battle_logger.removeHandler(fh)
        fh.close()

        debate_entry = {
            "gamekey": [tree_id, real_a, real_b],
            "result": result,
            "meta": {
                "type": "onboarding",
                "round": round_num,
                "timestamp": str(datetime.now())
            }
        }

        # File-locked append to shared JSONL
        lock_path = debate_file + ".lock"
        lock = filelock.FileLock(lock_path, timeout=30)
        with lock:
            with open(debate_file, 'a') as f:
                f.write(json.dumps(debate_entry) + "\n")

        winner = result.get('winner', 'Tie')
        return {"status": "ok", "tree_id": tree_id, "winner": winner}

    except TimeoutError as e:
        return {"status": "timeout", "tree_id": tree_id, "error": str(e)}
    except Exception as e:
        return {"status": "error", "tree_id": tree_id, "error": str(e)}
    finally:
        signal.alarm(0)


def run_battles_parallel(pairings, tree_files, debate_file, log_dir,
                         round_num, completed_tasks, num_workers):
    """Run all battles for a round using ProcessPoolExecutor."""
    tasks = []
    for model_a, model_b in pairings:
        for t_file in tree_files:
            tree_id = os.path.basename(t_file).replace('.json', '')

            # Skip already completed (supports resume)
            key_fwd = f"R{round_num}_{model_a}_{model_b}_{tree_id}"
            key_rev = f"R{round_num}_{model_b}_{model_a}_{tree_id}"
            if key_fwd in completed_tasks or key_rev in completed_tasks:
                continue

            tasks.append((model_a, model_b, t_file, debate_file, log_dir, round_num))

    if not tasks:
        logger.info("  All battles already completed (resumed). Skipping.")
        return

    total = len(tasks)
    logger.info(f"  Dispatching {total} battles across {num_workers} workers (parent PID {os.getpid()})...")

    done_count = 0
    error_count = 0
    timeout_count = 0

    pool = ProcessPoolExecutor(max_workers=num_workers, initializer=_init_worker)
    try:
        futures = {pool.submit(run_single_battle, t): t for t in tasks}
        try:
            for future in as_completed(futures):
                done_count += 1
                result = future.result()
                if result["status"] == "ok":
                    logger.info(
                        f"  [{done_count}/{total}] {result['tree_id']} → {result['winner']}"
                    )
                elif result["status"] == "timeout":
                    timeout_count += 1
                    error_count += 1
                    logger.warning(
                        f"  [{done_count}/{total}] {result['tree_id']} TIMED OUT "
                        f"after {MAX_BATTLE_SECONDS}s (will retry on resume): {result['error']}"
                    )
                else:
                    error_count += 1
                    logger.error(
                        f"  [{done_count}/{total}] {result['tree_id']} FAILED: {result['error']}"
                    )
        except KeyboardInterrupt:
            logger.warning(
                "  Interrupt received. Cancelling pending battles and force-killing workers "
                "(in-flight battles will be abandoned and re-run on resume)..."
            )
            # Cancel anything that hasn't started yet.
            for fut in futures:
                fut.cancel()
            # Workers ignore SIGINT/SIGTERM (see _init_worker), and stuck crawler
            # loops don't respond to SIGTERM anyway — so escalate straight to
            # SIGKILL. (_processes is a private API but it's the only reliable
            # way to reach individual workers in a ProcessPoolExecutor.)
            for proc in list(getattr(pool, "_processes", {}).values()):
                try:
                    proc.kill()  # SIGKILL — unignorable
                except Exception:
                    pass
            raise
    finally:
        # shutdown(wait=False) so we don't block on in-flight workers.
        pool.shutdown(wait=False, cancel_futures=True)

    logger.info(
        f"  Round complete: {total - error_count} succeeded, "
        f"{error_count} failed ({timeout_count} timed out)."
    )


# ================= Main Onboarding Loop =================

def run_batch_onboarding(new_model_names, output_dir, num_workers, user_rounds=None):
    os.makedirs(output_dir, exist_ok=True)

    debate_file = os.path.join(output_dir, "all_debate_history.jsonl")
    leaderboard_csv = os.path.join(output_dir, "current_leaderboard.csv")
    log_dir = os.path.join(output_dir, "onboarding_battles")
    os.makedirs(log_dir, exist_ok=True)

    tree_files = get_tree_files()
    if not tree_files:
        logger.error("No tree files found (tree_0001 to tree_0030)!")
        return

    # Load existing state
    scores, match_history, participants, completed_tasks = load_history(debate_file)

    # Initialize new models
    new_models = set()
    for nm in new_model_names:
        new_models.add(nm)
        if nm not in scores:
            scores[nm] = INIT_RATING
        if nm not in match_history:
            match_history[nm] = set()

    total_models = len(scores)
    num_rounds = user_rounds if user_rounds else math.ceil(math.log2(total_models))

    logger.info("=" * 60)
    logger.info("BATCH ONBOARDING")
    logger.info(f"  New models:      {sorted(new_models)}")
    logger.info(f"  Existing models: {total_models - len(new_models)}")
    logger.info(f"  Total models:    {total_models}")
    logger.info(f"  Rounds:          {num_rounds} (ceil(log2({total_models})))")
    logger.info(f"  Trees per match: {len(tree_files)}")
    logger.info(f"  Workers:         {num_workers}")
    logger.info(f"  Output:          {output_dir}")
    logger.info("=" * 60)

    for r in range(num_rounds):
        current_round = r + 1
        logger.info(f"\n{'='*60}")
        logger.info(f"ROUND {current_round}/{num_rounds}")
        logger.info(f"{'='*60}")

        # Reload state (picks up results from previous round)
        if r > 0:
            scores, match_history, participants, completed_tasks = load_history(debate_file)
            # Ensure new models are in scores even if they haven't played yet
            for nm in new_models:
                if nm not in scores:
                    scores[nm] = INIT_RATING
                if nm not in match_history:
                    match_history[nm] = set()

        # Print current Elo for new models
        logger.info("Current Elo:")
        for nm in sorted(new_models):
            logger.info(f"  {nm}: {scores.get(nm, INIT_RATING):.1f}")

        # Generate pairings
        if r == 0:
            pairings = generate_pairings_round1(new_models, scores, match_history)
        else:
            pairings = generate_pairings_subsequent(new_models, scores, match_history)

        if not pairings:
            logger.warning("No pairings generated! All opponents may have been played.")
            break

        logger.info(f"Pairings ({len(pairings)}):")
        for a, b in pairings:
            elo_a = scores.get(a, INIT_RATING)
            elo_b = scores.get(b, INIT_RATING)
            tag_a = " *" if a in new_models else ""
            tag_b = " *" if b in new_models else ""
            logger.info(f"  {a}{tag_a} ({elo_a:.0f}) vs {b}{tag_b} ({elo_b:.0f})")

        # Run battles
        run_battles_parallel(
            pairings, tree_files, debate_file, log_dir,
            current_round, completed_tasks, num_workers
        )

        # Recompute Elo
        logger.info("Recomputing Elo...")
        scores = recompute_and_save_elo(debate_file, leaderboard_csv)

        logger.info(f"Updated leaderboard (top {min(15, len(scores))}):")
        for rank, (model, elo) in enumerate(
            sorted(scores.items(), key=lambda x: -x[1])[:15], start=1
        ):
            tag = " ★" if model in new_models else ""
            logger.info(f"  #{rank:2d}  {model}: {elo:.1f}{tag}")

    # Final summary
    logger.info(f"\n{'='*60}")
    logger.info("ONBOARDING COMPLETE")
    logger.info(f"{'='*60}")
    logger.info(f"Final rankings for new models:")
    all_sorted = sorted(scores.items(), key=lambda x: -x[1])
    for rank, (model, elo) in enumerate(all_sorted, start=1):
        if model in new_models:
            logger.info(f"  #{rank:2d}  {model}: {elo:.1f}")
    logger.info(f"\nLeaderboard saved to: {leaderboard_csv}")
    logger.info(f"Debate history: {debate_file}")
    logger.info(f"Battle logs: {log_dir}")


# ================= CLI =================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Batch onboard new models into an existing DR-Arena leaderboard."
    )
    parser.add_argument(
        "--models", type=str, required=True,
        help="Comma-separated list of model names to onboard"
    )
    parser.add_argument(
        "--output-dir", type=str, required=True,
        help="Tournament results directory (reads existing history, appends new results)"
    )
    parser.add_argument(
        "--workers", type=int, default=1,
        help="Number of parallel worker processes (default: 1)"
    )
    parser.add_argument(
        "--rounds", type=int, default=None,
        help="Override number of onboarding rounds (default: ceil(log2(N)))"
    )
    # Backwards compatibility: support old --model flag
    parser.add_argument("--model", type=str, default=None, help=argparse.SUPPRESS)

    args = parser.parse_args()

    # Handle old single --model flag
    if args.model and not args.models:
        model_list = [args.model.strip()]
    else:
        model_list = [m.strip() for m in args.models.split(",") if m.strip()]

    if not model_list:
        parser.error("No models specified.")

    # Treat SIGTERM (plain `kill <pid>`) the same as Ctrl-C so the graceful
    # shutdown path in run_battles_parallel runs regardless of how we're killed.
    def _sigterm_to_keyboard_interrupt(signum, frame):
        raise KeyboardInterrupt("SIGTERM received")
    signal.signal(signal.SIGTERM, _sigterm_to_keyboard_interrupt)

    logger.info(f"Starting onboarding (parent PID {os.getpid()}). Use `kill {os.getpid()}` or Ctrl-C to stop cleanly.")
    try:
        run_batch_onboarding(model_list, args.output_dir, args.workers, args.rounds)
    except KeyboardInterrupt:
        logger.warning(
            "Onboarding interrupted by user. Completed battles are preserved in "
            "all_debate_history.jsonl — re-run the same command to resume."
        )
        sys.exit(130)
