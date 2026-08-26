#!/usr/bin/env python3
"""ADK Policy Evaluation Harness (`adk eval`).

Evaluates the deployed `compute_bid(context: AuctionContext)` in `bidding_policy.py`
against the curated Golden Benchmark dataset (`golden_dataset.json`).
"""

import json
import os
import sys
import time
from pathlib import Path

# Add parent directory to sys.path to resolve models
PARENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PARENT_DIR))

from models import AuctionContext

BENCHMARK_PATH = Path(__file__).parent / "golden_dataset.json"
POLICY_PATH = PARENT_DIR / "bidding_policy.py"


def evaluate_policy() -> dict:
    """Runs evaluation benchmark against the deployed bidding policy."""
    print("=" * 70)
    print("🧪 ADK Policy Evaluation: Running Golden Benchmark")
    print("=" * 70)

    if not BENCHMARK_PATH.exists():
        print(f"❌ Golden dataset not found: {BENCHMARK_PATH}")
        sys.exit(1)

    if not POLICY_PATH.exists():
        print(f"❌ Bidding policy not found: {POLICY_PATH}")
        sys.exit(1)

    benchmark = json.loads(BENCHMARK_PATH.read_text(encoding="utf-8"))
    policy_code = POLICY_PATH.read_text(encoding="utf-8")

    scope = {}
    try:
        exec(policy_code, scope)
        compute_bid_fn = scope.get("compute_bid")
        if not callable(compute_bid_fn):
            raise ValueError("`compute_bid` function not defined in policy.")
    except Exception as e:
        print(f"❌ Failed to compile bidding policy: {e}")
        sys.exit(1)

    test_cases = benchmark.get("test_cases", [])
    total = len(test_cases)
    passed = 0
    start_time = time.time()

    print(
        f"{'TEST ID':<30} | {'CATEGORY':<18} | {'BID':<8} | {'EXPECTED':<12} | {'STATUS'}"
    )
    print("-" * 80)

    results = []
    for tc in test_cases:
        tc_id = tc["id"]
        category = tc["category"]
        exp_min = tc["expected_bid_range"]["min"]
        exp_max = tc["expected_bid_range"]["max"]

        try:
            context_obj = AuctionContext(**tc["input_context"])
            bid = float(compute_bid_fn(context_obj))
            is_valid = exp_min <= bid <= exp_max
            if is_valid:
                passed += 1

            status = "✅ PASS" if is_valid else "❌ FAIL"
            exp_str = f"${exp_min:.2f}-${exp_max:.2f}"
            bid_str = f"${bid:.2f}"
            print(
                f"{tc_id:<30} | {category:<18} | {bid_str:<8} | {exp_str:<12} | {status}"
            )
            results.append(
                {
                    "id": tc_id,
                    "passed": is_valid,
                    "bid": bid,
                    "expected": [exp_min, exp_max],
                }
            )
        except Exception as e:
            print(f"{tc_id:<30} | {category:<18} | {'ERROR':<8} | {'N/A':<12} | ❌ {e}")
            results.append({"id": tc_id, "passed": False, "error": str(e)})

    elapsed_ms = (time.time() - start_time) * 1000
    score_pct = (passed / total) * 100 if total > 0 else 0.0

    print("-" * 80)
    print(f"\n📈 Evaluation Summary:")
    print(f"   • Benchmark:    {benchmark.get('dataset_name')}")
    print(f"   • Passed Cases: {passed}/{total}")
    print(f"   • Score:        {score_pct:.1f}%")
    print(f"   • Duration:     {elapsed_ms:.1f}ms")

    return {
        "total": total,
        "passed": passed,
        "score_pct": score_pct,
        "results": results,
    }


if __name__ == "__main__":
    evaluate_policy()
