# core/examiner.py

import json
import re
import json_repair
import logging
from core.api_client import call_api_with_retry
from core.tracker import global_token_tracker

class ExaminerAgent:
    def __init__(self, model_config):
        self.model_config = model_config
        self.system_prompt = "You are an expert AI Benchmark Creator & Judge."

    def _call_llm(self, prompt, temp=0.7):
        msgs = [{"role": "system", "content": self.system_prompt}, {"role": "user", "content": prompt}]
        global_token_tracker.add_text(prompt)
        resp = call_api_with_retry(self.model_config, msgs, temperature=temp, max_tokens=4096)
        global_token_tracker.add_text(resp)
        return resp

    def generate_question(self, context_struct, depth_level, width_count, past_questions=[],root_topic="General Knowledge"):
        """Generates 'Deep & Wide' Search Evaluation questions."""
        # 1. Unpack Context
        reasoning_nodes = context_struct.get("reasoning_chain", [])
        target_nodes = context_struct.get("aggregation_pool", [])
        
        # 2. Calculate Word Constraint dynamically
        raw_min = 100 + (width_count * 30) + (depth_level * 20)
        final_min = min(raw_min, 300)
        final_max = min(final_min + 100, 400)
        constraint_str = f"Answer length: {final_min}-{final_max} words."

        # 3. Format Context
        reasoning_str = "\n".join([f"[Deep Logic - Ancestor {i}]: {(n.get('content') or '')}" for i, n in enumerate(reasoning_nodes)])
        target_str = "\n".join([f"[Wide Logic - Target {i}]: {(n.get('content') or '')}" for i, n in enumerate(target_nodes)])
        
        past_q_str = "None"
        if past_questions:
            past_q_str = "\n".join([f"Turn {i+1}: {q}" for i, q in enumerate(past_questions)])

        # 4. Construct Prompt
        prompt = f"""
        # TASK: Generate a "Deep & Wide" Search Evaluation Query

        You are an expert at creating complex, multi-hop search queries designed to test the limits of Search Agents. Your goal is to synthesize a question that requires **Logical Reasoning (Deep)** to identify the subjects and **Broad Information Aggregation (Wide)** to answer fully.

        --- 1. THE HIDDEN KNOWLEDGE (Source Material) ---
        *Note: This content is hidden from the test taker. It is only for you to formulate the question and the grading criteria.*

        **OVERALL DOMAIN/TOPIC**: "{root_topic}"

        **A. Reasoning Chain (Background/Context)**:
        {reasoning_str}

        **B. Target Answers (The Facts to Retrieve)**:
        {target_str}

        --- 2. QUESTION GENERATION STEPS (READ CAREFULLY) ---
        **Rule 1: ABSOLUTE GROUNDING (The Anchor) - CRITICAL**
        - **YOU MUST** generate the question based **ONLY** on the specific entities and facts found in the [Hidden Knowledge] above.
        - **STRICT PROHIBITION:** Do NOT ignore the provided text.
        - **Relevance: - The question MUST be relevant to the **Overall Domain/Topic** ("{root_topic}"). Do not hallucinate unrelated topics.

        **Rule 2: COMPLETE DE-CONTEXTUALIZATION (No Leaking)**
        - **FORBIDDEN:** You MUST NOT mention the specific filename, website title, directory name, or document header found in the source.
        - **REQUIRED:** Treat the provided text as just *one instance* of a universal fact. Ask about the *entities themselves*, not about the *document* describing them. 
        - **Litmus Test:** If the user needs the specific JSON file you read to understand the question, YOU FAILED. The question must be solvable using Google/Bing to find the *original primary sources*.

        **STEP 1: Deep Reasoning (The Filter)**
        - Analyze the [Reasoning Chain] to identify the specific logic, condition, or category that groups the target entities together.
        - **RULE**: Do NOT mention the specific names of the [Target Entities] in the question.
        - **RULE**: Use the [Reasoning Chain] logic to strictly define the group.

        **STEP 2: Wide Aggregation (The Scope)**
        - If the [Target Answers] contain multiple entities ({len(target_nodes)} > 1), the question MUST require reading and comparing information from **ALL** of them.
        - The answer must not be resolvable by finding a single document; it must require aggregating details across all identified targets.

        **STEP 3: Synthesis (The Deep & Wide Question)**
        - Combine Step 1 and Step 2 into a single, cohesive natural language question.
        - **CRITICAL**: Ensure the question targets **Publicly Verifiable Facts**. Do not ask about obscure details that exist *only* within the specific phrasing of the provided source text. The question must be answerable by searching external, general web sources.

        --- 3. CHECKLIST DEFINITIONS (CRITICAL) ---
        **STEP 1 Draft the Gold Standard Answer**: Formulate a complete answer based on the [Hidden Knowledge].
        **STEP 2 Extract Checklists**: Deconstruct the answer into specific verification points.
            - **Checklist Width (Completeness & Details)**: **Content**: The Specific Attributes/Facts requested in the query. **Purpose**: Once the entity is found, did the agent gather *all* the requested scattered details?
            - **Checklist Depth (Identity & Logic)**: **Content**: The Correct Entity Names + The Logic Validation. **Purpose**: Did the agent use the reasoning chain to find the *correct* person/thing?

        --- 4. OUTPUT FORMAT (JSON) ---
        
        Return the result in the following JSON format:

        {{
            "question": "The final Deep & Wide search query",
            "word_limit_instruction": "{constraint_str}",
            "checklist_width": [
                "Specific Detail A for Entity 1",
                "Specific Detail B for Entity 1",
                "Specific Detail A for Entity 2",
                ...
            ],
            "checklist_depth": [
                "Target Entity 1 Name + Logic Proof",
                "Target Entity 2 Name + Logic Proof",
                ...
            ],
            "rationale": "Briefly explain how the question uses logic to mask entities (Deep) and requests scattered info (Wide)."
        }}

        """
        
        resp = self._call_llm(prompt)
        try:
            clean_resp = json_repair.loads(re.search(r'\{.*\}', resp, re.DOTALL).group(0))
            clean_resp["source_nodes"] = [n.get('title', 'N/A') for n in target_nodes]
            clean_resp["meta_context_snippet"] = target_str[:200].replace('\n', ' ')
            clean_resp["judge_max_limit"] = final_max
            return clean_resp
        except Exception as e:
            return {"error": str(e), "question": "Error", "checklist_width": [], "checklist_depth": []}

    def judge_answers(self, task_data, traj_a, traj_b):
        q = task_data['question']
        check_w = task_data.get('checklist_width', [])
        check_d = task_data.get('checklist_depth', [])
        max_limit = task_data.get('judge_max_limit', 300)
        constraint = task_data.get('word_limit_instruction', 'N/A')
        c_a = traj_a.get('citation_stats', {}).get('citation_count', 0)
        c_b = traj_b.get('citation_stats', {}).get('citation_count', 0)
        
        prompt = f"""
        ### Role: Super-User Evaluator (Simulating Human Preference)
        Compare Response A and Response B to identify which search agent provides a better USER EXPERIENCE.
        While accuracy is paramount, you must also heavily weigh **comprehensiveness, formatting, and helpfulness**—traits that human users value in search engines like Perplexity, Gemini, or SearchGPT.        
        
        --- 1. QUERY & CONSTRAINT ---
        Query: {q}
        Constraint: **Maximum {max_limit} words**. (Note: Do not penalize slightly going over if the quality is high. Only penalize extreme verbosity).
        
        --- 2. GROUND TRUTH CHECKLIST ---
        [WIDTH-Completeness]: {json.dumps(check_w)}
        [DEPTH-Logic]: {json.dumps(check_d)}

        --- 3. RESPONSES ---
        === Agent A ===
        (Citation Count: {c_a})
        {traj_a['final_answer']}
        
        === Agent B ===
        (Citation Count: {c_b})
        {traj_b['final_answer']}

        --- 4. EVALUATION CRITERIA (Aligned with Human Preference) ---
        **Dimension 1: Accuracy (The Foundation)**
        - **Core Entity Check**: Determine if each agent passes the DEEP Logic (Found the right entity?). (If BOTH fail this, it's a LOW TIE).
        - **Sub-Point Accuracy**: Did the agent answer *all* parts of the prompt correctly? Determine if each agent passes the WIDE Aggregation (Found the specific details?).
        ** - If BOTH agents have significant hallucinations (even on different parts), consider a **Low Quality Tie**.   
       
        **Dimension 2: User Utility & Completeness (The Experience)**
        - **Helpfulness**: Is the answer easy to read? Does it actually solve the user's underlying intent?
        - **Information Density**: Unlike simple chatbots, Search Agents should provide **rich context**. If the user asks about a device, listing specs + reviews + prices is better than just giving the name.
        - **Helpful Recovery**: If the exact answer isn't in the context, did the agent try to synthesize *related* useful info? (Reward "Best Effort" over "Lazy Refusal", unless the attempt is factually wrong).
        - **Citation Density**: A higher citation count is generally preferred as it indicates better groundedness, provided the citations are relevant.

        **Dimension 3: Presentation & Structure **
        - **Markdown Mastery**: REWARD the use of **Bold** headers, Bullet points, and Tables. Wall-of-text answers are bad.
        - **Scannability** & **Directness**: Can a user find the specific answer in 2 seconds? Did they put the answer at the top (BLUF - Bottom Line Up Front)?

        --- 4. SCORING RUBRIC ---
        - **[[A/B_MUCH_BETTER]] (+2)**: 
            - The winner found the correct Entity AND answered sub-points correctly (No Hallucinations).
            - The loser failed the Deep Logic (Wrong Entity) or missed major Checklists.
            - *Note: Do not give MUCH_BETTER if the winner has a factual error in a sub-point.*

        - **[[A/B_BETTER]] (+1)**: 
            If winner has errors, cap at BETTER.
            - **The "Flawed Winner"**: The winner got the Main Entity right, but missed a detail or hallucinated on a minor sub-point. The loser failed the Main Entity.
            - **The "Style Winner"**: Both are factually accurate, but one has significantly better formatting/comprehensiveness.
            - **The "Nuance Winner"**: Both failed slightly, but the winner's failure was less catastrophic than the loser's.
        
        - **[[Tie]]**: 
            - *High Quality*: Both gave perfect, well-formatted, accurate answers.
            - *Low Quality*: Both failed to find the core entity or both hallucinated significantly.

        **Error Diagnosis**
        - If there is a loser, identify WHY they lost.
        - **DEEP**: Failed logic/identity (Wrong Entity).
        - **WIDE**: Failed detail aggregation (Missing Facts).
        - **BOTH**: Failed both deep logic and wide details.
        - **NONE**: No hard checklist failures, when the winner won solely on Soft Filters like citations/formatting.
        
        --- 5. OUTPUT FORMAT (JSON) ---
        {{
            "verdict": "[[A_MUCH_BETTER]]" | "[[A_BETTER]]" | "[[Tie]]" | "[[B_BETTER]]" | "[[B_MUCH_BETTER]]",
            "tie_quality": "HIGH" (Both Good) | "LOW" (Both Bad) | "N/A",
            "loser_failure_type": "DEEP" | "WIDE" | "BOTH" | "NONE",
            "reasoning": "First, verify Deep Logic for both. Then, compare Width/Completeness. Finally, decide the winner based on Formatting and User Experience."
        }}
        """
        max_retries = 3
        for i in range(max_retries):
            resp = self._call_llm(prompt, temp=0.1) # Low temp for consistency
            try:
                json_match = re.search(r'\{.*\}', resp, re.DOTALL)
                if not json_match:
                    raise ValueError("No JSON found in response")
                
                result = json_repair.loads(json_match.group(0))
                
                if "verdict" not in result:
                    raise ValueError("Missing 'verdict' field")
                
                return result
            
            except Exception as e:
                logging.warning(f"[JUDGE] Parsing failed (Attempt {i+1}/{max_retries}): {e}")
                if i == max_retries - 1:
                    logging.error(f"[JUDGE] Fatal Parsing Error.\nResponse: {resp}")
                    return {"verdict": "ERROR", "reasoning": "Output parsing failed after retries."}