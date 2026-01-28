"""Copy benchmark results to benchmark/public-results for Vercel deployments.

Local development should keep using benchmark/results for full-fidelity data.
On Vercel, app/api/benchmarks reads from benchmark/public-results.
"""

from __future__ import annotations

import shutil
from pathlib import Path


RESULTS_DIR = Path(__file__).parent / "results"
PUBLIC_RESULTS_DIR = Path(__file__).parent / "public-results"

FILES_TO_COPY = (
    "benchmark_results.json",
    "benchmark_metrics.json",
)


def copy_results_for_deploy() -> int:
    PUBLIC_RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    copied = 0
    for name in FILES_TO_COPY:
        src = RESULTS_DIR / name
        dst = PUBLIC_RESULTS_DIR / name

        if not src.exists():
            print(f"[skip] {src} not found")
            continue

        shutil.copy2(src, dst)
        copied += 1
        print(f"[ok] copied {src} -> {dst}")

    if copied == 0:
        print("[warn] no files copied (did you run the benchmark yet?)")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(copy_results_for_deploy())

