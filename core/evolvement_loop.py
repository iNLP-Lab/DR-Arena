# core/evolvement_loop.py

import logging
import random
import json
from datetime import datetime
import os

from config import (
    TASK_GENERATOR_MODEL_CONFIG,
    AVAILABLE_SEARCH_MODELS,
    MIN_ROUNDS,
    MAX_ROUNDS,
    WIN_THRESHOLD,
    ESTIMATED_COST_PER_1M_TOKENS
)
from core.agents import SearchAgent
from core.examiner import ExaminerAgent
from core.tracker import global_token_tracker

try:
    from web_tree.utils.io_utils import load_tree_from_json, save_tree_to_json
    from utils.crawler_utils import WebsiteTreeCrawler
    import expand_tree
except ImportError:
    pass

class EvolvementLoop:
    def __init__(self, model_a, model_b, tree_file, questions_file_path, logger=None):
        self.agent_a = SearchAgent(f"Agent A ({model_a})", AVAILABLE_SEARCH_MODELS[model_a])
        self.agent_b = SearchAgent(f"Agent B ({model_b})", AVAILABLE_SEARCH_MODELS[model_b])
        self.examiner = ExaminerAgent(TASK_GENERATOR_MODEL_CONFIG)
        
        self.tree_file_path = tree_file
        self.tree_node = load_tree_from_json(tree_file)
        self.tree = self.tree_node.to_dict()
        
        self.crawler_instance = WebsiteTreeCrawler(allow_all_domains=True)
        
        self.current_node = self.tree
        self.node_path_stack = [self.tree] 
        self.conversation_history_a = []
        self.conversation_history_b = []
        
        self.score_a = 0.0
        self.score_b = 0.0
        self.round_count = 0
        self.generated_questions_history = [] 

        # Initial difficulty state
        self.difficulty_nodes = 2   # Controls Width (Wide)
        self.next_focus = random.choice(["WIDTH", "DEPTH"])

        self.history_snapshots = [0]
        self.questions_file = questions_file_path

        # Safety caps — prevent runaway auto-expansion on cyclic sites
        # (observed 2026-04-10: gemini battle on archive-it.org/bsz-bw.de cycled
        # the same ~10 URLs at depth 18 for hours because there was no cap).
        self.expansion_count = 0
        self.MAX_EXPANSIONS = 8          # hard cap on _auto_expand_tree calls per battle
        self.total_iterations = 0
        self.MAX_ITERATIONS = MAX_ROUNDS * 3  # backup cap on the main while-loop

        
        if logger: self.logger = logger
        else: 
            logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
            self.logger = logging.getLogger()

    def _clean_title(self, title):
        if not title: return "Unknown"
        return title.split(' - ')[0].split(' | ')[0]
    def _is_valid_node(self, node):
        """
        Check if a node is valid for interaction.
        Revised: As long as it has ANY text (Content/Desc/Title) or Children, it is valid.
        No minimum length constraint.
        """
        # 1. Check Text Presence
        has_content = (node.get('content') or '').strip()
        has_desc = (node.get('description') or '').strip()
        has_title = (node.get('title') or '').strip()
        
        if has_content or has_desc or has_title:
            return True
            
        # 2. Check Structure
        children = node.get('children') or []
        if len(children) > 0:
            return True
            
        return False

    def _get_node_text(self, node, parent_node=None):
        """
        Extracts text for the Examiner.
        Enhanced: Now looks up the parent node's link_contexts to find surrounding text
        and relationships regarding the current node.
        """
        parts = []
        
        # --- 1. Extract Parent Context (Reverse Lookup) ---
        if parent_node:
            current_url = node.get('url')
            link_contexts = parent_node.get('link_contexts') or []
            
            for ctx in link_contexts:
                if ctx.get('url') == current_url:
                    rel = (ctx.get('relationship') or '').strip()
                    surr_text = (ctx.get('surrounding_text') or '').strip()
                    
                    if rel and rel != "related topics":
                        parts.append(f"Category/Relationship: {rel}")
                    
                    if surr_text and len(surr_text) > 10:
                        surr_text = surr_text.replace('\n', ' ')
                        parts.append(f"Parent Context Summary: {surr_text}")
                    
                    break

        # --- 2. Extract Native Content ---
        raw_title = (node.get('title') or '').strip()
        raw_desc = (node.get('description') or '').strip()
        raw_content = (node.get('content') or '').strip()
        
        # Check if we have "meat"
        has_meat = len(raw_desc) > 0 or len(raw_content) > 0
        
        if has_meat:
            if raw_desc:
                parts.append(f"Description: {raw_desc}")
            
            if raw_content:
                limit = 800
                if len(raw_content) > limit:
                    parts.append(f"Content: {raw_content[:limit]}...")
                else:
                    parts.append(f"Content: {raw_content}")
        else:
            # Fallback to Title
            if raw_title:
                clean_topic = self._clean_title(raw_title)
                parts.append(f"General Topic Context: {clean_topic}")
            else:
                parts.append("Info: [Empty Node]")
            
        return "\n".join(parts)
    
    def _node_has_content(self, node):
        """Helper to check if a node has meaningful text content."""
        raw_content = (node.get('content') or '').strip()
        raw_desc = (node.get('description') or '').strip()
        return len(raw_content) > 20 or len(raw_desc) > 20

    def _jump_to_random_start(self):
        """
        Randomly start at an inner node.
        MODIFIED: Prioritizes nodes with content at Depth >= 1 (Skipping Root).
        Then selects the SHALLOWEST among them.
        """
        candidates = []
        total_nodes = 0
        
        def traverse(node, path):
            nonlocal total_nodes
            total_nodes += 1
            
            if len(path) >= 0 and self._is_valid_node(node):
                candidates.append((node, path))
            
            children = node.get('children') or []
            for child in children:
                traverse(child, path + [node])
        
        traverse(self.tree, [])
        
        if candidates:
            # --- FILTER: Exclude Root (Depth 0) ---
            # len(path) == 0 is Root. len(path) >= 1 is children.
            depth_filtered_candidates = [c for c in candidates if len(c[1]) >= 1]
            
            # Safety check: If tree is just a root (no children), revert to all candidates
            if not depth_filtered_candidates:
                self.logger.warning("--- [JUMP] Tree has no Depth >= 1 nodes. Forced to include Root. ---")
                depth_filtered_candidates = candidates

            # --- Filter for Content within valid depth ---
            content_candidates = [c for c in depth_filtered_candidates if self._node_has_content(c[0])]
            
            selected_node = None
            path = []

            if content_candidates:
                # 1. Find min depth among content nodes (strictly >= 1 unless forced)
                min_depth = min(len(c[1]) for c in content_candidates)
                
                # 2. Filter for shallowest candidates
                shallowest_candidates = [c for c in content_candidates if len(c[1]) == min_depth]
                
                # 3. Select
                selected_node, path = random.choice(shallowest_candidates)
                self.logger.info(f"--- [JUMP] Selected HIGH QUALITY node (Depth {min_depth}) from {len(shallowest_candidates)} candidates. (Skipped Depth 0) ---")
            else:
                # Fallback: Structural nodes at Depth >= 1
                min_depth = min(len(c[1]) for c in depth_filtered_candidates)
                shallowest_candidates = [c for c in depth_filtered_candidates if len(c[1]) == min_depth]
                
                selected_node, path = random.choice(shallowest_candidates)
                self.logger.warning(f"--- [JUMP] Warning: No content-rich nodes found at Depth >= 1. Selected shallowest structural node (Depth {min_depth}). ---")

            self.current_node = selected_node
            self.node_path_stack = path + [selected_node]
            
            chain_str = " -> ".join([self._clean_title(n.get('title')) for n in self.node_path_stack])
            self.logger.info(f"--- [JUMP] Initialized at Depth {len(self.node_path_stack)-1}. Path: {chain_str} ---")
        else:
            self.current_node = self.tree
            self.node_path_stack = [self.tree]
            self.logger.warning(f"--- [JUMP] No candidates found (Scanned {total_nodes}). Force Root. ---")
            
                        
    def _get_context_nodes(self):
        # 1. Deep Context (Ancestors)
        reasoning_chain = []
        if len(self.node_path_stack) >= 3:
            reasoning_chain = self.node_path_stack[-3:-1] 
        elif len(self.node_path_stack) == 2:
            reasoning_chain = [self.node_path_stack[0]] 

        # 2. Wide Context (Siblings)
        aggregation_pool = []
        parent_node_for_pool = None 
        
        if len(self.node_path_stack) >= 2:
            parent_node = self.node_path_stack[-2]
            parent_node_for_pool = parent_node 
            
            all_siblings = parent_node.get('children') or []
            candidates = [n for n in all_siblings if n.get('url') != self.current_node.get('url')]
            
            current_title = self.current_node.get('title', '').strip()
            unique_candidates = []
            seen_titles = {current_title}
            
            for n in candidates:
                t = (n.get('title') or "").strip()
                if not t or t not in seen_titles:
                    if self._is_valid_node(n):
                        unique_candidates.append(n)
                        if t: seen_titles.add(t)

            aggregation_pool = [self.current_node]
            
            needed = max(0, self.difficulty_nodes - 1)
            if unique_candidates:
                count = min(len(unique_candidates), needed)
                aggregation_pool += random.sample(unique_candidates, count)
        else:
            aggregation_pool = [self.current_node]

        # --- [Enhanced Formatting Logic] ---
        
        reasoning_fmt = []
        for ancestor in reasoning_chain:
            try:
                idx = self.node_path_stack.index(ancestor)
                ancestor_parent = self.node_path_stack[idx-1] if idx > 0 else None
                reasoning_fmt.append(self._get_node_text(ancestor, ancestor_parent))
            except ValueError:
                reasoning_fmt.append(self._get_node_text(ancestor, None))

        aggregation_fmt = []
        for node in aggregation_pool:
            aggregation_fmt.append(self._get_node_text(node, parent_node_for_pool))

        return {
            "reasoning_chain": reasoning_chain,
            "aggregation_pool": aggregation_pool,
            "reasoning_chain_fmt": reasoning_fmt,
            "aggregation_pool_fmt": aggregation_fmt
        }

    def _auto_expand_tree(self, failure_type, required_amount=1):
        """Attempts to crawl more nodes if the tree is too shallow or narrow."""
        # Safety cap: prevent runaway expansion on cyclic sites.
        if self.expansion_count >= self.MAX_EXPANSIONS:
            self.logger.warning(
                f"--- [EXPANSION] Cap reached ({self.expansion_count}/{self.MAX_EXPANSIONS}). "
                f"Skipping further auto-expansion for this battle. ---"
            )
            return False
        self.expansion_count += 1

        self.logger.info(f"--- [EXPANSION] Triggering Auto-Expansion: {failure_type} (Need +{required_amount}) [{self.expansion_count}/{self.MAX_EXPANSIONS}] ---")
        target_url = None
        mode = None
        
        if failure_type == "insufficient_depth":
            target_url = self.current_node.get('url')
            mode = "DEPTH"
        elif failure_type == "insufficient_width":
            if len(self.node_path_stack) >= 2:
                target_url = self.node_path_stack[-2].get('url') # Parent URL
                mode = "WIDTH"
            else: 
                return False
        
        if not target_url: return False

        node_obj = expand_tree.find_node_by_url(self.tree_node, target_url)
        if not node_obj: return False

        visited = expand_tree.collect_all_visited_urls(self.tree_node)
        self.crawler_instance.visited_urls = visited
        added = 0
        
        try:
            if mode == "DEPTH":
                added, _ = expand_tree.expand_depth(node_obj, self.crawler_instance, additional_depth=1, max_children=3)
            elif mode == "WIDTH":
                added, _ = expand_tree.expand_width(node_obj, self.crawler_instance, additional_children=required_amount)
        except Exception as e:
            self.logger.error(f"[EXPANSION] Error: {e}")
            return False

        if added > 0:
            self.logger.info(f"[EXPANSION] Successfully added {added} nodes.")
            save_tree_to_json(self.tree_node, self.tree_file_path)
            self.tree_node = load_tree_from_json(self.tree_file_path)
            self.tree = self.tree_node.to_dict()
            
            # Re-locate current node in new tree
            current_url_real = self.current_node.get('url')
            def find_path(root, url):
                if root.get('url') == url: return [root]
                for c in (root.get('children') or []):
                    p = find_path(c, url)
                    if p: return [root] + p
                return None
            
            new_path = find_path(self.tree, current_url_real)
            if new_path:
                self.node_path_stack = new_path
                self.current_node = new_path[-1]
                return True
        else:
            self.logger.warning("[EXPANSION] Crawler returned 0 new nodes.")
            
        return False

    def _backtrack(self):
        """Moves up to the parent node."""
        if len(self.node_path_stack) > 1:
            self.logger.info(">>> [BACKTRACK] Moving up to Parent Node <<<")
            self.node_path_stack.pop()
            self.current_node = self.node_path_stack[-1]
            
            # Restore conversation history
            if self.history_snapshots:
                restore_idx = self.history_snapshots.pop()
                self.conversation_history_a = self.conversation_history_a[:restore_idx]
                self.conversation_history_b = self.conversation_history_b[:restore_idx]
            
            self.difficulty_nodes = max(2, self.difficulty_nodes - 1)
            return True
        return False

    def _advance_tree(self):
        """Attempts to descend to a child node (Deep + 1)."""
        raw_children = self.current_node.get('children') or []
        valid_children = [c for c in raw_children if len((c.get('content') or '').strip()) > 20]

        if not valid_children:
            self.logger.info("  [EVOLUTION] No valid children. Expanding Depth...")
            if self._auto_expand_tree("insufficient_depth"):
                raw_children = self.current_node.get('children') or []
                valid_children = [c for c in raw_children if len((c.get('content') or '').strip()) > 50]
        
        if valid_children:
            current_len = len(self.conversation_history_a)
            self.history_snapshots.append(current_len)
            
            best_child = random.choice(valid_children) 
            self.current_node = best_child
            self.node_path_stack.append(self.current_node)
            
            self.logger.info(f"  [EVOLUTION] Descended to: '{self._clean_title(best_child.get('title'))}'")
            return True
        
        self.logger.warning("  [EVOLUTION] Stuck at leaf. Cannot descend.")
        return False
    
    def start(self):
        self._jump_to_random_start()
        # start_tokens = global_token_tracker.total_tokens
        self.logger.info(f"Start Loop: {self.agent_a.name} vs {self.agent_b.name}")
        root_title = self._clean_title(self.tree.get('title'))
        self.logger.info(f"Overall Domain/Topic: {root_title}")
        while self.round_count < MAX_ROUNDS:
            # Backup safety: escape the loop if we've iterated far too many times
            # (e.g. skip-retry path keeps decrementing round_count without progress).
            self.total_iterations += 1
            if self.total_iterations > self.MAX_ITERATIONS:
                self.logger.warning(
                    f"[SAFETY] Iteration cap reached ({self.total_iterations}/{self.MAX_ITERATIONS}). "
                    f"Ending battle early with current scores."
                )
                break

            self.round_count += 1
            depth_level = len(self.node_path_stack)
            
            # --- 0. Logging State ---
            self.logger.info("\n" + "="*60)
            self.logger.info(f"=== ROUND {self.round_count} ===")
            self.logger.info(f"[STATE] Depth: {depth_level} | Width Constraint: {self.difficulty_nodes}")
            
            chain_titles = [self._clean_title(n.get('title')) for n in self.node_path_stack]
            self.logger.info(f"[LOGIC CHAIN] {' -> '.join(chain_titles)}")
            
            # --- 1. Environment Setup (Wide Expansion) ---
            if self.difficulty_nodes > 1 and len(self.node_path_stack) >= 2:
                parent = self.node_path_stack[-2]
                siblings = parent.get('children') or []
                if len(siblings) < self.difficulty_nodes:
                    missing = self.difficulty_nodes - len(siblings)
                    self.logger.info(f"[SETUP] Width requirement {self.difficulty_nodes} > Siblings {len(siblings)}. Expanding...")
                    self._auto_expand_tree("insufficient_width", missing)
            
            context_struct = self._get_context_nodes()
                        
            t_text_list = context_struct.get("aggregation_pool_fmt", [])
            t_text_combined = "".join(t_text_list)
            
            has_target_content = "Content:" in t_text_combined or "Description:" in t_text_combined
            
            if not has_target_content:
                self.logger.warning(f"[SKIP] Target Pool is Title-only or Empty. (Cannot form answerable question)")
                self.logger.warning("       Action: Expanding Width & Re-Jumping.")
                
                self._auto_expand_tree("insufficient_width", 1) 
                self._jump_to_random_start()
                self.round_count -= 1 
                continue

            r_text_list = context_struct.get("reasoning_chain_fmt", [])
            reasoning_str_log = "\n".join([f"[Deep Logic - Ancestor {i}]: {txt}" for i, txt in enumerate(r_text_list)])
            target_str_log = "\n".join([f"[Wide Logic - Target {i}]: {txt}" for i, txt in enumerate(t_text_list)])
            
            self.logger.info("\n--- [EXAMINER CONTEXT VIEW] ---")
            self.logger.info(f"**A. Reasoning Chain (Background/Context)**:\n{reasoning_str_log}")
            self.logger.info(f"**B. Target Answers (The Facts to Retrieve)**:\n{target_str_log}")
            self.logger.info("-------------------------------\n")

            # --- 2. Task Generation ---
            self.logger.info(f"[TASK GEN] Generating complex query...")
            
            task = self.examiner.generate_question(
                context_struct, 
                depth_level=depth_level, 
                width_count=self.difficulty_nodes,
                past_questions=self.generated_questions_history,
                root_topic=root_title
            )
            
            if "error" in task:
                self.logger.error(f"[GEN ERROR] {task['error']}. Skipping round.")
                self._jump_to_random_start()
                continue
            
            self.logger.info(f"[TASK JSON]\n{json.dumps(task, indent=2, ensure_ascii=False)}")
            # --- 3. Save Data (Flattened JSONL) ---
            try:
                log_entry = task.copy()
                log_entry["round_id"] = self.round_count
                log_entry["timestamp"] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                log_entry["current_depth"] = depth_level
                log_entry["current_width"] = self.difficulty_nodes
                log_entry["root_topic"] = root_title
                
                with open(self.questions_file, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")
                self.logger.info(f"[LOG] Question saved to {self.questions_file}")
            except Exception as io_err:
                self.logger.error(f"[LOG ERROR] Failed to save question: {io_err}")

            q = task['question']
            self.generated_questions_history.append(q)

            # --- 4. Agent Execution ---
            try:
                traj_a, msgs_a, dur_a = self.agent_a.research(q, task['word_limit_instruction'], self.conversation_history_a)
                self.conversation_history_a.extend(msgs_a)
            except Exception as e: traj_a = {"final_answer": str(e)}; dur_a=0

            try:
                traj_b, msgs_b, dur_b = self.agent_b.research(q, task['word_limit_instruction'], self.conversation_history_b)
                self.conversation_history_b.extend(msgs_b)
            except Exception as e: traj_b = {"final_answer": str(e)}; dur_b=0
            
            self.logger.info(f"\n=== [AGENT A] ({dur_a:.1f}s) ===\n{traj_a.get('final_answer', '')}") 
            self.logger.info(f"\n=== [AGENT B] ({dur_b:.1f}s) ===\n{traj_b.get('final_answer', '')}")

            # --- 5. Judging ---
            result = self.examiner.judge_answers(task, traj_a, traj_b)
            
            verdict = result.get("verdict", "ERROR")
            if verdict == "ERROR":
                self.logger.error("[JUDGE ERROR] Verdict parsing failed explicitly. Skipping scoring.")
                continue

            tie_quality = result.get("tie_quality", "N/A")
            loser_failure = result.get("loser_failure_type", "NONE")
            
            # Log Full Verdict
            self.logger.info(f"[VERDICT FULL]\n{json.dumps(result, indent=2, ensure_ascii=False)}")

            # --- 6. Score Update ---
            round_winner = "Tie"
            if "[[A_" in verdict:
                round_winner = "A"
                points = 2 if "MUCH_BETTER" in verdict else 1
                self.score_a += points
            elif "[[B_" in verdict:
                round_winner = "B"
                points = 2 if "MUCH_BETTER" in verdict else 1
                self.score_b += points
            
            self.logger.info(f"[SCORE] A: {self.score_a} | B: {self.score_b}")

            # --- 7. Mercy Rule ---
            score_diff = abs(self.score_a - self.score_b)
            if self.round_count >= MIN_ROUNDS and score_diff >= WIN_THRESHOLD:
                self.logger.info(f"\n[GAME OVER] Mercy Rule Triggered (Diff >= {WIN_THRESHOLD})!")
                break

            # --- 8. Evolution Logic ---
            self.logger.info("[EVOLUTION] Determining Next Step...")
            
            if round_winner == "Tie":
                if tie_quality == "LOW":
                    # TIE (Low Quality) -> Backtrack
                    self.logger.warning(" -> TIE (Both Bad): BACKTRACKING.")
                    if not self._backtrack():
                        # Root fallback
                        self.difficulty_nodes = 2
                        self.next_focus = "WIDTH"
                else:
                    self.logger.info(" -> TIE (Both Good): PRESSURE TEST (Deep+1 & Wide+1).")
                    
                    self.difficulty_nodes += 1  # Wide+1
                    moved = self._advance_tree() # Deep+1
                    
                    if moved: self.next_focus = "DEPTH"
                    else: self.next_focus = "WIDTH"
                        
            else:
                self.logger.info(f" -> WINNER is {round_winner}. Targeting Loser Failure: {loser_failure}.")
                
                if loser_failure == "DEEP":
                    # Logic/Identity Failure -> Force Depth
                    self.logger.info("    -> Action: Deep+1 (Drill Down)")
                    moved = self._advance_tree()
                    if moved:
                        self.next_focus = "DEPTH"
                    else:
                        self.next_focus = "WIDTH"
                        self.difficulty_nodes += 1

                elif loser_failure == "WIDE":
                    self.logger.info("    -> Action: Wide+1 (Increase Context Width)")
                    self.difficulty_nodes += 1
                    self.next_focus = "WIDTH"

                elif loser_failure in ["BOTH", "NONE"]:
                    self.logger.info("    -> Action: Pressure Test (Deep+1 & Wide+1)")
                    self.difficulty_nodes += 1
                    moved = self._advance_tree()
                    if moved: self.next_focus = "DEPTH"
                    else: self.next_focus = "WIDTH"

        # --- Final Summary ---
        self.logger.info("\n" + "="*60)
        self.logger.info(f"=== FINAL RESULTS (Rounds: {self.round_count}) ===")
        self.logger.info(f"Final Score: A ({self.score_a}) - B ({self.score_b})")
        
        final_winner = "Tie"
        if self.score_a > self.score_b: final_winner = self.agent_a.name
        elif self.score_b > self.score_a: final_winner = self.agent_b.name
        
        self.logger.info(f"WINNER: {final_winner}")
        self.logger.info(f"Resources: {global_token_tracker.get_stats()}")
        
        return {
            "score_a": self.score_a, 
            "score_b": self.score_b, 
            "winner": final_winner,
            "rounds": self.round_count
        }