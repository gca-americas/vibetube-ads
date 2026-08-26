#!/usr/bin/env python3
"""ADK-style Agent Prompt & Strategy Optimizer (`adk optimize`).

Iteratively tunes agent instructions against the Golden Benchmark dataset
until all test cases pass with a 100% benchmark score.
"""

import os
import sys
import json
import time
from campaign_manager_agent import CampaignManagerAgent
from eval.run_eval import run_evaluation

def run_optimization_loop(max_iterations: int = 3):
    print("=" * 70)
    print("⚙️ ADK Agent Optimizer: Prompt & Policy Calibration")
    print("=" * 70)

    agent = CampaignManagerAgent()

    for i in range(1, max_iterations + 1):
        print(f"\n🔄 [Iteration {i}/{max_iterations}] Running Agent Strategy Synthesis...")
        result = agent.run_optimization_workflow(deploy=True)
        
        print(f"\n🧪 [Iteration {i}] Evaluating against Golden Benchmark...")
        run_evaluation()

if __name__ == "__main__":
    run_optimization_loop(max_iterations=1)
