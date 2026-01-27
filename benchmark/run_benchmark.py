"""Main benchmark runner with async support and caching."""
import argparse
import asyncio
import hashlib
import json
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
import json as json_lib

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.client import ModelClient
from prompts import build_summary_prompts, build_quiz_prompts, build_flashcards_prompts
from evaluators.format_checker import evaluate_reliability
from evaluators.llm_judge import evaluate_with_consensus
from evaluators.metrics import aggregate_model_metrics, calculate_comparative_metrics


CONFIG_PATH = Path(__file__).parent / "config" / "benchmark_config.json"
CACHE_DIR = Path(__file__).parent / "results" / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> Dict[str, Any]:
    """Load benchmark configuration."""
    with open(CONFIG_PATH, encoding="utf-8") as f:
        return json.load(f)


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


def get_cache_key(model_id: str, task: str, test_case: Dict[str, Any]) -> str:
    """Generate cache key for a test case."""
    content = f"{model_id}:{task}:{test_case.get('id', '')}:{test_case.get('text', '')[:500]}"
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
        judge_result = await evaluate_with_consensus(
            judge_models=judge_models,
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
    force: bool = False
):
    """Run benchmark for all model+task+test_case combinations."""
    # Load test cases
    if not test_cases_path.exists():
        print(f"ERROR: Test cases file not found: {test_cases_path}")
        return
    
    with open(test_cases_path, encoding="utf-8") as f:
        test_cases = json.load(f)
    
    # Load models config
    models_config_list = load_models_config()
    models_dict = {m.get("id"): m for m in models_config_list}
    
    # Filter to requested models
    if models:
        models_dict = {k: v for k, v in models_dict.items() if k in models}
    
    if not models_dict:
        print("ERROR: No models found or available")
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
        print("Checking model availability...")
        all_models = list(models_dict.keys()) + judge_models
        availability = await client.check_models_availability(all_models)
        
        available_models = [m for m in models_dict.keys() if availability.get(m, False) and m not in judge_models]
        available_judges = [m for m in judge_models if availability.get(m, False)]
        
        if not available_models:
            print("ERROR: No generation models available!")
            return
        
        if not available_judges:
            print("WARNING: No judge models available! Evaluation will be limited.")
        
        print(f"Available generation models: {len(available_models)}/{len(models_dict)}")
        print(f"Available judge models: {len(available_judges)}/{len(judge_models)}")
        
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
        
        print(f"\nRunning {len(benchmark_tasks)} benchmark tasks (concurrency: {concurrency})...")
        
        # Run all tasks
        results = []
        completed = 0
        for coro in asyncio.as_completed(benchmark_tasks):
            result = await coro
            results.append(result)
            completed += 1
            if completed % 10 == 0:
                print(f"  Completed: {completed}/{len(benchmark_tasks)}")
        
        print(f"\n✓ Completed {len(results)} benchmarks")
        
        # Save results
        results_path = Path(__file__).parent / "results" / "benchmark_results.json"
        results_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Load existing results and merge
        existing_results = []
        if results_path.exists():
            try:
                with open(results_path, "r", encoding="utf-8") as f:
                    existing_results = json.load(f)
            except Exception:
                pass
        
        # Merge results (keep existing, update with new)
        results_dict = {f"{r.get('model_id')}:{r.get('task')}:{r.get('test_case_id')}": r for r in existing_results}
        for r in results:
            key = f"{r.get('model_id')}:{r.get('task')}:{r.get('test_case_id')}"
            results_dict[key] = r
        
        merged_results = list(results_dict.values())
        
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(merged_results, f, indent=2, ensure_ascii=False)
        
        print(f"  Saved results to: {results_path}")
        
        # Calculate and save metrics
        model_metrics = {}
        for model_id in available_models:
            model_results = [r for r in merged_results if r.get("model_id") == model_id and not r.get("error")]
            if model_results:
                model_metrics[model_id] = aggregate_model_metrics(model_results)
        
        comparative = calculate_comparative_metrics(model_metrics)
        
        metrics_path = Path(__file__).parent / "results" / "benchmark_metrics.json"
        with open(metrics_path, "w", encoding="utf-8") as f:
            json.dump({
                "model_metrics": model_metrics,
                "comparative_metrics": comparative
            }, f, indent=2, ensure_ascii=False)
        
        print(f"  Saved metrics to: {metrics_path}")
        print(f"\n✓ View results at: http://localhost:3420/benchmarks")


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
    
    asyncio.run(run_benchmark(
        models,
        tasks,
        test_cases_path,
        config,
        use_cache=use_cache,
        force=args.force
    ))


if __name__ == "__main__":
    main()
