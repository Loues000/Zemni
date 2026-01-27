"""Metrics calculation and aggregation with extensive statistics."""
import statistics
from typing import Dict, Any, List, Optional
import pandas as pd


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


def aggregate_model_metrics(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregate metrics for a single model across all test cases.
    
    Args:
        results: List of result dicts, each containing scores, costs, latency, etc.
    
    Returns:
        Aggregated metrics dict
    """
    if not results:
        return {}
    
    # Extract all scores
    reliability_scores = [r.get("reliability_score", 0) for r in results if "reliability_score" in r]
    quality_scores = []
    factual_scores = []
    completeness_scores = []
    quality_overall = []
    
    costs = [r.get("cost", 0) for r in results if "cost" in r]
    latencies = [r.get("latency_ms", 0) for r in results if "latency_ms" in r]
    
    # Extract content quality scores from judge evaluations
    for r in results:
        judge_result = r.get("judge_evaluation", {})
        aggregated = judge_result.get("aggregated_scores", {})
        
        if "quality" in aggregated:
            quality_scores.append(aggregated["quality"]["mean"])
            quality_overall.append(aggregated["quality"]["mean"])
        elif "question_quality" in aggregated:
            quality_scores.append(aggregated["question_quality"]["mean"])
            quality_overall.append(aggregated["question_quality"]["mean"])
        elif "clarity" in aggregated:
            quality_scores.append(aggregated["clarity"]["mean"])
            quality_overall.append(aggregated["clarity"]["mean"])
        
        if "factual_accuracy" in aggregated:
            factual_scores.append(aggregated["factual_accuracy"]["mean"])
        
        if "completeness" in aggregated:
            completeness_scores.append(aggregated["completeness"]["mean"])
    
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
    reliability_weight = 0.3
    quality_weight = 0.7
    metrics["combined_score"] = (
        metrics["reliability"]["mean"] * reliability_weight +
        metrics["content_quality"]["mean"] * quality_weight
    )
    
    # Calculate reliable overall score (1-100 scale)
    # This is a more robust score that considers:
    # 1. Reliability is critical (must be > 50 to be usable)
    # 2. Content quality is important
    # 3. Consistency (low std dev is better)
    # 4. Factual accuracy is essential
    reliability_mean = metrics["reliability"]["mean"]
    quality_mean = metrics["content_quality"]["mean"]
    factual_mean = metrics["factual_accuracy"]["mean"] if factual_scores else quality_mean
    
    # Penalize if reliability is too low (unusable for automation) - scaled to 1-100
    reliability_penalty = 1.0
    if reliability_mean < 50.0:
        reliability_penalty = 0.3  # Heavy penalty for unreliable models
    elif reliability_mean < 70.0:
        reliability_penalty = 0.7  # Moderate penalty
    
    # Penalize high variance (inconsistent performance) - scaled to 1-100
    reliability_std = metrics["reliability"]["std_dev"]
    quality_std = metrics["content_quality"]["std_dev"]
    consistency_penalty = 1.0 - min(0.2, (reliability_std + quality_std) / 200.0)
    
    # Overall score: weighted combination with penalties
    metrics["overall_score"] = (
        (reliability_mean * reliability_weight + quality_mean * quality_weight) *
        reliability_penalty *
        consistency_penalty *
        0.5 +  # Base score
        factual_mean * 0.3 +  # Factual accuracy is critical
        (reliability_mean + quality_mean) / 2 * 0.2  # Average performance
    )
    
    # Clamp to 1-100
    metrics["overall_score"] = max(1.0, min(100.0, metrics["overall_score"]))
    
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
    category_key: str
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
