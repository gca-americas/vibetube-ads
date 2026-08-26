#!/usr/bin/env python3
"""ADK-style Evaluation Runner for Golden Benchmark Dataset.

Evaluates the synthesized `compute_bid(context)` function in `bidding_policy.py`
against the curated golden dataset (`golden_dataset.json`).
"""

import os
import sys
import json
import time

BENCHMARK_PATH = "/Users/ljhenne/Git/github.com/gca-americas/vibetube-ads/lab_01_yield_optimization/eval/golden_dataset.json"
POLICY_PATH = "/Users/ljhenne/Git/github.com/gca-americas/vibetube-ads/lab_01_yield_optimization/bidding_policy.py"

def run_evaluation():
    print("=" * 70)
    print("🧪 ADK Agent Evaluation: Running Golden Benchmark")
    print("=" * 70)

    # 1. Load Golden Benchmark
    with open(BENCHMARK_PATH, "r", encoding="utf-8") as f:
        benchmark = json.load(f)

    print(f"📊 Dataset:    {benchmark['dataset_name']} (v{benchmark['version']})")
    print(f"🎯 Target:     {benchmark['target_function']}")
    print(f"📁 Policy File: {POLICY_PATH}\n")

    # 2. Load Policy Script
    if not os.path.exists(POLICY_PATH):
        print(f"❌ Policy file not found: {POLICY_PATH}")
        sys.exit(1)

    with open(POLICY_PATH, "r", encoding="utf-8") as f:
        policy_code = f.read()

    scope = {}
    try:
        exec(policy_code, scope)
        compute_bid_fn = scope["compute_bid"]
    except Exception as e:
        print(f"❌ Failed to compile policy script: {e}")
        sys.exit(1)

    # 3. Execute Test Cases
    total_cases = len(benchmark["test_cases"])
    passed_cases = 0
    start_time = time.time()

    print(f"{'TEST ID':<30} | {'CATEGORY':<18} | {'BID':<8} | {'EXPECTED':<12} | {'STATUS'}")
    print("-" * 80)

    for tc in benchmark["test_cases"]:
        tc_id = tc["id"]
        category = tc["category"]
        ctx = tc["input_context"]
        exp_min = tc["expected_bid_range"]["min"]
        exp_max = tc["expected_bid_range"]["max"]

        try:
            bid = float(compute_bid_fn(ctx))
            is_valid = exp_min <= bid <= exp_max
            status = "✅ PASS" if is_valid else "❌ FAIL"
            if is_valid:
                passed_cases += 1
            
            exp_str = f"${exp_min:.2f}-${exp_max:.2f}"
            bid_str = f"${bid:.2f}"
            print(f"{tc_id:<30} | {category:<18} | {bid_str:<8} | {exp_str:<12} | {status}")
        except Exception as e:
            print(f"{tc_id:<30} | {category:<18} | {'ERROR':<8} | {'N/A':<12} | ❌ EXCEPTION: {e}")

    elapsed = (time.time() - start_time) * 1000
    accuracy = (passed_cases / total_cases) * 100

    print("-" * 80)
    print(f"\n📈 Evaluation Summary:")
    print(f"   • Total Cases:     {total_cases}")
    print(f"   • Passed Cases:    {passed_cases}/{total_cases}")
    print(f"   • Benchmark Score: {accuracy:.1f}%")
    print(f"   • Execution Time:  {elapsed:.1f}ms")

    if passed_cases == total_cases:
        print("\n🎉 100% Golden Benchmark Pass! Policy ready for production deployment.")
    else:
        print(f"\n⚠️ {total_cases - passed_cases} test cases failed. Use `adk optimize` to calibrate prompt.")

if __name__ == "__main__":
    run_evaluation()
