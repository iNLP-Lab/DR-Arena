import os
import sys
import json
import argparse
import math
import logging
import random
import pandas as pd
from datetime import datetime
from typing import Dict, List, Tuple

script_dir = os.path.dirname(os.path.abspath(__file__))
web_tree_dir = os.path.join(script_dir, 'web_tree')
if web_tree_dir not in sys.path:
    sys.path.insert(0, web_tree_dir)
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)
from core.evolvement_loop import EvolvementLoop
from core.score_utils import compute_mle_elo
SEEDED_MODELS = [
    "claude-opus-4.6-search",
    "gemini-3.1-pro-grounding",
    "gpt-5.4-search",
    "grok-4.20-multi-agent-beta",
    "sonar-deep-research",
    "Kimi-k2.5",
    "glm-5.1",
]
TOURNAMENT_ROOT = "./tournament_results"
TREE_DIR = os.path.join(script_dir, "web_tree/data/dataset/trees")
PAIRING_FILE = os.path.join(TOURNAMENT_ROOT, "current_round_pairings.json")
ALL_DEBATE_FILE = os.path.join(TOURNAMENT_ROOT, "all_debate_history.jsonl")
LEADERBOARD_CSV = os.path.join(TOURNAMENT_ROOT, "current_leaderboard.csv")
ELO_HISTORY_CSV = os.path.join(TOURNAMENT_ROOT, "elo_history.csv")
INIT_RATING = 1000
if not os.path.exists(TOURNAMENT_ROOT):
    os.makedirs(TOURNAMENT_ROOT)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.join(TOURNAMENT_ROOT, "tournament_global.log"), encoding='utf-8')
    ]
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)
main_logger = logging.getLogger("TournamentCLI")
class DetailedLogger:
    def __init__(self, filepath):
        self.filepath = filepath
        self.logger = logging.getLogger(f"Battle_{os.path.basename(filepath)}")
        self.logger.setLevel(logging.INFO)
        self.handler = None
    def __enter__(self):
        self.handler = logging.FileHandler(self.filepath, encoding='utf-8')
        self.handler.setFormatter(logging.Formatter('%(message)s'))
        self.logger.addHandler(self.handler)
        self.logger.propagate = False 
        return self.logger
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.handler:
            self.logger.removeHandler(self.handler)
            self.handler.close()

def get_tree_files():
    target_files = []
    for i in range(1, 31):
        fname = f"tree_{i:04d}.json"
        fpath = os.path.join(TREE_DIR, fname)
        if os.path.exists(fpath):
            target_files.append(fpath)
    return target_files

def load_history_and_scores():
    results_for_elo = []
    match_history = {m: set() for m in SEEDED_MODELS}
    scores = {m: INIT_RATING for m in SEEDED_MODELS}
    if os.path.exists(ALL_DEBATE_FILE):
        with open(ALL_DEBATE_FILE, 'r') as f:
            for line in f:
                if not line.strip(): continue
                try:
                    data = json.loads(line)
                    gk = data.get("gamekey")
                    result = data.get("result", {})
                    if gk and result:
                        m_a, m_b = gk[1], gk[2]
                        raw_winner_str = result.get("winner", "Tie")
                        winner_code = "tie"
                        if m_a in raw_winner_str:
                            winner_code = "A"
                        elif m_b in raw_winner_str:
                            winner_code = "B"
                        if m_a in match_history: match_history[m_a].add(m_b)
                        if m_b in match_history: match_history[m_b].add(m_a)
                        results_for_elo.append({
                            "gamekey": gk,
                            "winner": winner_code,
                            "final_winner": [winner_code],
                            "judges": ["gemini-3-pro-grounding"],
                            "extra_meta": {
                                "timestamp": datetime.now().strftime('%Y-%m-%d'),
                                "round": data.get("meta", {}).get("round", 1)
                            }
                        })
                except Exception as e:
                    pass
    if results_for_elo:
        try:
            dict_ratings, _ = compute_mle_elo(results_for_elo, judge_debate_rounds=0, INIT_RATING=INIT_RATING)
            for m, s in dict_ratings.items():
                scores[m] = float(s)
        except Exception as e:
            main_logger.error(f"Error computing Elo from debate history: {e}")
    return scores, match_history, results_for_elo

def action_init():
    if not os.path.exists(TOURNAMENT_ROOT):
        os.makedirs(TOURNAMENT_ROOT)
    main_logger.info(f"Initialized tournament root at {TOURNAMENT_ROOT}")
    main_logger.info(f"Seeded Models: {SEEDED_MODELS}")

def action_pair(round_num):
    if not os.path.exists(TOURNAMENT_ROOT): action_init()
    if round_num == 1:
        main_logger.info(">>> Round 1: Using RANDOM INITIALIZATION <<<")
        ranked_models = SEEDED_MODELS[:]
        random.shuffle(ranked_models)
        main_logger.info(f"Randomized Order: {ranked_models}")
        match_history = {m: set() for m in SEEDED_MODELS}
    else:
        main_logger.info(f">>> Round {round_num}: Using ELO HISTORY from DEBATE LOGS <<<")
        scores, match_history, _ = load_history_and_scores()
        ranked_models = sorted(SEEDED_MODELS, key=lambda m: scores.get(m, INIT_RATING), reverse=True)
        main_logger.info("Current Elo Rankings:")
        for idx, m in enumerate(ranked_models):
            main_logger.info(f"{idx+1}. {m}: {scores.get(m, INIT_RATING):.1f}")
    pairings = []
    unpaired = ranked_models[:]
    while len(unpaired) >= 2:
        p1 = unpaired.pop(0)
        opponent = None
        for i, candidate in enumerate(unpaired):
            if candidate not in match_history[p1]:
                opponent = unpaired.pop(i)
                break
        if opponent:
            pairings.append((p1, opponent))
        else:
            if unpaired:
                opponent = unpaired.pop(0)
                main_logger.warning(f"Forced rematch: {p1} vs {opponent}")
                pairings.append((p1, opponent))
            else:
                main_logger.info(f"Bye: {p1}")
                pairings.append((p1, None))
    output = {"round": round_num, "pairings": pairings, "generated_at": str(datetime.now())}
    with open(PAIRING_FILE, 'w') as f:
        json.dump(output, f, indent=2)
    main_logger.info(f"Saved {len(pairings)} pairings to {PAIRING_FILE}")
    print(json.dumps(pairings, indent=2))

def action_battle(worker_id, total_workers):
    if not os.path.exists(PAIRING_FILE):
        main_logger.error("No pairings found!")
        return
    with open(PAIRING_FILE, 'r') as f:
        data = json.load(f)
    round_num = data['round']
    pairings = data['pairings']
    tree_files = get_tree_files()
    round_dir = os.path.join(TOURNAMENT_ROOT, f"round{round_num}")
    if not os.path.exists(round_dir): os.makedirs(round_dir)
    completed_keys = set()
    if os.path.exists(ALL_DEBATE_FILE):
        with open(ALL_DEBATE_FILE, 'r') as f:
            for line in f:
                if not line.strip(): continue
                try:
                    d = json.loads(line)
                    gk = d.get('gamekey')
                    if gk:
                        key = f"R{round_num}_{gk[1]}_{gk[2]}_{gk[0]}"
                        completed_keys.add(key)
                except: pass
    all_tasks = []
    for p_idx, (m_a, m_b) in enumerate(pairings):
        if m_b is None: continue
        for t_file in tree_files:
            all_tasks.append({"p_idx": p_idx, "m_a": m_a, "m_b": m_b, "t_file": t_file})
    my_tasks = [t for i, t in enumerate(all_tasks) if i % total_workers == worker_id]
    main_logger.info(f"Worker {worker_id+1}/{total_workers}: {len(my_tasks)} tasks.")
    for task in my_tasks:
        m_a, m_b, t_file, p_idx = task['m_a'], task['m_b'], task['t_file'], task['p_idx']
        tree_id = os.path.basename(t_file).replace('.json', '')
        unique_key = f"R{round_num}_{m_a}_{m_b}_{tree_id}"
        if unique_key in completed_keys:
            continue
        try:
            tree_num = int(tree_id.split('_')[-1])
        except: tree_num = 0
        swapped = (tree_num % 2 != 0)
        real_a = m_b if swapped else m_a
        real_b = m_a if swapped else m_b
        log_path = os.path.join(round_dir, f"R{round_num}_M{p_idx}_{real_a}_vs_{real_b}_{tree_id}.log")
        temp_q = os.path.join(round_dir, f"q_W{worker_id}.jsonl")
        main_logger.info(f"RUN: {real_a} vs {real_b} | {tree_id}")
        try:
            with DetailedLogger(log_path) as bl:
                bl.info(f"Original: {m_a} vs {m_b}")
                loop = EvolvementLoop(real_a, real_b, t_file, temp_q, logger=bl)
                result = loop.start()
                debate_entry = {
                    "gamekey": (tree_id, m_a, m_b),
                    "result": result                }
                with open(ALL_DEBATE_FILE, 'a') as f:
                    f.write(json.dumps(debate_entry) + "\n")
                main_logger.info(f"  -> Done: {result.get('winner')}")
        except Exception as e:
            main_logger.error(f"FAILED {unique_key}: {e}", exc_info=True)

def action_rank():
    main_logger.info("Computing rankings from debate logs...")
    scores, _, results = load_history_and_scores()
    if not results:
        main_logger.warning("No results.")
        return
    try:
        dict_ratings, df_ratings = compute_mle_elo(results, judge_debate_rounds=0, INIT_RATING=INIT_RATING)
        df_ratings.to_csv(LEADERBOARD_CSV)
        print(df_ratings)
        row = {"timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        row.update(dict_ratings)
        new_df = pd.DataFrame([row])
        if not os.path.exists(ELO_HISTORY_CSV):
            cols = ['timestamp'] + sorted([c for c in new_df.columns if c != 'timestamp'])
            new_df = new_df[cols]
            new_df.to_csv(ELO_HISTORY_CSV, index=False)
        else:
            existing_df = pd.read_csv(ELO_HISTORY_CSV, nrows=0)
            existing_cols = existing_df.columns.tolist()
            for c in existing_cols:
                if c not in new_df.columns:
                    new_df[c] = None
            new_df = new_df[existing_cols]
            new_df.to_csv(ELO_HISTORY_CSV, mode='a', header=False, index=False)
    except Exception as e:
        main_logger.error(f"Ranking failed: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--action", choices=["init", "pair", "battle", "rank"], required=True)
    parser.add_argument("--round", type=int)
    parser.add_argument("--worker_id", type=int, default=0)
    parser.add_argument("--total_workers", type=int, default=1)
    args = parser.parse_args()
    if args.action == "init": action_init()
    elif args.action == "pair": action_pair(args.round)
    elif args.action == "battle": action_battle(args.worker_id, args.total_workers)
    elif args.action == "rank": action_rank()
