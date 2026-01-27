"""OpenRouter API client with async support, model availability checks, and cost tracking."""
import asyncio
import json
import os
import time
from pathlib import Path
from typing import Optional, Dict, Any, List
import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class ModelClient:
    """Async OpenRouter API client with cost tracking and model availability checks."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or OPENROUTER_API_KEY
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is required")
        
        self.client = httpx.AsyncClient(
            base_url=OPENROUTER_BASE_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3420"),
                "X-Title": os.getenv("OPENROUTER_APP_NAME", "Summary Maker Benchmark"),
                "Content-Type": "application/json"
            },
            timeout=120.0
        )
        self._available_models_cache: Optional[List[str]] = None
    
    async def check_model_availability(self, model_id: str) -> bool:
        """Check if a model is available by making a minimal test request."""
        try:
            response = await self.client.post(
                "/chat/completions",
                json={
                    "model": model_id,
                    "messages": [{"role": "user", "content": "test"}],
                    "max_tokens": 5
                }
            )
            return response.status_code == 200
        except Exception:
            return False
    
    async def check_models_availability(self, model_ids: List[str]) -> Dict[str, bool]:
        """Check availability of multiple models in parallel."""
        tasks = [self.check_model_availability(model_id) for model_id in model_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        availability = {}
        for model_id, result in zip(model_ids, results):
            if isinstance(result, Exception):
                availability[model_id] = False
            else:
                availability[model_id] = result
        
        return availability
    
    async def generate(
        self,
        model_id: str,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2000,
        temperature: float = 0.2,
        max_retries: int = 2
    ) -> Dict[str, Any]:
        """
        Generate text using OpenRouter API.
        
        Returns:
            Dict with keys: text, usage (prompt_tokens, completion_tokens, total_tokens),
            cost, latency_ms, error (if any)
        """
        start_time = time.time()
        
        payload = {
            "model": model_id,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        last_error = None
        for attempt in range(max_retries + 1):
            try:
                response = await self.client.post("/chat/completions", json=payload)
                response.raise_for_status()
                
                data = response.json()
                choice = data.get("choices", [{}])[0]
                text = choice.get("message", {}).get("content", "")
                usage = data.get("usage", {})
                
                latency_ms = (time.time() - start_time) * 1000
                
                # Calculate cost (will be updated with actual pricing from model config)
                cost = self._calculate_cost(model_id, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0))
                
                return {
                    "text": text,
                    "usage": {
                        "prompt_tokens": usage.get("prompt_tokens", 0),
                        "completion_tokens": usage.get("completion_tokens", 0),
                        "total_tokens": usage.get("total_tokens", 0)
                    },
                    "cost": cost,
                    "latency_ms": latency_ms,
                    "error": None
                }
            except httpx.HTTPStatusError as e:
                last_error = f"HTTP {e.response.status_code}: {e.response.text}"
                if e.response.status_code == 429:  # Rate limit
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                elif e.response.status_code >= 500:  # Server error
                    await asyncio.sleep(1 * attempt)
                else:
                    break
            except Exception as e:
                last_error = str(e)
                if attempt < max_retries:
                    await asyncio.sleep(1 * attempt)
                else:
                    break
        
        latency_ms = (time.time() - start_time) * 1000
        return {
            "text": "",
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            "cost": 0.0,
            "latency_ms": latency_ms,
            "error": last_error
        }
    
    def _calculate_cost(
        self,
        model_id: str,
        prompt_tokens: int,
        completion_tokens: int,
        pricing: Optional[Dict[str, Any]] = None
    ) -> float:
        """Calculate cost based on token usage and pricing."""
        if pricing is None:
            return 0.0
        
        input_per_1m = pricing.get("input_per_1m")
        output_per_1m = pricing.get("output_per_1m")
        
        if input_per_1m is None:
            input_per_1m = 0
        if output_per_1m is None:
            output_per_1m = 0
        
        input_cost = (prompt_tokens / 1_000_000) * input_per_1m
        output_cost = (completion_tokens / 1_000_000) * output_per_1m
        
        return input_cost + output_cost
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
