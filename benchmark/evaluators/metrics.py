"""Metrics calculation and aggregation with extensive statistics."""
import statistics
from typing import Dict, Any, List, Optional

# Overall score calculation constants
OVERALL_SCORE_BASE_WEIGHT = 0.5  # Base weight for combined reliability+quality score
OVERALL_SCORE_FACTUAL_WEIGHT = 0.3  # Weight for factual accuracy component
OVERALL_SCORE_AVERAGE_WEIGHT = 0.2  # Weight for average performance component

# Universal evaluation weights for summary quality assessment
WEIGHT_FACTUAL_ACCURACY = 0.30   # Core: Is it factually correct?
WEIGHT_COMPLETENESS = 0.25       # Core: Is everything important included?
WEIGHT_CLARITY_STRUCTURE = 0.20  # Important: Can students understand it?
WEIGHT_LANGUAGE_QUALITY = 0.15   # Important: Is it well written?
WEIGHT_USABILITY = 0.10          # Practical: Can it be used for learning?

# All evaluation dimensions (6 universal criteria)
EVALUATION_DIMENSIONS = [
    "factual_accuracy",
    "completeness",
    "clarity_structure",
    "language_quality",
    "usability",
    "technical_correctness"
]

# Reliability penalty thresholds (1-100 scale)
RELIABILITY_LOW_THRESHOLD = 50.0  # Below this: heavy penalty
RELIABILITY_MEDIUM_THRESHOLD = 70.0  # Between 50-70: moderate penalty
RELIABILITY_HEAVY_PENALTY = 0.3  # Multiplier for reliability < 50
RELIABILITY_MODERATE_PENALTY = 0.7  # Multiplier for reliability 50-70

# Consistency penalty constants
CONSISTENCY_MAX_PENALTY = 0.2  # Maximum penalty for high variance
CONSISTENCY_VARIANCE_DIVISOR = 200.0  # Divisor for variance normalization


def calculate_percentiles(values: List[float]) -> Dict[str, float]:
    """Calculate percentiles for a list of values."""
    if not values:
        return {}
    
    sorted_vals = sorted(values)
    n = len(sorted_vals)
    
    def percentile(p: float) -> float:
        if n == 1:
            return sorted_vals[0]
        index = (n - 1) * p
        lower = int(index)
        upper = min(lower + 1, n - 1)
        weight = index - lower
        return sorted_vals[lower] * (1 - weight) + sorted_vals[upper] * weight
    
    return {
        "p0": min(sorted_vals),
        "p25": percentile(0.25),
        "p50": percentile(0.50),  # median
        "p75": percentile(0.75),
        "p95": percentile(0.95),
        "p99": percentile(0.99),
        "p100": max(sorted_vals)
    }


def calculate_universal_weighted_score(aggregated_scores: Dict[str, Dict[str, float]]) -> float:
    """
    Calculate weighted score based on universal quality criteria for summaries.
    
    Weight distribution:
    - Factual Accuracy: 30%
    - Completeness: 25%
    - Clarity & Structure: 20%
    - Language Quality: 15%
    - Usability: 10%
    
    Args:
        aggregated_scores: Dict mapping dimension name to aggregated stats dict with "mean" key
        
    Returns:
        Weighted score from 1-100
    """
    def get_score(dimension: str) -> float:
        """Get score for a single dimension."""
        if dimension in aggregated_scores and "mean" in aggregated_scores[dimension]:
            return aggregated_scores[dimension]["mean"]
        return 50.0  # Default to middle if missing
    
    factual_score = get_score("factual_accuracy")
    completeness_score = get_score("completeness")
    clarity_score = get_score("clarity_structure")
    language_score = get_score("language_quality")
    usability_score = get_score("usability")
    
    weighted_score = (
        factual_score * WEIGHT_FACTUAL_ACCURACY +
        completeness_score * WEIGHT_COMPLETENESS +
        clarity_score * WEIGHT_CLARITY_STRUCTURE +
        language_score * WEIGHT_LANGUAGE_QUALITY +
        usability_score * WEIGHT_USABILITY
    )
    
    return max(1.0, min(100.0, weighted_score))


def aggregate_model_metrics(
    results: List[Dict[str, Any]], 
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Aggregate metrics for a single model across all test cases.
    
    Args:
        results: List of result dicts, each containing scores, costs, latency, etc.
        config: Optional config dict with reliability_weight and quality_weight
    
    Returns:
        Aggregated metrics dict
    """
    if not results:
        return {}
    
    # Extract all scores
    reliability_scores = [r.get("reliability_score", 0) for r in results if "reliability_score" in r]
    quality_scores: List[float] = []
    factual_scores: List[float] = []
    completeness_scores: List[float] = []
    quality_overall: List[float] = []
    
    # Universal evaluation dimension scores (6 core criteria)
    evaluation_scores: Dict[str, List[float]] = {
        "factual_accuracy": [],
        "completeness": [],
        "clarity_structure": [],
        "language_quality": [],
        "usability": [],
        "technical_correctness": []
    }
    
    costs = [r.get("cost", 0) for r in results if "cost" in r]
    latencies = [r.get("latency_ms", 0) for r in results if "latency_ms" in r]
    
    # Extract content quality scores from judge evaluations
    for r in results:
        judge_result = r.get("judge_evaluation", {})
        aggregated = judge_result.get("aggregated_scores", {})
        
        # Legacy quality score (backward compatibility)
        if "quality" in aggregated:
            quality_scores.append(aggregated["quality"]["mean"])
            quality_overall.append(aggregated["quality"]["mean"])
        elif "question_quality" in aggregated:
            quality_scores.append(aggregated["question_quality"]["mean"])
            quality_overall.append(aggregated["question_quality"]["mean"])
        elif "clarity" in aggregated:
            quality_scores.append(aggregated["clarity"]["mean"])
            quality_overall.append(aggregated["clarity"]["mean"])
        
        # Legacy dimensions
        if "factual_accuracy" in aggregated:
            factual_scores.append(aggregated["factual_accuracy"]["mean"])
        
        if "completeness" in aggregated:
            completeness_scores.append(aggregated["completeness"]["mean"])
        
        # Extract all evaluation dimensions
        for dim in evaluation_scores.keys():
            if dim in aggregated:
                evaluation_scores[dim].append(aggregated[dim]["mean"])

    # --- Backward compatibility: auto-upscale legacy 0-10 runs to 1-100 ---
    #
    # Early benchmark runs (especially for some moonshotai Modelle) used a 0-10 scale.
    # All current prompts and format checks use 1-100. To avoid mixing scales inside
    # one model, we detect obviously old runs (all scores <= 10 but > 0) and upscale.
    #
    # This detection is per-model (per results list) and only affects models whose
    # data still lives entirely in the 0-10 regime.
    all_score_values: List[float] = []
    all_score_values.extend(reliability_scores)
    all_score_values.extend(quality_overall)
    all_score_values.extend(factual_scores)
    all_score_values.extend(completeness_scores)

    # Also collect evaluation dimension values for scale detection
    for dim_scores in evaluation_scores.values():
        all_score_values.extend(dim_scores)
    
    if all_score_values:
        max_val = max(all_score_values)
        min_pos = min(v for v in all_score_values if v > 0) if any(v > 0 for v in all_score_values) else 0
        # Heuristic: treat as 0-10 scale if everything is in (0, 10] and not all zeros.
        if 0 < max_val <= 10 and min_pos > 0:
            scale = 10.0
            reliability_scores = [v * scale for v in reliability_scores]
            quality_overall = [v * scale for v in quality_overall]
            factual_scores = [v * scale for v in factual_scores]
            completeness_scores = [v * scale for v in completeness_scores]
            # Scale evaluation dimensions too
            for dim in evaluation_scores:
                evaluation_scores[dim] = [v * scale for v in evaluation_scores[dim]]

    metrics = {
        "reliability": {
            "mean": statistics.mean(reliability_scores) if reliability_scores else 0,
            "median": statistics.median(reliability_scores) if reliability_scores else 0,
            "std_dev": statistics.stdev(reliability_scores) if len(reliability_scores) > 1 else 0,
            "min": min(reliability_scores) if reliability_scores else 0,
            "max": max(reliability_scores) if reliability_scores else 0,
            "percentiles": calculate_percentiles(reliability_scores) if reliability_scores else {}
        },
        "content_quality": {
            "mean": statistics.mean(quality_overall) if quality_overall else 0,
            "median": statistics.median(quality_overall) if quality_overall else 0,
            "std_dev": statistics.stdev(quality_overall) if len(quality_overall) > 1 else 0,
            "min": min(quality_overall) if quality_overall else 0,
            "max": max(quality_overall) if quality_overall else 0,
            "percentiles": calculate_percentiles(quality_overall) if quality_overall else {}
        },
        "factual_accuracy": {
            "mean": statistics.mean(factual_scores) if factual_scores else 0,
            "median": statistics.median(factual_scores) if factual_scores else 0,
            "std_dev": statistics.stdev(factual_scores) if len(factual_scores) > 1 else 0,
            "percentiles": calculate_percentiles(factual_scores) if factual_scores else {}
        },
        "completeness": {
            "mean": statistics.mean(completeness_scores) if completeness_scores else 0,
            "median": statistics.median(completeness_scores) if completeness_scores else 0,
            "std_dev": statistics.stdev(completeness_scores) if len(completeness_scores) > 1 else 0,
            "percentiles": calculate_percentiles(completeness_scores) if completeness_scores else {}
        },
        # Abitur evaluation dimensions
        **{
            dim: {
                "mean": statistics.mean(scores) if scores else 0,
                "median": statistics.median(scores) if scores else 0,
                "std_dev": statistics.stdev(scores) if len(scores) > 1 else 0,
                "min": min(scores) if scores else 0,
                "max": max(scores) if scores else 0,
                "percentiles": calculate_percentiles(scores) if scores else {}
            }
            for dim, scores in evaluation_scores.items()
        },
        "cost": {
            "total": sum(costs),
            "mean": statistics.mean(costs) if costs else 0,
            "median": statistics.median(costs) if costs else 0,
            "percentiles": calculate_percentiles(costs) if costs else {}
        },
        "latency": {
            "mean": statistics.mean(latencies) if latencies else 0,
            "p50": calculate_percentiles(latencies).get("p50", 0) if latencies else 0,
            "p95": calculate_percentiles(latencies).get("p95", 0) if latencies else 0,
            "p99": calculate_percentiles(latencies).get("p99", 0) if latencies else 0,
            "percentiles": calculate_percentiles(latencies) if latencies else {}
        },
        "test_count": len(results)
    }
    
    # Calculate cost per quality point
    if metrics["cost"]["total"] > 0 and metrics["content_quality"]["mean"] > 0:
        metrics["cost_per_quality_point"] = metrics["cost"]["total"] / (metrics["content_quality"]["mean"] * len(results))
        metrics["cost_per_reliability_point"] = metrics["cost"]["total"] / (metrics["reliability"]["mean"] * len(results)) if metrics["reliability"]["mean"] > 0 else 0
    else:
        metrics["cost_per_quality_point"] = 0
        metrics["cost_per_reliability_point"] = 0
    
    # Calculate combined score (weighted) - now in 1-100 scale
    # Load weights from config if available, otherwise use defaults
    reliability_weight = config.get("reliability_weight", 0.3) if config else 0.3
    quality_weight = config.get("quality_weight", 0.7) if config else 0.7
    metrics["combined_score"] = (
        metrics["reliability"]["mean"] * reliability_weight +
        metrics["content_quality"]["mean"] * quality_weight
    )
    
    # Calculate reliable overall score (1-100 scale)
    # 
    # This is a more robust score that considers multiple factors:
    # 1. Reliability is critical (must be > 50 to be usable for automation)
    # 2. Content quality is important for user satisfaction
    # 3. Consistency (low std dev) indicates stable performance
    # 4. Factual accuracy is essential for educational content
    #
    # Formula breakdown:
    # - Base component: (reliability * reliability_weight + quality * quality_weight) 
    #   * reliability_penalty * consistency_penalty * OVERALL_SCORE_BASE_WEIGHT
    # - Factual component: factual_mean * OVERALL_SCORE_FACTUAL_WEIGHT
    # - Average component: (reliability + quality) / 2 * OVERALL_SCORE_AVERAGE_WEIGHT
    #
    # The penalties ensure that unreliable or inconsistent models are penalized:
    # - reliability_penalty: 0.3 if reliability < 50, 0.7 if 50-70, 1.0 if >= 70
    # - consistency_penalty: 1.0 - min(0.2, (reliability_std + quality_std) / 200.0)
    #
    # Note: The weights (0.5, 0.3, 0.2) sum to 1.0, ensuring the score stays in 1-100 range
    # after clamping. The formula is designed to prioritize reliability and factual accuracy
    # while still considering overall quality and consistency.
    reliability_mean = metrics["reliability"]["mean"]
    quality_mean = metrics["content_quality"]["mean"]
    factual_mean = metrics["factual_accuracy"]["mean"] if factual_scores else quality_mean
    
    # Penalize if reliability is too low (unusable for automation) - scaled to 1-100
    reliability_penalty = 1.0
    if reliability_mean < RELIABILITY_LOW_THRESHOLD:
        reliability_penalty = RELIABILITY_HEAVY_PENALTY
    elif reliability_mean < RELIABILITY_MEDIUM_THRESHOLD:
        reliability_penalty = RELIABILITY_MODERATE_PENALTY
    
    # Penalize high variance (inconsistent performance) - scaled to 1-100
    reliability_std = metrics["reliability"]["std_dev"]
    quality_std = metrics["content_quality"]["std_dev"]
    consistency_penalty = 1.0 - min(
        CONSISTENCY_MAX_PENALTY, 
        (reliability_std + quality_std) / CONSISTENCY_VARIANCE_DIVISOR
    )
    
    # Overall score: weighted combination with penalties
    # Base component (weighted reliability + quality with penalties)
    base_component = (
        (reliability_mean * reliability_weight + quality_mean * quality_weight) *
        reliability_penalty *
        consistency_penalty *
        OVERALL_SCORE_BASE_WEIGHT
    )
    # Factual accuracy component
    factual_component = factual_mean * OVERALL_SCORE_FACTUAL_WEIGHT
    # Average performance component
    average_component = (reliability_mean + quality_mean) / 2 * OVERALL_SCORE_AVERAGE_WEIGHT
    
    metrics["overall_score"] = base_component + factual_component + average_component
    
    # Clamp to 1-100
    metrics["overall_score"] = max(1.0, min(100.0, metrics["overall_score"]))
    
    # Calculate universal weighted score based on 6 core dimensions
    universal_aggregated = {
        dim: metrics[dim] for dim in EVALUATION_DIMENSIONS if dim in metrics
    }
    metrics["universal_weighted_score"] = calculate_universal_weighted_score(universal_aggregated)
    
    # Add category scores for detailed analysis
    metrics["quality_categories"] = {
        "factual_accuracy": {
            "mean": metrics.get("factual_accuracy", {}).get("mean", 50),
            "weight": WEIGHT_FACTUAL_ACCURACY
        },
        "completeness": {
            "mean": metrics.get("completeness", {}).get("mean", 50),
            "weight": WEIGHT_COMPLETENESS
        },
        "clarity_structure": {
            "mean": metrics.get("clarity_structure", {}).get("mean", 50),
            "weight": WEIGHT_CLARITY_STRUCTURE
        },
        "language_quality": {
            "mean": metrics.get("language_quality", {}).get("mean", 50),
            "weight": WEIGHT_LANGUAGE_QUALITY
        },
        "usability": {
            "mean": metrics.get("usability", {}).get("mean", 50),
            "weight": WEIGHT_USABILITY
        }
    }
    
    return metrics


def calculate_comparative_metrics(
    all_model_metrics: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Calculate comparative metrics across all models.
    
    Args:
        all_model_metrics: Dict mapping model_id to aggregated metrics
    
    Returns:
        Comparative metrics including rankings
    """
    if not all_model_metrics:
        return {}
    
    models = list(all_model_metrics.keys())
    
    # Rankings by different criteria
    rankings = {
        "by_reliability": sorted(
            models,
            key=lambda m: all_model_metrics[m].get("reliability", {}).get("mean", 0),
            reverse=True
        ),
        "by_content_quality": sorted(
            models,
            key=lambda m: all_model_metrics[m].get("content_quality", {}).get("mean", 0),
            reverse=True
        ),
        "by_combined_score": sorted(
            models,
            key=lambda m: all_model_metrics[m].get("combined_score", 0),
            reverse=True
        ),
        "by_overall_score": sorted(
            models,
            key=lambda m: all_model_metrics[m].get("overall_score", 0),
            reverse=True
        ),
        "by_universal_score": sorted(
            models,
            key=lambda m: all_model_metrics[m].get("universal_weighted_score", 0),
            reverse=True
        ),
        "by_cost_effectiveness": sorted(
            models,
            key=lambda m: all_model_metrics[m].get("cost_per_quality_point", float('inf')),
            reverse=False  # Lower is better
        ),
        "by_reliability_cost": sorted(
            models,
            key=lambda m: all_model_metrics[m].get("cost_per_reliability_point", float('inf')),
            reverse=False
        )
    }
    
    # Best value models (combined score / cost)
    value_scores = {}
    for model_id, metrics in all_model_metrics.items():
        combined = metrics.get("combined_score", 0)
        total_cost = metrics.get("cost", {}).get("total", 0)
        if total_cost > 0:
            value_scores[model_id] = combined / total_cost
        else:
            value_scores[model_id] = float('inf') if combined > 0 else 0
    
    rankings["by_value"] = sorted(
        models,
        key=lambda m: value_scores.get(m, 0),
        reverse=True
    )
    
    return {
        "rankings": rankings,
        "value_scores": value_scores,
        "model_count": len(models)
    }


def calculate_performance_by_category(
    results: List[Dict[str, Any]],
    category_key: str,
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate performance metrics grouped by category (e.g., topic, format_type).
    
    Args:
        results: List of result dicts
        category_key: Key in result dict to group by (e.g., "topic_category", "format_type")
    
    Returns:
        Dict mapping category value to aggregated metrics
    """
    categories = {}
    
    for result in results:
        category = result.get(category_key, "unknown")
        if category not in categories:
            categories[category] = []
        categories[category].append(result)
    
    category_metrics = {}
    for category, category_results in categories.items():
        category_metrics[category] = aggregate_model_metrics(category_results)
    
    return category_metrics


def calculate_judge_consensus_metrics(
    results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Calculate consensus metrics from judge evaluations."""
    all_variances = {}
    all_agreements = {}
    
    for result in results:
        judge_result = result.get("judge_evaluation", {})
        consensus = judge_result.get("consensus_metrics", {})
        
        for key, value in consensus.items():
            if key.endswith("_variance"):
                base_key = key.replace("_variance", "")
                if base_key not in all_variances:
                    all_variances[base_key] = []
                all_variances[base_key].append(value)
            elif key.endswith("_agreement"):
                base_key = key.replace("_agreement", "")
                if base_key not in all_agreements:
                    all_agreements[base_key] = []
                all_agreements[base_key].append(value)
    
    consensus_metrics = {}
    for key, values in all_variances.items():
        if values:
            consensus_metrics[f"{key}_mean_variance"] = statistics.mean(values)
            consensus_metrics[f"{key}_median_variance"] = statistics.median(values)
    
    for key, values in all_agreements.items():
        if values:
            consensus_metrics[f"{key}_mean_agreement"] = statistics.mean(values)
            consensus_metrics[f"{key}_median_agreement"] = statistics.median(values)
    
    return consensus_metrics


def calculate_model_metrics_by_dimension(
    all_results: List[Dict[str, Any]],
    dimension_key: str,
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Dict[str, Any]]:
    """
    Calculate metrics grouped by a dimension (e.g., task, topic, format).
    
    Args:
        all_results: List of all result dicts
        dimension_key: Key to group by (e.g., "task", "test_case_topic", "test_case_format")
    
    Returns:
        Dict mapping dimension value to aggregated metrics
    """
    dimension_groups = {}
    
    for result in all_results:
        if result.get("error"):
            continue
        dimension_value = result.get(dimension_key, "unknown")
        if dimension_value not in dimension_groups:
            dimension_groups[dimension_value] = []
        dimension_groups[dimension_value].append(result)
    
    dimension_metrics = {}
    for dimension_value, results in dimension_groups.items():
        if results:
            dimension_metrics[dimension_value] = aggregate_model_metrics(results, config)
    
    return dimension_metrics


def calculate_comprehensive_model_metrics(
    all_results: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Calculate comprehensive metrics for a model including:
    - Overall metrics (all tasks combined)
    - Task-specific metrics (summary, quiz, flashcards)
    - Topic-specific metrics (chemistry, physics, etc.)
    - Format-specific metrics (academic, ocr_like, etc.)
    
    Args:
        all_results: List of all result dicts for a single model
    
    Returns:
        Comprehensive metrics dict with all breakdowns
    """
    # Filter out errors
    valid_results = [r for r in all_results if not r.get("error")]
    
    if not valid_results:
        return {}
    
    # Overall metrics (all tasks combined)
    overall_metrics = aggregate_model_metrics(valid_results, config)
    
    # Task-specific metrics
    task_metrics = calculate_model_metrics_by_dimension(valid_results, "task", config)
    
    # Topic-specific metrics
    topic_metrics = calculate_model_metrics_by_dimension(valid_results, "test_case_topic", config)
    
    # Format-specific metrics
    format_metrics = calculate_model_metrics_by_dimension(valid_results, "test_case_format", config)
    
    # Task x Topic breakdown (nested)
    task_topic_metrics = {}
    for task in ["summary", "quiz", "flashcards"]:
        task_results = [r for r in valid_results if r.get("task") == task]
        if task_results:
            task_topic_metrics[task] = calculate_model_metrics_by_dimension(task_results, "test_case_topic", config)
    
    # Task x Format breakdown (nested)
    task_format_metrics = {}
    for task in ["summary", "quiz", "flashcards"]:
        task_results = [r for r in valid_results if r.get("task") == task]
        if task_results:
            task_format_metrics[task] = calculate_model_metrics_by_dimension(task_results, "test_case_format", config)
    
    # Topic x Format breakdown (nested)
    topic_format_metrics = {}
    topics = set(r.get("test_case_topic", "unknown") for r in valid_results)
    for topic in topics:
        topic_results = [r for r in valid_results if r.get("test_case_topic") == topic]
        if topic_results:
            topic_format_metrics[topic] = calculate_model_metrics_by_dimension(topic_results, "test_case_format", config)
    
    # Summary statistics
    summary_stats = {
        "total_tests": len(valid_results),
        "tasks_tested": list(set(r.get("task") for r in valid_results)),
        "topics_tested": list(set(r.get("test_case_topic") for r in valid_results)),
        "formats_tested": list(set(r.get("test_case_format") for r in valid_results)),
        "test_count_by_task": {
            task: len([r for r in valid_results if r.get("task") == task])
            for task in ["summary", "quiz", "flashcards"]
        },
        "test_count_by_topic": {
            topic: len([r for r in valid_results if r.get("test_case_topic") == topic])
            for topic in set(r.get("test_case_topic", "unknown") for r in valid_results)
        },
        "test_count_by_format": {
            fmt: len([r for r in valid_results if r.get("test_case_format") == fmt])
            for fmt in set(r.get("test_case_format", "unknown") for r in valid_results)
        }
    }
    
    return {
        "overall": overall_metrics,
        "by_task": task_metrics,
        "by_topic": topic_metrics,
        "by_format": format_metrics,
        "by_task_and_topic": task_topic_metrics,
        "by_task_and_format": task_format_metrics,
        "by_topic_and_format": topic_format_metrics,
        "summary_stats": summary_stats
    }
