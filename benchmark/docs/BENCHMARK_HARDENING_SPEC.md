# Benchmark Hardening Specification

**Version**: 1.0  
**Date**: 2026-02-15  
**Status**: Draft for Implementation

---

## Executive Summary

This document specifies six hardening measures to increase the **statistical reliability** and **interpretability** of the Zemni model benchmark. The current benchmark (n=18 tests per model, single-task coverage) lacks power to discriminate between top models and provides no uncertainty quantification. These changes aim to:

- Detect medium effect sizes (Cohen's d ≈ 0.5) with 80% statistical power
- Provide confidence intervals for all reported means
- Ensure balanced coverage across domains and formats
- Eliminate weak models from rankings via minimum consensus requirements

---

## 1. Sample Size Requirements

### Minimum Sample Size
- **Per model per task**: n ≥ 50 tests
- **Rationale**: With n=50, a paired t-test can detect a medium effect (d=0.5) at α=0.05 with ~80% power
- **Current gap**: Only n=18 in latest run → need 2.8× increase

### Power Analysis Reference
```
Effect Size (d) | n required (α=0.05, power=0.8)
----------------|--------------------------------
0.3 (small)     | ~175
0.5 (medium)    | ~64
0.8 (large)     | ~26
```

### Implementation
- Update `generate_tests.py` default from `--count 20` to `--count 60` (buffer for filtering)
- Add validation in `run_benchmark.py`: warn if <50 tests after filtering

---

## 2. Confidence Interval Reporting

### Required CI Fields
Every mean score in `benchmark_metrics.json` must include:
- `mean`: Point estimate
- `ci_95_lower`: Lower bound of 95% CI
- `ci_95_upper`: Upper bound of 95% CI
- `stderr`: Standard error of the mean

### CI Calculation
For sample size n with standard deviation s:
```
CI = mean ± t(0.975, n-1) × (s / √n)
```
Use t-distribution (not normal) for n < 30; normal approximation acceptable for n ≥ 30.

### Ranking Interpretation Rules
- **Clear winner**: Model A's CI entirely above Model B's CI
- **Statistical tie**: CIs overlap → flag with "≈" in UI
- **Example**: Top1 (95.5 ± 1.2) vs Top2 (94.8 ± 1.5) → overlap → tie

### UI Indicators
- Add asterisk (*) to rankings: `1. model-x 95.5 ± 1.2*`
- Tooltip: "* Statistically indistinguishable from #2"

---

## 3. Balanced Test Set

### Coverage Matrix
Must maintain balance across:

| Dimension | Categories | Min per Category |
|-----------|------------|------------------|
| Topic | chemistry, physics, biology, cs, math, economics, history, psychology | 6 tests each |
| Format | simple, academic, high_density, ocr_like | 12 tests each |

### Balance Checks
- `generate_tests.py` must enforce minimum per cell in topic×format matrix
- Minimum 3 tests per (topic, format) combination → 8×4×3 = 96 total minimum
- Current imbalance: cs=5, history=1 → violates balance

### Stratified Sampling
When selecting test cases for a run:
1. Group by (topic, format)
2. Ensure proportional representation
3. Never drop entire topic or format categories

---

## 4. Task Coverage Requirements

### Minimum Task Completion
For a model to appear in **overall rankings**, it must have:
- ≥30 tests in **summary**
- ≥10 tests in **quiz**
- ≥10 tests in **flashcards**

### Partial Coverage Handling
- Models missing tasks appear in task-specific rankings only
- Overall score computed only for complete models
- UI shows "(partial)" badge for incomplete models

### Rationale
Prevents models that excel only at summaries (easiest task) from ranking above generalists.

---

## 5. Judge Robustness Standards

### Minimum Judge Count
- Every evaluation requires **≥3 judges**
- Results with <3 judges marked as "low confidence"

### Consensus Quality Thresholds
| Metric | Acceptable | Warning | Critical |
|--------|------------|---------|----------|
| Judge variance per dimension | < 25 | 25-100 | > 100 |
| Judge agreement score | > 0.9 | 0.7-0.9 | < 0.7 |

### Low Consensus Handling
- Flag results with `consensus_flag: "high_variance"` when variance > 100
- Exclude flagged results from model mean calculations
- Require re-judging or additional judges for flagged items

### Implementation
- Update `llm_judge.py` to log variance warnings
- Add `judge_quality_filter` option to `run_benchmark.py`

---

## 6. Adaptive Input Standardization

### Current Issue
Different pricing tiers get different input lengths (free=2000, premium=300 chars), reducing comparability.

### Standardization Plan

#### Option A: Fixed Input Length (Recommended)
- Use **uniform 1500 characters** for all models
- Rationale: Sufficient for context, standardizes comparison

#### Option B: Tier-Adjusted Scoring
- If variable lengths required, apply length penalty factor:
  ```
  adjusted_score = raw_score × (actual_length / 1500)^0.1
  ```
- Document correction in report

### Documentation Requirement
- Report must include "Input Length Distribution" table
- Flag if any model receives <1000 chars average

---

## Implementation Roadmap

### Phase 1: Immediate (Week 1)
1. Create `analyze_significance.py` script
2. Add CI fields to `metrics.py` aggregation
3. Generate sample report with CI annotations

### Phase 2: Test Set Expansion (Week 2-3)
1. Generate 60 additional test cases with stratification
2. Validate balance across topic×format matrix
3. Re-run benchmark for all models

### Phase 3: Integration (Week 4)
1. Update UI to display CI and significance flags
2. Add "low consensus" badges
3. Document new methodology in README

### Phase 4: Validation (Week 5)
1. Verify Top1 vs Top2 distinction power
2. Check judge variance distributions
3. Publish hardened benchmark report

---

## Success Metrics

After hardening, the benchmark should demonstrate:

- [ ] ≥50 tests per model per task
- [ ] 95% CI width < 4 points for top models
- [ ] No topic/format category with <3 tests
- [ ] 100% of results with ≥3 judges
- [ ] <5% of results flagged as "high variance"
- [ ] Clear statistical separation between top 2 models (CI non-overlap)

---

## Appendix: Statistical Formulas

### Paired Difference Test
For comparing Model A vs Model B across same test cases:

```python
# Paired differences
diffs = [score_a[i] - score_b[i] for i in common_cases]
mean_diff = mean(diffs)
std_diff = stdev(diffs)
n = len(diffs)

# 95% CI for difference
t_crit = t.ppf(0.975, n-1)
ci_lower = mean_diff - t_crit * (std_diff / sqrt(n))
ci_upper = mean_diff + t_crit * (std_diff / sqrt(n))

# Significance
is_significant = (ci_lower > 0) or (ci_upper < 0)
```

### Effect Size (Cohen's d)
```python
d = mean_diff / std_diff
# Small: 0.2, Medium: 0.5, Large: 0.8
```

---

## References

- Cohen, J. (1988). Statistical Power Analysis for the Behavioral Sciences
- Cumming, G. (2012). Understanding The New Statistics
- Benchmark lessons from `tasks/lessons.md` (content_quality aggregation fix)
