# Model Benchmark System

A comprehensive benchmark system for evaluating LLM models on summary, quiz, and flashcard generation tasks.

## Setup

1. Install dependencies:
```bash
cd benchmark
pip install -r requirements.txt
```

2. Set environment variables:
```bash
export OPENROUTER_API_KEY="your-api-key"
```

Or create a `.env` file in the project root:
```
OPENROUTER_API_KEY=your-api-key
```

## Usage

## Deploy (Vercel) – Benchmark Results anzeigen

Vercel bekommt keine Dateien aus `benchmark/results/`, weil dieses Verzeichnis absichtlich in `benchmark/.gitignore` ignoriert wird.
Für Deployments wird daher ein separates, versioniertes Verzeichnis genutzt:

- `benchmark/public-results/` (wird committed → wird zu Vercel deployed)
- Lokal bleibt `benchmark/results/` die „Full-Fidelity“-Quelle

### Workflow

1. Benchmark lokal laufen lassen (schreibt nach `benchmark/results/`)
2. Deploy-JSONs exportieren:

```bash
npm run bench:publish-results
```

3. Commit + Push → Vercel zeigt die Benchmarks über `/benchmarks`

### 1. Generate Test Cases

Generate synthetic test cases using free models. Generated text is automatically saved and reused for future test cases.

```bash
python generate_tests.py --count 10
```

**Flags:**
- `--count` (required): Number of test cases to generate
  - Example: `--count 20` generates 20 test cases
- `--models` (optional): Comma-separated list of model IDs to use for generation
  - Default: Uses all free models from `benchmark_config.json`
  - Example: `--models "mistralai/devstral-2512:free,google/gemini-2.0-flash-exp:free"`
- `--output` (optional): Output path for test cases JSON file
  - Default: `benchmark/results/test_cases.json`
  - Example: `--output benchmark/results/my_test_cases.json`

**Note:** Generated text is preserved across runs. If you regenerate test cases with the same IDs, existing text will be kept unless new generation succeeds.

### 2. Run Benchmark

Run benchmarks on models to evaluate their performance:

```bash
python run_benchmark.py --models "openai/gpt-4o,anthropic/claude-sonnet-4.5" --tasks summary,quiz
```

**Flags:**
- `--models` (optional): Comma-separated list of model IDs to benchmark
  - Default: All models from `config/openrouter-models.example.json` (or local config)
  - **Important**: Use full model IDs in format `provider/model-name` (e.g., `"openai/gpt-4o"`, not just `"gpt-4o"`)
  - Example: `--models "openai/gpt-4o,anthropic/claude-sonnet-4.5,google/gemini-3-flash-preview"`
  - Models are checked for availability before benchmarking
- `--tasks` (optional): Comma-separated list of tasks to evaluate
  - Options: `summary`, `quiz`, `flashcards`
  - Default: `summary,quiz,flashcards` (all tasks)
  - Example: `--tasks summary` (only summaries)
- `--test-cases` (optional): Path to test cases JSON file
  - Default: `benchmark/results/test_cases.json`
  - Example: `--test-cases benchmark/results/my_test_cases.json`
- `--force` (flag): Ignore cache and force re-run of all benchmarks
  - Use when you want to regenerate results even if cached
  - Example: `--force`
- `--skip-cached` (flag): Skip cached results (opposite of using cache)
  - Default behavior uses cache to save time and costs
  - Use `--skip-cached` to skip already-computed results
  - Example: `--skip-cached`

**Caching:** Results are cached by default using hash-based keys (model_id + task + test_case). Use `--force` to ignore cache, or `--skip-cached` to skip cached entries.

### 3. Generate Report

Generate HTML report from benchmark results:

```bash
python reports/generator.py
```

**Flags:**
- `--results` (optional): Path to benchmark results JSON file
  - Default: `benchmark/results/benchmark_results.json`
  - Example: `--results benchmark/results/my_results.json`
- `--metrics` (optional): Path to benchmark metrics JSON file
  - Default: `benchmark/results/benchmark_metrics.json`
  - Example: `--metrics benchmark/results/my_metrics.json`
- `--output` (optional): Output path for HTML report
  - Default: `benchmark/reports/benchmark_report.html`
  - Example: `--output benchmark/reports/my_report.html`

## Features

### Cost Optimization
- **Adaptive Input Sizing**: Smaller inputs for expensive models
  - Free models: 2000 chars
  - Budget (<$1/1M): 1500 chars
  - Mid-tier ($1-5/1M): 1000 chars
  - Premium (>$5/1M): 500 chars
- **Adaptive Token Limits**: Reduced max_tokens for expensive models
  - Free/Budget: 100% of normal limits
  - Mid-tier: 75% of normal limits
  - Premium: 50% of normal limits

### Result Caching
- Hash-based caching prevents retesting same model+task+input combinations
- Cache stored in `benchmark/results/cache/`
- Saves time and API costs

### Async Execution
- Concurrent API calls (default: 30 concurrent requests)
- Configurable via `benchmark_config.json`
- Uses `asyncio.Semaphore` to respect rate limits

### Multi-Model Judge
- Consensus evaluation using 5 cost-effective judge models
- Aggregates scores (mean, median, std dev)
- Caches judge evaluations to avoid redundant calls

### Scoring System

#### Reliability Score (1-100)
Separate from content quality, measures format compliance:
- **Summaries**: H1 heading, valid markdown, no forbidden phrases, LaTeX escaping
- **Quizzes**: JSON parseability, correct schema, 4 options, valid correctIndex
- **Flashcards**: JSON parseability, correct schema, valid type field
- Minimum score is 1 (not 0) to ensure models are always rankable

#### Content Quality Score (1-100)
Evaluated by multi-model judge consensus:
- **Source Fidelity (Quelltreue)**: Matches source material exactly, no hallucinations (checks only against provided source text, not absolute correctness)
- **Completeness**: Covers key concepts from source
- **Quality**: Overall usefulness for exam prep
- **Pedagogical Usefulness**: Explanations help students understand without Google
- Minimum score is 1 (not 0) to ensure models are always rankable

#### Overall Score (1-100)
Reliable composite score that considers:
- Reliability (critical for automation) - weighted 30%
- Content quality - weighted 70%
- Consistency (low variance) - penalizes high std dev
- Source fidelity (factual accuracy) - critical component
- Applies penalties for unreliable or inconsistent models
- Formula: Base component (reliability + quality with penalties) × 0.5 + Factual component × 0.3 + Average component × 0.2

### Extensive Statistics
- Score distributions (min, max, median, percentiles p0, p25, p50, p75, p95, p99, p100, std dev)
- Cost per quality/reliability point
- Latency statistics (mean, p50, p95, p99)
- Judge consensus metrics (agreement, variance)
- Performance by topic category
- Performance by format type
- Comprehensive breakdowns: by task, by topic, by format, and nested combinations

## Configuration

Edit `benchmark/config/benchmark_config.json` to customize:

- **judge_models**: List of models used for evaluation
- **free_generation_models**: Models used to generate test cases
- **concurrency_limit**: Max concurrent API requests (default: 30)
- **reliability_weight**: Weight for reliability in combined score (default: 0.3)
- **quality_weight**: Weight for quality in combined score (default: 0.7)
- **adaptive_input_sizing**: Character limits per pricing tier
- **token_limit_multipliers**: Token limit multipliers per pricing tier

## Output Files

Results are saved to:
- `benchmark/results/benchmark_results.json`: Raw benchmark results (all model outputs, scores, costs)
- `benchmark/results/benchmark_metrics.json`: Aggregated metrics per model (scores, costs, statistics)
- `benchmark/results/cache/`: Cached results (hash-based, one file per combination)
- `benchmark/results/judge_cache/`: Cached judge evaluations
- `benchmark/reports/benchmark_report.html`: HTML report with rankings and visualizations

## Viewing Results in Web App

Benchmark results are automatically available in the Next.js app at `/benchmarks`. The results are served via API route and displayed with interactive visualizations.

## Example Workflow

```bash
# 1. Generate 20 test cases
python generate_tests.py --count 20

# 2. Run benchmark on specific models
python run_benchmark.py --models "gpt-4o,claude-sonnet-4.5" --tasks summary,quiz

# 3. View results in web app
# Navigate to http://localhost:3420/benchmarks

# 4. Or generate HTML report
python reports/generator.py --output benchmark/reports/report.html
```

## Logging

Benchmark runs create structured JSON logs in `benchmark/results/logs/`:
- One JSON object per line (JSONL format)
- Timestamped log files (e.g., `benchmark_20241201_143022.jsonl`)
- Includes: benchmark start/end, progress updates, model results, errors
- Can be analyzed with standard JSON tools or imported into analysis tools

## Troubleshooting

**No models available:**
- Check `OPENROUTER_API_KEY` is set correctly
- Verify models exist in `config/openrouter-models.example.json`
- Some free models may be temporarily unavailable

**Cache issues:**
- Use `--force` to ignore cache
- Delete `benchmark/results/cache/` to clear all cached results

**Rate limits:**
- Reduce `concurrency_limit` in `benchmark_config.json`
- Add delays between requests if needed

**Running tests:**
```bash
cd benchmark
pytest tests/ -v
```
