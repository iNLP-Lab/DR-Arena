# core/api_client.py

import time
import logging
from openai import OpenAI
from config import OPENROUTER_API_KEY, API_MAX_RETRY, API_RETRY_SLEEP

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
    timeout=500.0, 
    default_headers={
        "HTTP-Referer": "https://github.com/your-repo/DeepResearch-Arena", 
        "X-Title": "DeepResearch Arena",
    },
)

def call_api_with_retry(model_config, messages, **kwargs):
    """A smart and robust API call function that checks for supported parameters."""
    model_id = model_config['id']
    supported_params = model_config.get('supported_params', ['max_tokens'])
    api_kwargs = {key: value for key, value in kwargs.items() if key in supported_params}
    tools = model_config.get("tools")
    if tools:
        api_kwargs["tools"] = tools
    
    for i in range(API_MAX_RETRY):
        try:
            response = client.chat.completions.create(
                model=model_id,
                messages=messages,
                **api_kwargs
            )
            choice = response.choices[0]
            content = choice.message.content
            finish_reason = getattr(choice, "finish_reason", None)

            # Some preview reasoning models (e.g. google/gemini-3.1-pro-preview)
            # intermittently return HTTP 200 with content=None and
            # finish_reason="error". Surface that as a clear retriable error
            # instead of crashing with 'NoneType' has no attribute 'strip'.
            if content is None or finish_reason == "error":
                raise RuntimeError(
                    f"Empty response from {model_id} "
                    f"(finish_reason={finish_reason}, content is None)"
                )

            return content.strip()
        except Exception as e:
            logging.warning(f"API call for {model_id} failed: {e}. Retrying ({i+1}/{API_MAX_RETRY})...")
            if i == API_MAX_RETRY - 1:
                logging.error(f"API call for {model_id} failed after retries.")
                return None
            time.sleep(API_RETRY_SLEEP)
    return None
