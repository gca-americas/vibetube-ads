"""Auction simulation engine for evaluating bidding policies."""

import math
import random
from dataclasses import dataclass, field
from types import ModuleType
from typing import Callable

from lib.models import AuctionContext


@dataclass
class SimulationResult:
    """Quantitative performance metrics from an auction simulation run."""

    total_impressions: int
    total_spend: float
    budget_remaining: float
    budget_utilization_pct: float
    effective_cpm: float
    overall_win_rate: float
    hours_active: float
    exhausted_hour: float | None
    yield_score: float
    daypart_metrics: dict[str, dict[str, float]] = field(default_factory=dict)
    summary_text: str = ""


def _generate_market_p90(hour: float) -> tuple[str, float]:
    """Generates market daypart and competitor P90 clearing price for an hour."""
    if hour < 6.0:
        daypart = "late_night"
        base_p90 = 0.90 + 0.10 * math.sin(hour)
    elif hour < 11.0:
        daypart = "morning"
        base_p90 = 1.40 + (hour - 6.0) * 0.22
    elif hour < 13.5:
        daypart = "lunch"
        base_p90 = 3.80 + 0.50 * math.sin((hour - 11.0) * math.pi / 2.5)
    elif hour < 14.5:
        daypart = "afternoon"
        base_p90 = 2.60
    elif hour < 16.5:
        daypart = "afternoon"  # Algorithmic bidding war escalation
        progress = (hour - 14.5) / 2.0
        base_p90 = 3.50 + progress * 5.70
    elif hour < 17.5:
        daypart = "afternoon"  # Post-war dropout
        base_p90 = 1.80
    elif hour < 22.0:
        daypart = "primetime"  # Primetime organic surge
        base_p90 = 9.40 + 0.25 * math.sin(hour)
    else:
        daypart = "late_night"
        progress = (hour - 22.0) / 2.0
        base_p90 = max(0.90, 9.40 - progress * 8.50)

    return daypart, round(base_p90, 2)


def run_simulation(
    policy_func: Callable[[AuctionContext], float],
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
    auctions_per_hour: int = 25000,
    seed: int = 42,
) -> SimulationResult:
    """Simulates a full campaign flight against dynamic market microeconomics.

    Returns a SimulationResult with metrics and calculated yield score (0-100).
    """
    random.seed(seed)
    budget_remaining = total_budget
    total_impressions = 0
    total_spend = 0.0
    exhausted_hour: float | None = None

    p90_history: list[float] = []
    win_rate_history: list[float] = []
    active_bid: float | None = None

    daypart_stats: dict[str, dict[str, float]] = {
        "morning": {"auctions": 0, "wins": 0, "spend": 0.0},
        "lunch": {"auctions": 0, "wins": 0, "spend": 0.0},
        "afternoon": {"auctions": 0, "wins": 0, "spend": 0.0},
        "primetime": {"auctions": 0, "wins": 0, "spend": 0.0},
        "late_night": {"auctions": 0, "wins": 0, "spend": 0.0},
    }

    steps = int(flight_duration_hours * 2)  # 30-minute intervals
    for step in range(steps):
        hour = (step / steps) * flight_duration_hours
        if budget_remaining < 0.50:
            if exhausted_hour is None:
                exhausted_hour = round(hour, 1)
            break

        hours_remaining = max(0.0, flight_duration_hours - hour)
        daypart, market_p90 = _generate_market_p90(hour)
        p90_history.append(market_p90)
        if len(p90_history) > 10:
            p90_history.pop(0)

        recent_win_rate = (
            sum(win_rate_history[-5:]) / len(win_rate_history[-5:])
            if win_rate_history
            else 0.50
        )

        context = AuctionContext(
            daypart=daypart,
            budget_remaining=round(budget_remaining, 2),
            hours_remaining=round(hours_remaining, 2),
            max_bid_ceiling=max_bid_ceiling,
            win_rate=round(recent_win_rate, 3),
            p90=market_p90,
            p90_history=list(p90_history),
            win_rate_history=list(win_rate_history),
            active_bid_cpm=active_bid,
        )

        try:
            bid = policy_func(context)
            bid = min(max_bid_ceiling, max(0.50, float(bid)))
        except Exception:
            bid = 0.50  # Fallback on runtime exception

        active_bid = bid
        step_auctions = auctions_per_hour // 2
        step_wins = 0
        step_spend = 0.0

        for _ in range(step_auctions):
            cost = bid / 1000.0
            if budget_remaining < cost:
                if exhausted_hour is None:
                    exhausted_hour = round(hour, 1)
                break

            # Competitor bid around P90
            jitter = (random.random() - 0.5) * 0.50
            competitor_bid = max(0.15, market_p90 + jitter)

            if bid > competitor_bid:
                budget_remaining -= cost
                step_spend += cost
                step_wins += 1
                total_impressions += 1
                total_spend += cost

        step_win_rate = step_wins / step_auctions if step_auctions > 0 else 0.0
        win_rate_history.append(step_win_rate)
        if len(win_rate_history) > 10:
            win_rate_history.pop(0)

        stats = daypart_stats[daypart]
        stats["auctions"] += step_auctions
        stats["wins"] += step_wins
        stats["spend"] += step_spend

    overall_win_rate = (
        (total_impressions / (auctions_per_hour * flight_duration_hours)) * 100.0
        if flight_duration_hours > 0
        else 0.0
    )
    effective_cpm = (
        (total_spend / total_impressions) * 1000.0 if total_impressions > 0 else 0.0
    )
    hours_active = (
        exhausted_hour if exhausted_hour is not None else flight_duration_hours
    )

    # Calculate balanced Yield Score (0 to 100):
    # 1. Budget Utilization (50% weight): Target spending 100% of budget.
    # 2. Impression Volume (30% weight): Maximize scale of impressions won.
    # 3. Pacing Survival (20% weight): Must survive 24 hours without running out early.
    budget_utilization_ratio = (
        min(1.0, total_spend / total_budget) if total_budget > 0 else 0.0
    )
    budget_utilization_pct = round(budget_utilization_ratio * 100.0, 1)
    utilization_score = budget_utilization_ratio * 50.0

    impressions_score = min(30.0, (total_impressions / 500000.0) * 30.0)

    pacing_score = (hours_active / flight_duration_hours) * 20.0
    yield_score = round(utilization_score + impressions_score + pacing_score, 1)

    summary = (
        f"Yield Score: {yield_score}/100 | "
        f"Impressions Won: {total_impressions:,} | "
        f"Spend: ${total_spend:.2f}/${total_budget:.2f} ({budget_utilization_pct}%) | "
        f"eCPM: ${effective_cpm:.2f} | "
        f"Flight Active: {hours_active:.1f}/{flight_duration_hours:.0f}h"
    )

    return SimulationResult(
        total_impressions=total_impressions,
        total_spend=round(total_spend, 2),
        budget_remaining=round(budget_remaining, 2),
        budget_utilization_pct=budget_utilization_pct,
        effective_cpm=round(effective_cpm, 2),
        overall_win_rate=round(overall_win_rate, 2),
        hours_active=hours_active,
        exhausted_hour=exhausted_hour,
        yield_score=yield_score,
        daypart_metrics=daypart_stats,
        summary_text=summary,
    )


def load_policy_from_code(code_str: str) -> Callable[[AuctionContext], float]:
    """Compiles a Python code string and extracts the compute_bid function."""
    mod = ModuleType("dynamic_policy")
    exec(code_str, mod.__dict__)
    if not hasattr(mod, "compute_bid"):
        raise ValueError("Code does not define compute_bid(context)")
    return getattr(mod, "compute_bid")
