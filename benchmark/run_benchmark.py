"""Main benchmark runner with async support and caching."""
import argparse
import asyncio
import hashlib
import json
import sys
import time
from pathlib import Path
from typing import Dict, Any, List, Optional
import json as json_lib
from tqdm import tqdm

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.client import ModelClient
from prompts import build_summary_prompts, build_quiz_prompts, build_flashcards_prompts
from evaluators.format_checker import evaluate_reliability
from evaluators.llm_judge import evaluate_with_consensus
from evaluators.metrics import (
    aggregate_model_metrics,
    calculate_comparative_metrics,
    calculate_comprehensive_model_metrics
)
from utils.logger import BenchmarkLogger


CONFIG_PATH = Path(__file__).parent / "config" / "benchmark_config.json"
CACHE_DIR = Path(__file__).parent / "results" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def validate_config(config: Dict[str, Any]) -> None:
    """
    Validate benchmark configuration.
    
    Raises:
        ValueError: If required keys are missing or invalid
    """
    required_keys = [
        "judge_models",
        "concurrency_limit",
        "reliability_weight",
        "quality_weight",
        "adaptive_input_sizing",
        "token_limit_multipliers"
    ]
    
    missing_keys = [key for key in required_keys if key not in config]
    if missing_keys:
        raise ValueError(f"Missing required config keys: {missing_keys}")
    
    # Validate judge_models
    if not isinstance(config["judge_models"], list) or len(config["judge_models"]) == 0:
        raise ValueError("judge_models must be a non-empty list")
    
    # Validate concurrency_limit
    if not isinstance(config["concurrency_limit"], int) or config["concurrency_limit"] < 1:
        raise ValueError("concurrency_limit must be a positive integer")
    
    # Validate weights
    if not isinstance(config["reliability_weight"], (int, float)) or not (0 <= config["reliability_weight"] <= 1):
        raise ValueError("reliability_weight must be a number between 0 and 1")
    if not isinstance(config["quality_weight"], (int, float)) or not (0 <= config["quality_weight"] <= 1):
        raise ValueError("quality_weight must be a number between 0 and 1")
    
    # Validate adaptive_input_sizing
    if not isinstance(config["adaptive_input_sizing"], dict):
        raise ValueError("adaptive_input_sizing must be a dictionary")
    required_tiers = ["free", "budget", "mid_tier", "premium"]
    missing_tiers = [tier for tier in required_tiers if tier not in config["adaptive_input_sizing"]]
    if missing_tiers:
        raise ValueError(f"adaptive_input_sizing missing tiers: {missing_tiers}")
    
    # Validate token_limit_multipliers
    if not isinstance(config["token_limit_multipliers"], dict):
        raise ValueError("token_limit_multipliers must be a dictionary")
    missing_multiplier_tiers = [tier for tier in required_tiers if tier not in config["token_limit_multipliers"]]
    if missing_multiplier_tiers:
        raise ValueError(f"token_limit_multipliers missing tiers: {missing_multiplier_tiers}")


def load_config() -> Dict[str, Any]:
    """Load and validate benchmark configuration."""
    with open(CONFIG_PATH, encoding="utf-8") as f:
        config = json.load(f)
    
    validate_config(config)
    return config


def load_models_config() -> List[Dict[str, Any]]:
    """Load models from config file."""
    models_file = Path(__file__).parent.parent / "config" / "openrouter-models.example.json"
    if not models_file.exists():
        # Try local config
        models_file = Path(__file__).parent.parent / "config" / "openrouter-models.json"
    
    if models_file.exists():
        with open(models_file, encoding="utf-8") as f:
            return json.load(f)
    return []


def normalize_text_for_cache(text: str) -> str:
    """
    Normalize text for better cache hits by removing excessive whitespace.
    
    Args:
        text: Text to normalize
    
    Returns:
        Normalized text with single spaces and trimmed
    """
    import re
    # Replace multiple whitespace with single space
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def get_cache_key(model_id: str, task: str, test_case: Dict[str, Any]) -> str:
    """Generate cache key for a test case."""
    # Normalize text for better cache hits (same content = same hash)
    text = normalize_text_for_cache(test_case.get('text', ''))
    
    if len(text) > 10000:
        # Hash very long texts to avoid extremely long cache keys
        text = hashlib.sha256(text.encode()).hexdigest()
    content = f"{model_id}:{task}:{test_case.get('id', '')}:{text}"
    return hashlib.sha256(content.encode()).hexdigest()


def load_cached_result(cache_key: str) -> Optional[Dict[str, Any]]:
    """Load cached result if available."""
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        try:
            return json.loads(cache_file.read_text())
        except Exception:
            return None
    return None


def save_cached_result(cache_key: str, result: Dict[str, Any]):
    """Save result to cache."""
    cache_file = CACHE_DIR / f"{cache_key}.json"
    cache_file.write_text(json.dumps(result, indent=2))


def get_pricing_tier(pricing: Dict[str, Any]) -> str:
    """Determine pricing tier for adaptive limits."""
    input_price = pricing.get("input_per_1m", 0) or 0
    
    if input_price == 0:
        return "free"
    elif input_price < 1:
        return "budget"
    elif input_price < 5:
        return "mid_tier"
    else:
        return "premium"


def get_adaptive_limits(config: Dict[str, Any], pricing_tier: str, default_max_tokens: int) -> tuple[int, int]:
    """Get adaptive token limits and input size based on pricing tier."""
    multipliers = config["token_limit_multipliers"]
    input_sizing = config["adaptive_input_sizing"]
    
    multiplier = multipliers.get(pricing_tier, 1.0)
    max_tokens = int(default_max_tokens * multiplier)
    
    max_input_chars = input_sizing.get(pricing_tier, 2000)
    
    return max_tokens, max_input_chars


async def run_single_benchmark(
    client: ModelClient,
    model_id: str,
    model_config: Dict[str, Any],
    task: str,
    test_case: Dict[str, Any],
    config: Dict[str, Any],
    judge_models: List[str],
    semaphore: asyncio.Semaphore,
    models_dict: Dict[str, Dict[str, Any]],
    use_cache: bool = True
) -> Dict[str, Any]:
    """Run benchmark for a single model+task+test_case combination."""
    async with semaphore:
        cache_key = get_cache_key(model_id, task, test_case)
        
        # Check cache
        if use_cache:
            cached = load_cached_result(cache_key)
            if cached:
                return cached
        
        # Prepare input
        text = test_case.get("text", "")
        pricing = model_config.get("pricing", {})
        pricing_tier = get_pricing_tier(pricing)
        
        # Adaptive input sizing
        _, max_input_chars = get_adaptive_limits(config, pricing_tier, 2000)
        if len(text) > max_input_chars:
            text = text[:max_input_chars] + "..."
        
        # Build prompts
        if task == "summary":
            prompts = build_summary_prompts(text)
            default_max_tokens = 2800
        elif task == "quiz":
            section = {
                "id": test_case.get("id", "test"),
                "title": test_case.get("title", "Test"),
                "text": text
            }
            prompts = build_quiz_prompts(section, questions_count=6, avoid_questions=[])
            default_max_tokens = 3200
        elif task == "flashcards":
            sections = [{
                "id": test_case.get("id", "test"),
                "title": test_case.get("title", "Test"),
                "text": text
            }]
            prompts = build_flashcards_prompts(sections, cards_per_section=6)
            default_max_tokens = 4096
        else:
            return {"error": f"Unknown task: {task}"}
        
        # Adaptive token limits
        max_tokens, _ = get_adaptive_limits(config, pricing_tier, default_max_tokens)
        
        # Generate output
        result = await client.generate(
            model_id=model_id,
            system_prompt=prompts["systemPrompt"],
            user_prompt=prompts["userPrompt"],
            max_tokens=max_tokens,
            temperature=0.2
        )
        
        # Update cost calculation with actual pricing
        if result.get("usage") and not result.get("error"):
            actual_cost = client._calculate_cost(
                model_id,
                result["usage"].get("prompt_tokens", 0),
                result["usage"].get("completion_tokens", 0),
                pricing
            )
            result["cost"] = actual_cost
        
        if result.get("error"):
            return {
                "model_id": model_id,
                "task": task,
                "test_case_id": test_case.get("id"),
                "error": result["error"],
                "cost": 0,
                "latency_ms": result.get("latency_ms", 0)
            }
        
        output_text = result["text"]
        
        # Parse JSON for quiz/flashcards
        output_json = None
        if task in ["quiz", "flashcards"]:
            try:
                # Try to extract JSON from response
                text = output_text.strip()
                if "```json" in text:
                    text = text.split("```json")[1].split("```")[0].strip()
                elif "```" in text:
                    text = text.split("```")[1].split("```")[0].strip()
                
                output_json = json_lib.loads(text)
            except Exception:
                output_json = None
        
        # Evaluate reliability
        reliability_result = evaluate_reliability(task, output_text, output_json)
        
        # Evaluate content quality with judge
        # Exclude the current model from judge_models if it's also a judge
        # This prevents a model from evaluating its own outputs
        judge_models_for_this = [j for j in judge_models if j != model_id]
        
        judge_result = await evaluate_with_consensus(
            judge_models=judge_models_for_this,
            task_type=task,
            source_text=text,
            output_text=output_text,
            output_json=output_json,
            client=client,
            use_cache=True,
            models_dict=models_dict
        )
        
        # Calculate content quality score (mean of aggregated scores)
        content_quality_score = 1.0  # Minimum is 1, not 0
        if judge_result.get("aggregated_scores"):
            scores = []
            for key, value in judge_result["aggregated_scores"].items():
                if key != "reasoning" and isinstance(value, dict):
                    mean_score = value.get("mean", 1.0)
                    scores.append(max(1.0, mean_score))  # Ensure minimum is 1
            if scores:
                content_quality_score = sum(scores) / len(scores)
        elif judge_result.get("error") == "Empty output":
            content_quality_score = 1.0  # Empty output gets minimum score
        
        # Calculate total cost (generation + judge evaluation)
        generation_cost = result.get("cost", 0)
        judge_cost = judge_result.get("total_judge_cost", 0.0)
        total_cost = generation_cost + judge_cost
        
        benchmark_result = {
            "model_id": model_id,
            "task": task,
            "test_case_id": test_case.get("id"),
            "test_case_topic": test_case.get("topic_category"),
            "test_case_format": test_case.get("format_type"),
            "output_text": output_text[:1000],  # Truncate for storage
            "reliability_score": reliability_result["reliability_score"],
            "reliability_issues": reliability_result["issues"],
            "content_quality_score": content_quality_score,
            "judge_evaluation": judge_result,
            "cost": total_cost,
            "generation_cost": generation_cost,
            "judge_cost": judge_cost,
            "latency_ms": result.get("latency_ms", 0),
            "usage": result.get("usage", {}),
            "pricing_tier": pricing_tier
        }
        
        # Cache result
        if use_cache:
            save_cached_result(cache_key, benchmark_result)
        
        return benchmark_result


async def run_benchmark(
    models: List[str],
    tasks: List[str],
    test_cases_path: Path,
    config: Dict[str, Any],
    use_cache: bool = True,
    force: bool = False,
    logger: Optional[BenchmarkLogger] = None
):
    """Run benchmark for all model+task+test_case combinations."""
    start_time = time.time()
    
    # Initialize logger if not provided
    if logger is None:
        logger = BenchmarkLogger(console=True)
    
    # Load test cases
    if not test_cases_path.exists():
        logger.error(f"Test cases file not found: {test_cases_path}")
        return
    
    with open(test_cases_path, encoding="utf-8") as f:
        test_cases = json.load(f)
    
    logger.info(f"Loaded {len(test_cases)} test cases", test_cases_file=str(test_cases_path))
    
    # Load models config
    models_config_list = load_models_config()
    models_dict = {m.get("id"): m for m in models_config_list}
    
    # Filter to requested models
    if models:
        requested_models_set = set(models)
        available_in_config = [m for m in models if m in models_dict]
        missing_from_config = [m for m in models if m not in models_dict]
        
        if missing_from_config:
            logger.warning(
                "Some requested models not found in config",
                missing_models=missing_from_config,
                available_models=available_in_config
            )
        
        models_dict = {k: v for k, v in models_dict.items() if k in requested_models_set}
    
    if not models_dict:
        logger.error(
            "No models found in config",
            requested_models=models if models else "all",
            available_in_config=list({m.get("id") for m in models_config_list})
        )
        return
    
    judge_models = config["judge_models"]
    concurrency = config["concurrency_limit"]
    
    # Add judge models to models_dict if they're not already there (for pricing info)
    for judge_model_id in judge_models:
        if judge_model_id not in models_dict:
            # Try to find judge model in config
            judge_model_config = next((m for m in models_config_list if m.get("id") == judge_model_id), None)
            if judge_model_config:
                models_dict[judge_model_id] = judge_model_config
    
    # Check model availability
    async with ModelClient() as client:
        logger.info("Checking model availability...")
        all_models = list(models_dict.keys()) + judge_models
        availability = await client.check_models_availability(all_models)
        
        # Log availability results for debugging
        logger.debug(
            "Model availability check results",
            requested_models=models if models else "all",
            availability_results={k: v for k, v in availability.items() if k in models_dict.keys()}
        )
        
        # Allow models to be used as generation models even if they're in judge_models
        # They just won't evaluate their own outputs (handled in run_single_benchmark)
        available_models = [m for m in models_dict.keys() if availability.get(m, False)]
        available_judges = [m for m in judge_models if availability.get(m, False)]
        
        if not available_models:
            logger.error(
                "No generation models available!",
                requested_models=models if models else "all",
                models_in_config=list(models_dict.keys()),
                availability_results={k: v for k, v in availability.items() if k in models_dict.keys()}
            )
            return
        
        if not available_judges:
            logger.warning("No judge models available! Evaluation will be limited.")
        
        logger.info(
            "Model availability check complete",
            available_generation_models=len(available_models),
            total_generation_models=len(models_dict),
            available_judge_models=len(available_judges),
            total_judge_models=len(judge_models)
        )
        
        # Create tasks
        semaphore = asyncio.Semaphore(concurrency)
        benchmark_tasks = []
        
        for model_id in available_models:
            model_config = models_dict[model_id]
            for task in tasks:
                for test_case in test_cases:
                    if test_case.get("error"):
                        continue
                    
                    benchmark_tasks.append(
                        run_single_benchmark(
                            client,
                            model_id,
                            model_config,
                            task,
                            test_case,
                            config,
                            available_judges,
                            semaphore,
                            models_dict,
                            use_cache=use_cache and not force
                        )
                    )
        
        logger.benchmark_start(
            total_tasks=len(benchmark_tasks),
            models=available_models,
            tasks=tasks
        )
        
        # Run all tasks with progress bar
        results = []
        total_cost = 0.0
        
        # Use tqdm for progress bar (async-compatible)
        pbar = tqdm(total=len(benchmark_tasks), desc="Running benchmarks", unit="task")
        
        try:
            for coro in asyncio.as_completed(benchmark_tasks):
                result = await coro
                results.append(result)
                
                # Track costs
                if result.get("cost"):
                    total_cost += result.get("cost", 0)
                
                # Log individual result
                logger.model_result(
                    model_id=result.get("model_id", "unknown"),
                    task=result.get("task", "unknown"),
                    test_case_id=result.get("test_case_id", "unknown"),
                    reliability=result.get("reliability_score", 0),
                    quality=result.get("content_quality_score", 0),
                    cost=result.get("cost", 0),
                    latency_ms=result.get("latency_ms", 0)
                )
                
                # Update progress bar
                pbar.update(1)
                pbar.set_postfix({
                    "completed": len(results),
                    "cost": f"${total_cost:.4f}"
                })
        finally:
            pbar.close()
        
        duration = time.time() - start_time
        
        logger.benchmark_complete(
            total=len(results),
            duration_seconds=duration,
            total_cost=total_cost
        )
        
        # Save results
        results_path = Path(__file__).parent / "results" / "benchmark_results.json"
        results_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Load existing results and merge (with retry for race conditions)
        existing_results = []
        max_retries = 5
        for attempt in range(max_retries):
            try:
                if results_path.exists():
                    with open(results_path, "r", encoding="utf-8") as f:
                        existing_results = json.load(f)
                break
            except (json.JSONDecodeError, IOError) as e:
                if attempt < max_retries - 1:
                    time.sleep(0.1 * (attempt + 1))  # Exponential backoff
                else:
                    print(f"WARNING: Failed to load existing results after {max_retries} attempts: {e}")
        
        # Merge results (keep existing, update with new)
        results_dict = {f"{r.get('model_id')}:{r.get('task')}:{r.get('test_case_id')}": r for r in existing_results}
        for r in results:
            key = f"{r.get('model_id')}:{r.get('task')}:{r.get('test_case_id')}"
            results_dict[key] = r
        
        merged_results = list(results_dict.values())
        
        # Atomic write: write to temp file, then rename (prevents race conditions)
        temp_path = results_path.with_suffix('.json.tmp')
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(merged_results, f, indent=2, ensure_ascii=False)
            # Atomic rename (works on Unix and Windows)
            temp_path.replace(results_path)
        except Exception as e:
            # Clean up temp file on error
            if temp_path.exists():
                temp_path.unlink()
            raise
        
        logger.info(f"Saved results to: {results_path}", results_file=str(results_path), results_count=len(merged_results))
        
        # Calculate and save metrics
        # Get all unique model IDs from merged_results (not just available_models)
        # This ensures metrics are calculated for all models with data, even if they weren't available in this run
        all_model_ids = set(r.get("model_id") for r in merged_results if r.get("model_id"))
        
        # Overall metrics (for backward compatibility and comparative rankings)
        model_metrics_overall = {}
        for model_id in all_model_ids:
            model_results = [r for r in merged_results if r.get("model_id") == model_id and not r.get("error")]
            if model_results:
                model_metrics_overall[model_id] = aggregate_model_metrics(model_results, config)
        
        # Comprehensive metrics (with task/topic/format breakdowns)
        model_metrics_comprehensive = {}
        for model_id in all_model_ids:
            model_results = [r for r in merged_results if r.get("model_id") == model_id]
            if model_results:
                model_metrics_comprehensive[model_id] = calculate_comprehensive_model_metrics(model_results, config)
        
        comparative = calculate_comparative_metrics(model_metrics_overall)
        
        metrics_path = Path(__file__).parent / "results" / "benchmark_metrics.json"
        with open(metrics_path, "w", encoding="utf-8") as f:
            json.dump({
                "model_metrics": model_metrics_overall,  # For backward compatibility
                "model_metrics_comprehensive": model_metrics_comprehensive,  # New comprehensive breakdowns
                "comparative_metrics": comparative
            }, f, indent=2, ensure_ascii=False)
        
        logger.info(
            f"Saved metrics to: {metrics_path}",
            metrics_file=str(metrics_path),
            models_evaluated=len(model_metrics_overall)
        )
        logger.info("View results at: http://localhost:3420/benchmarks", _event="benchmark_view_url")


def main():
    parser = argparse.ArgumentParser(description="Run model benchmarks")
    parser.add_argument(
        "--models",
        type=str,
        help="Comma-separated list of model IDs to test (default: all in config)"
    )
    parser.add_argument(
        "--tasks",
        type=str,
        default="summary,quiz,flashcards",
        help="Comma-separated list of tasks (default: summary,quiz,flashcards)"
    )
    parser.add_argument(
        "--test-cases",
        type=str,
        default="benchmark/results/test_cases.json",
        help="Path to test cases JSON file"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignore cache and force re-run"
    )
    parser.add_argument(
        "--skip-cached",
        action="store_true",
        help="Skip cached results (opposite of --force)"
    )
    
    args = parser.parse_args()
    
    models = None
    if args.models:
        models = [m.strip() for m in args.models.split(",")]
    
    tasks = [t.strip() for t in args.tasks.split(",")]
    test_cases_path = Path(args.test_cases)
    
    config = load_config()
    
    use_cache = not args.force
    if args.skip_cached:
        use_cache = False
    
    # Initialize logger
    logger = BenchmarkLogger(console=True)
    
    asyncio.run(run_benchmark(
        models,
        tasks,
        test_cases_path,
        config,
        use_cache=use_cache,
        force=args.force,
        logger=logger
    ))


if __name__ == "__main__":
    main()
