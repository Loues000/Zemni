"""Generate HTML reports from benchmark results."""
import argparse
import json
from pathlib import Path
from datetime import datetime
from jinja2 import Template


REPORT_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Model Benchmark Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #3498db;
            color: white;
            font-weight: 600;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .score {
            font-weight: bold;
        }
        .score-high { color: #27ae60; }
        .score-medium { color: #f39c12; }
        .score-low { color: #e74c3c; }
        .ranking {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .rank-1 { background: #ffd700; }
        .rank-2 { background: #c0c0c0; }
        .rank-3 { background: #cd7f32; }
        .tie-marker {
            color: #8a5a00;
            font-weight: 700;
            margin-left: 4px;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .metric-card {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 6px;
        }
        .metric-label {
            font-size: 0.9em;
            color: #7f8c8d;
            margin-bottom: 5px;
        }
        .metric-value {
            font-size: 1.5em;
            font-weight: bold;
            color: #2c3e50;
        }
        .sample-output {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #3498db;
            margin-top: 10px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            max-height: 300px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Model Benchmark Report</h1>
        <p>Generated: {{ timestamp }}</p>
        <p>Models tested: {{ model_count }}</p>
        <p>Test cases: {{ test_case_count }}</p>
    </div>

    <div class="section">
        <h2>Model Rankings</h2>
        
        <h3>By Combined Score (Reliability + Content Quality)</h3>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Model</th>
                    <th>Combined Score</th>
                    <th>Reliability</th>
                    <th>Content Quality</th>
                    <th>Cost per Quality Point</th>
                </tr>
            </thead>
            <tbody>
                {% for model_id in rankings.by_combined_score[:10] %}
                <tr>
                    <td>
                        <span class="ranking rank-{{ loop.index }}">{{ loop.index }}</span>
                    </td>
                    <td><strong>{{ model_id }}</strong></td>
                    <td class="score score-high">{{ "%.2f"|format(model_metrics[model_id].combined_score) }}</td>
                    <td>{{ "%.2f"|format(model_metrics[model_id].reliability.mean) }}</td>
                    <td>{{ "%.2f"|format(model_metrics[model_id].content_quality.mean) }}</td>
                    <td>${{ "%.4f"|format(model_metrics[model_id].cost_per_quality_point) }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>

        {% if ranking_details.by_content_quality %}
        <h3>By Content Quality (95% CI)</h3>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Model</th>
                    <th>Quality Mean</th>
                    <th>95% CI</th>
                </tr>
            </thead>
            <tbody>
                {% for row in ranking_details.by_content_quality[:10] %}
                <tr>
                    <td>
                        <span class="ranking rank-{{ loop.index }}">{{ row.rank }}</span>
                    </td>
                    <td>
                        <strong>{{ row.model_id }}</strong>
                        {% if model_status[row.model_id] and model_status[row.model_id].is_partial %}
                        <span style="font-size: 0.85em; color: #8a5a00;">(partial)</span>
                        {% endif %}
                    </td>
                    <td class="score score-high">
                        {{ "%.2f"|format(row.score) }}
                        {% if row.margin_of_error is not none %}+/- {{ "%.2f"|format(row.margin_of_error) }}{% endif %}
                        {% if row.is_statistical_tie %}
                        <span class="tie-marker" title="{{ row.significance_note or 'Statistical tie with adjacent rank' }}">*</span>
                        {% endif %}
                    </td>
                    <td>
                        {% if row.ci_95_lower is not none and row.ci_95_upper is not none %}
                        [{{ "%.2f"|format(row.ci_95_lower) }}, {{ "%.2f"|format(row.ci_95_upper) }}]
                        {% else %}
                        N/A
                        {% endif %}
                    </td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
        {% endif %}

        <h3>By Cost Effectiveness</h3>
        <table>
            <thead>
                <tr>
                    <th>Rank</th>
                    <th>Model</th>
                    <th>Value Score</th>
                    <th>Combined Score</th>
                    <th>Total Cost</th>
                </tr>
            </thead>
            <tbody>
                {% for model_id in rankings.by_value[:10] %}
                <tr>
                    <td>
                        <span class="ranking rank-{{ loop.index }}">{{ loop.index }}</span>
                    </td>
                    <td><strong>{{ model_id }}</strong></td>
                    <td class="score score-high">{{ "%.2f"|format(comparative_metrics.value_scores[model_id]) }}</td>
                    <td>{{ "%.2f"|format(model_metrics[model_id].combined_score) }}</td>
                    <td>${{ "%.4f"|format(model_metrics[model_id].cost.total) }}</td>
                </tr>
                {% endfor %}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Detailed Model Metrics</h2>
        {% for model_id, metrics in model_metrics.items() %}
        <h3>{{ model_id }}</h3>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-label">Reliability Score</div>
                <div class="metric-value score-high">{{ "%.2f"|format(metrics.reliability.mean) }}</div>
                <div style="font-size: 0.8em; color: #7f8c8d;">Std Dev: {{ "%.2f"|format(metrics.reliability.std_dev) }}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Content Quality</div>
                <div class="metric-value score-high">{{ "%.2f"|format(metrics.content_quality.mean) }}</div>
                <div style="font-size: 0.8em; color: #7f8c8d;">Std Dev: {{ "%.2f"|format(metrics.content_quality.std_dev) }}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Factual Accuracy</div>
                <div class="metric-value">{{ "%.2f"|format(metrics.factual_accuracy.mean) }}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Completeness</div>
                <div class="metric-value">{{ "%.2f"|format(metrics.completeness.mean) }}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Total Cost</div>
                <div class="metric-value">${{ "%.4f"|format(metrics.cost.total) }}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg Latency (p50)</div>
                <div class="metric-value">{{ "%.0f"|format(metrics.latency.p50) }}ms</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Cost per Quality Point</div>
                <div class="metric-value">${{ "%.4f"|format(metrics.cost_per_quality_point) }}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Test Count</div>
                <div class="metric-value">{{ metrics.test_count }}</div>
            </div>
        </div>
        {% endfor %}
    </div>

    <div class="section">
        <h2>Sample Outputs</h2>
        {% for sample in sample_outputs[:5] %}
        <div style="margin-bottom: 20px;">
            <h4>{{ sample.model_id }} - {{ sample.task }} ({{ sample.test_case_id }})</h4>
            <div class="sample-output">{{ sample.output_text[:500] }}...</div>
            <div style="margin-top: 10px; font-size: 0.9em; color: #7f8c8d;">
                Reliability: {{ "%.2f"|format(sample.reliability_score) }} | 
                Quality: {{ "%.2f"|format(sample.content_quality_score) }}
            </div>
        </div>
        {% endfor %}
    </div>
</body>
</html>
"""


def load_results(results_path: Path) -> list:
    """Load benchmark results."""
    with open(results_path, encoding="utf-8") as f:
        return json.load(f)


def load_metrics(metrics_path: Path) -> dict:
    """Load benchmark metrics."""
    with open(metrics_path, encoding="utf-8") as f:
        return json.load(f)


def generate_report(
    results_path: Path,
    metrics_path: Path,
    output_path: Path
):
    """Generate HTML report from results and metrics."""
    results = load_results(results_path)
    metrics_data = load_metrics(metrics_path)
    
    model_metrics = metrics_data.get("model_metrics", {})
    comparative_metrics = metrics_data.get("comparative_metrics", {})
    rankings = comparative_metrics.get("rankings", {})
    ranking_details = comparative_metrics.get("ranking_details", {})
    model_status = comparative_metrics.get("model_status", {})
    
    # Get sample outputs
    sample_outputs = [
        {
            "model_id": r.get("model_id", "unknown"),
            "task": r.get("task", "unknown"),
            "test_case_id": r.get("test_case_id", "unknown"),
            "output_text": r.get("output_text", ""),
            "reliability_score": r.get("reliability_score", 0),
            "content_quality_score": r.get("content_quality_score", 0)
        }
        for r in results
        if not r.get("error") and r.get("output_text")
    ][:10]
    
    template = Template(REPORT_TEMPLATE)
    
    html = template.render(
        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        model_count=len(model_metrics),
        test_case_count=len(set(r.get("test_case_id") for r in results if r.get("test_case_id"))),
        model_metrics=model_metrics,
        comparative_metrics=comparative_metrics,
        rankings=rankings,
        ranking_details=ranking_details,
        model_status=model_status,
        sample_outputs=sample_outputs
    )
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    
    print(f"✓ Generated report: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Generate HTML benchmark report")
    parser.add_argument(
        "--results",
        type=str,
        default="benchmark/results/benchmark_results.json",
        help="Path to benchmark results JSON"
    )
    parser.add_argument(
        "--metrics",
        type=str,
        default="benchmark/results/benchmark_metrics.json",
        help="Path to benchmark metrics JSON"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="benchmark/reports/benchmark_report.html",
        help="Output path for HTML report"
    )
    
    args = parser.parse_args()
    
    results_path = Path(args.results)
    metrics_path = Path(args.metrics)
    output_path = Path(args.output)
    
    if not results_path.exists():
        print(f"ERROR: Results file not found: {results_path}")
        return
    
    if not metrics_path.exists():
        print(f"ERROR: Metrics file not found: {metrics_path}")
        return
    
    generate_report(results_path, metrics_path, output_path)


if __name__ == "__main__":
    main()
