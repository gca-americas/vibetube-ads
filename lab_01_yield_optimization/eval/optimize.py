#!/usr/bin/env python3
"""ADK Optimization Loop (`adk optimize`).

Runs closed-loop agent prompt and policy optimization against the Golden Benchmark
until achieving the target benchmark score (100%).
"""

import json
import logging
import os
import sys
import time
from pathlib import Path

# Add parent directory to path
PARENT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PARENT_DIR))

from campaign_policy_generator import run_campaign_manager_agent
from eval.eval_policy import evaluate_policy

logger = logging.getLogger("adk_optimizer")


def run_optimization_loop(max_iterations: int = 3, target_score: float = 90.0):
    """Executes closed-loop evaluation and iterative optimization."""
    print("=" * 70)
    print("⚙️ ADK Agent Optimizer: Closed-Loop Calibration")
    print("=" * 70)

    best_score = 0.0

    for iteration in range(1, max_iterations + 1):
        print(f"\n🔄 [Iteration {iteration}/{max_iterations}]")
        print("   1. Generating & deploying candidate policy...")

        try:
            run_campaign_manager_agent()
        except Exception as e:
            print(f"❌ Error during policy generation: {e}")
            continue

        print("\n   2. Running evaluation against Golden Benchmark...")
        eval_result = evaluate_policy()
        score = eval_result.get("score_pct", 0.0)

        if score > best_score:
            best_score = score

        if score >= target_score:
            print(
                f"\n🎉 Target score reached ({score:.1f}% >= {target_score:.1f}%)! Optimization complete."
            )
            return True

        print(
            f"\n⚠️ Score {score:.1f}% below target {target_score:.1f}%. Continuing iteration..."
        )

    print(f"\nOptimization loop finished. Best Score: {best_score:.1f}%")
    return best_score >= target_score


if __name__ == "__main__":
    run_optimization_loop(max_iterations=1)
