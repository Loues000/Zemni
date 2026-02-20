"""Tests for per-model purge behavior in benchmark artifacts."""

import json
from pathlib import Path

import pytest

import run_benchmark


@pytest.mark.parametrize("model_to_purge", ["stepfun/step-3.5-flash:free"])
def test_purge_model_results_removes_results_and_cache(tmp_path: Path, model_to_purge: str):
    results_dir = tmp_path / "results"
    cache_dir = results_dir / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)

    keep_model = "openrouter/aurora-alpha"

    # Minimal but representative results shape used by metrics aggregation.
    results = [
        {
            "model_id": model_to_purge,
            "task": "summary",
            "test_case_id": "test_0001",
            "test_case_topic": "biology",
            "test_case_format": "clean_notes",
            "reliability_score": 10.0,
            "content_quality_score": 20.0,
            "cost": 0.001,
            "latency_ms": 1234,
            "judge_evaluation": {
                "aggregated_scores": {
                    "factual_accuracy": {"mean": 10.0},
                    "completeness": {"mean": 10.0},
                    "clarity_structure": {"mean": 10.0},
                    "language_quality": {"mean": 10.0},
                    "usability": {"mean": 10.0},
                    "technical_correctness": {"mean": 10.0},
                }
            },
        },
        {
            "model_id": keep_model,
            "task": "summary",
            "test_case_id": "test_0001",
            "test_case_topic": "biology",
            "test_case_format": "clean_notes",
            "reliability_score": 90.0,
            "content_quality_score": 95.0,
            "cost": 0.01,
            "latency_ms": 456,
            "judge_evaluation": {
                "aggregated_scores": {
                    "factual_accuracy": {"mean": 95.0},
                    "completeness": {"mean": 90.0},
                    "clarity_structure": {"mean": 90.0},
                    "language_quality": {"mean": 90.0},
                    "usability": {"mean": 90.0},
                    "technical_correctness": {"mean": 90.0},
                }
            },
        },
    ]
    (results_dir / "benchmark_results.json").write_text(json.dumps(results), encoding="utf-8")

    # Cache files are hashed names but include model_id in the JSON.
    (cache_dir / "a.json").write_text(json.dumps({"model_id": model_to_purge, "task": "summary"}), encoding="utf-8")
    (cache_dir / "b.json").write_text(json.dumps({"model_id": keep_model, "task": "summary"}), encoding="utf-8")

    config = run_benchmark.load_config()

    summary = run_benchmark.purge_model_results(
        model_id=model_to_purge,
        results_dir=results_dir,
        config=config,
        judge_quality_filter="strict",
        logger=None,
    )

    assert summary["removed_results"] == 1
    assert summary["removed_cache_files"] == 1

    remaining = json.loads((results_dir / "benchmark_results.json").read_text(encoding="utf-8"))
    assert all(r.get("model_id") != model_to_purge for r in remaining)
    assert any(r.get("model_id") == keep_model for r in remaining)

    assert not (cache_dir / "a.json").exists()
    assert (cache_dir / "b.json").exists()

    metrics = json.loads((results_dir / "benchmark_metrics.json").read_text(encoding="utf-8"))
    assert model_to_purge not in metrics.get("model_metrics", {})
    assert keep_model in metrics.get("model_metrics", {})

