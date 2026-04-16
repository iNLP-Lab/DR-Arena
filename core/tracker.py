# core/tracker.py

from config import ESTIMATED_COST_PER_1M_TOKENS

class TokenTracker:
    def __init__(self):
        self.total_tokens = 0

    def add_text(self, text):
        if not text: return
        # 简单估算：1 token ≈ 4 chars
        self.total_tokens += int(len(str(text)) / 4.0)

    def get_stats(self):
        cost = (self.total_tokens / 1_000_000) * ESTIMATED_COST_PER_1M_TOKENS
        return f"Tokens: {self.total_tokens:,} | Est. Cost: ${cost:.4f}"

global_token_tracker = TokenTracker()