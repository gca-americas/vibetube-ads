"""Simulation Judge Agent module for evaluating bidding policies."""

import json
import os
import sys
from pathlib import Path
from typing import Any

from google.adk.agents import LlmAgent
from pydantic import BaseModel, Field

# Ensure current directory is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from lib.simulator import load_policy_from_code, run_simulation


class PolicyEvaluation(BaseModel):
    """Structured critique and evaluation result from the Simulation Judge."""

    score: float = Field(
        ..., description="Overall yield optimization score from 0.0 to 100.0"
    )
    impressions_won: int = Field(..., description="Total impressions won")
    effective_cpm: float = Field(..., description="Effective CPM in USD")
    total_spend: float = Field(..., description="Total budget spent in USD")
    budget_remaining: float = Field(..., description="Budget remaining in USD")
    diagnostics: str = Field(
        ..., description="Root cause analysis of performance bottlenecks"
    )
    recommendations: str = Field(
        ...,
        description="Actionable algorithmic modifications for next iteration",
    )


def evaluate_policy_code(
    policy_code: str,
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
) -> dict[str, Any]:
    """Simulates the bidding policy and generates telemetry metrics for review."""
    try:
        policy_func = load_policy_from_code(policy_code)
        result = run_simulation(
            policy_func,
            total_budget=total_budget,
            flight_duration_hours=flight_duration_hours,
            max_bid_ceiling=max_bid_ceiling,
        )
        return {
            "status": "success",
            "score": result.yield_score,
            "impressions_won": result.total_impressions,
            "total_spend": result.total_spend,
            "budget_remaining": result.budget_remaining,
            "budget_utilization_pct": result.budget_utilization_pct,
            "effective_cpm": result.effective_cpm,
            "hours_active": result.hours_active,
            "exhausted_hour": result.exhausted_hour,
            "overall_win_rate_pct": result.overall_win_rate,
            "daypart_metrics": result.daypart_metrics,
            "summary": result.summary_text,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "score": 0.0,
            "impressions_won": 0,
            "total_spend": 0.0,
            "budget_remaining": total_budget,
            "effective_cpm": 0.0,
            "summary": f"Policy compilation/execution failed: {e}",
        }


JUDGE_SYSTEM_PROMPT = """# Simulation Judge & Yield Optimization Critic

You are the Vibetube Simulation Judge Agent. Your mission is to evaluate
synthesized bidding policy scripts against market microeconomics and
formulate precise, actionable algorithmic critiques.

## Your Evaluation Workflow:
1. Call `evaluate_policy_code(policy_code)` to simulate the candidate script
   across 24 hours of auction traffic.
2. Inspect the quantitative telemetry:
   - Budget Utilization (Spend vs $2,500 total budget): The objective is to
     utilize 100% of the campaign budget over 24 hours.
   - Pacing Survival: Did the policy run out of budget too early (< hour 22)?
   - Under-spending: Did the policy leave significant budget unspent?
   - Daypart Performance: Did the policy bid competitively during Primetime?
3. Return a comprehensive evaluation with:
   - `score`: The simulation yield score (0 to 100).
   - `diagnostics`: Clear analysis of why the policy underperformed.
   - `recommendations`: Concrete mathematical pacing adjustments (e.g., dynamic
     budget pacing multipliers using budget_remaining / hours_remaining) for
     the Campaign Manager Generator Agent.
"""

judge_agent = LlmAgent(
    name="simulation_judge",
    model="gemini-2.5-flash",
    description="Simulates and critiques candidate bidding policies.",
    instruction=JUDGE_SYSTEM_PROMPT,
    tools=[evaluate_policy_code],
)
