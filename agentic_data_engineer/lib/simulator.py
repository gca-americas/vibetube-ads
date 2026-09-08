"""Auction simulation engine for evaluating bidding policies."""

import argparse
import json
import math
import os
import random
import sys
import traceback
from dataclasses import asdict, dataclass, field
from types import ModuleType
from typing import Callable

# Ensure the root lab directory is in sys.path
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_LAB_ROOT = os.path.dirname(_CURRENT_DIR)
if _LAB_ROOT not in sys.path:
    sys.path.insert(0, _LAB_ROOT)

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
    points: list[dict] = field(default_factory=list)
    shocks: list[dict] = field(default_factory=list)


@dataclass
class MarketShock:
    """A transient volatility event (bidding war surge or exchange dropout)."""

    center_hour: float
    duration_hours: float
    amplitude: float
    name: str
    phase_type: str = "war"  # "war" | "dropout"

    def impact(self, hour: float) -> float:
        sigma = max(0.2, self.duration_hours / 2.5)
        dist = hour - self.center_hour
        return self.amplitude * math.exp(-(dist * dist) / (2.0 * sigma * sigma))


def base_diurnal_p90(hour: float) -> float:
    """Smooth organic diurnal expectation curve across 24 hours.

    Represents the expected market clearing price across time-of-day.
    The ensemble average of all simulated days converges to this smooth curve.
    """
    if hour < 6.0:
        return 0.90 + 0.10 * math.sin(hour)
    elif hour < 12.0:
        return 1.40 + (hour - 6.0) * 0.18
    elif hour < 14.0:
        return 3.80 + 0.50 * math.sin((hour - 12.0) * math.pi / 2.0)
    elif hour < 17.0:
        prog = (hour - 14.0) / 3.0
        return 2.60 - 0.20 * math.sin(prog * math.pi)
    elif hour < 22.0:
        return 9.40 + 0.25 * math.sin(hour)
    else:
        prog = (hour - 22.0) / 2.0
        return max(0.90, 9.40 - prog * 8.50)


def generate_market_shocks(seed: int = 42) -> list[MarketShock]:
    """Generates stochastic volatility shocks for a 24-hour campaign flight.

    Seed 42 represents the canonical workshop incident day (afternoon bidding war
    at 2:30 PM followed by post-war dropout), ensuring historical BigQuery telemetry
    matches the workshop tutorial. Other seeds produce randomized shocks at arbitrary
    times of day (0 to 2 shocks per day), whose long-run ensemble average converges
    cleanly to the smooth diurnal baseline curve.
    """
    if seed == 42:
        return [
            MarketShock(
                center_hour=15.5,
                duration_hours=2.0,
                amplitude=5.70,
                name="Afternoon Bidding War",
                phase_type="war",
            ),
            MarketShock(
                center_hour=16.8,
                duration_hours=0.6,
                amplitude=-1.00,
                name="Post-War Dropout",
                phase_type="dropout",
            ),
        ]

    rng = random.Random(seed)
    # Number of shocks on this flight: 0 (30% calm days), 1 (50%), 2 (20% volatile days)
    num_shocks = rng.choices([0, 1, 2], weights=[0.30, 0.50, 0.20])[0]
    shocks: list[MarketShock] = []

    for _ in range(num_shocks):
        center = round(rng.uniform(8.0, 21.0), 1)
        duration = round(rng.uniform(0.8, 2.2), 1)
        hour_int = int(center)
        # 60% chance of competitor bidding war surge, 40% chance of exchange dropout
        if rng.random() < 0.60:
            amplitude = round(rng.uniform(2.5, 5.5), 2)
            name = f"Algorithmic Surge @ {hour_int:02d}:00"
            phase_type = "war"
        else:
            amplitude = -round(rng.uniform(1.2, 2.5), 2)
            name = f"Exchange Dropout @ {hour_int:02d}:00"
            phase_type = "dropout"

        shocks.append(
            MarketShock(
                center_hour=center,
                duration_hours=duration,
                amplitude=amplitude,
                name=name,
                phase_type=phase_type,
            )
        )

    return shocks


def _generate_market_p90(
    hour: float, seed: int = 42, shocks: list[MarketShock] | None = None
) -> tuple[str, float, str, str]:
    """Generates market daypart, competitor P90 price, phase id, and phase name."""
    if seed == 42 and shocks is None:
        # Canonical workshop flight logic (ensures 100% exact parity with BigQuery logs & tutorial)
        if hour < 6.0:
            return "late_night", round(0.90 + 0.10 * math.sin(hour), 2), "late_night", "Late-Night Cooldown"
        elif hour < 12.0:
            return "morning", round(1.40 + (hour - 6.0) * 0.18, 2), "morning", "Morning Ramp-Up"
        elif hour < 14.0:
            return "lunch", round(3.80 + 0.50 * math.sin((hour - 12.0) * math.pi / 2.0), 2), "lunch", "Lunch Rush"
        elif hour < 14.5:
            return "afternoon", 2.60, "afternoon", "Afternoon Stabilization"
        elif hour < 16.5:
            progress = (hour - 14.5) / 2.0
            return "afternoon", round(3.50 + progress * 5.70, 2), "war", "Afternoon Bidding War"
        elif hour < 17.0:
            return "afternoon", 1.80, "dropout", "Post-War Dropout"
        elif hour < 22.0:
            return "primetime", round(9.40 + 0.25 * math.sin(hour), 2), "primetime", "Primetime Organic Surge"
        else:
            progress = (hour - 22.0) / 2.0
            return "late_night", round(max(0.90, 9.40 - progress * 8.50), 2), "late_night", "Late-Night Cooldown"

    # Dynamic diurnal + stochastic shocks model
    if hour < 6.0:
        daypart = "late_night"
        phase = "late_night"
        phase_name = "Late-Night Cooldown"
    elif hour < 12.0:
        daypart = "morning"
        phase = "morning"
        phase_name = "Morning Ramp-Up"
    elif hour < 14.0:
        daypart = "lunch"
        phase = "lunch"
        phase_name = "Lunch Rush"
    elif hour < 17.0:
        daypart = "afternoon"
        phase = "afternoon"
        phase_name = "Afternoon Baseline"
    elif hour < 22.0:
        daypart = "primetime"
        phase = "primetime"
        phase_name = "Primetime Organic Surge"
    else:
        daypart = "late_night"
        phase = "late_night"
        phase_name = "Late-Night Cooldown"

    base_p90 = base_diurnal_p90(hour)
    if shocks is not None:
        shock_impact = sum(s.impact(hour) for s in shocks)
        dominant_shock = None
        max_abs_impact = 0.40
        for s in shocks:
            imp = abs(s.impact(hour))
            if imp > max_abs_impact:
                max_abs_impact = imp
                dominant_shock = s

        if dominant_shock is not None:
            phase = dominant_shock.phase_type
            phase_name = dominant_shock.name

        p90 = max(0.50, base_p90 + shock_impact)
    else:
        p90 = max(0.50, base_p90)

    return daypart, round(p90, 2), phase, phase_name


def run_simulation(
    policy_func: Callable[[AuctionContext], float],
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
    auctions_per_hour: int = 25000,
    seed: int = 42,
) -> SimulationResult:
    """Simulates a full campaign flight against dynamic market microeconomics.

    Returns a SimulationResult with metrics, calculated yield score, and trajectory points.
    """
    random.seed(seed)
    shocks = generate_market_shocks(seed) if seed != 42 else None
    budget_remaining = total_budget
    total_impressions = 0
    total_spend = 0.0
    exhausted_hour: float | None = None

    last_observed_p90 = round(base_diurnal_p90(0.0), 2)
    p90_history: list[float] = [last_observed_p90]
    win_rate_history: list[float] = []
    active_bid: float | None = None
    points: list[dict] = []

    daypart_stats: dict[str, dict[str, float]] = {
        "morning": {"auctions": 0, "wins": 0, "spend": 0.0},
        "lunch": {"auctions": 0, "wins": 0, "spend": 0.0},
        "afternoon": {"auctions": 0, "wins": 0, "spend": 0.0},
        "primetime": {"auctions": 0, "wins": 0, "spend": 0.0},
        "late_night": {"auctions": 0, "wins": 0, "spend": 0.0},
    }

    steps = int(flight_duration_hours * 2)  # 48 30-minute intervals
    step_auctions = auctions_per_hour // 2

    for step in range(steps):
        hour = (step / steps) * flight_duration_hours
        hours_remaining = max(0.0, flight_duration_hours - hour)

        recent_win_rate = (
            sum(win_rate_history[-3:]) / len(win_rate_history[-3:])
            if win_rate_history
            else 0.50
        )

        step_wins = 0
        step_spend = 0.0
        effective_bid = 0.0

        # Clock-based daypart segment
        if hour < 6.0:
            current_daypart = "late_night"
        elif hour < 12.0:
            current_daypart = "morning"
        elif hour < 14.0:
            current_daypart = "lunch"
        elif hour < 17.0:
            current_daypart = "afternoon"
        elif hour < 22.0:
            current_daypart = "primetime"
        else:
            current_daypart = "late_night"

        if budget_remaining < 0.50:
            if exhausted_hour is None:
                exhausted_hour = round(hour, 1)
            effective_bid = 0.0
        else:
            # NON-CLAIRVOYANT CONTEXT: Agent bids using only observed historical telemetry
            context = AuctionContext(
                daypart=current_daypart,
                budget_remaining=round(budget_remaining, 2),
                hours_remaining=round(hours_remaining, 2),
                max_bid_ceiling=max_bid_ceiling,
                win_rate=round(recent_win_rate, 3),
                p90=last_observed_p90,
                p90_history=list(p90_history),
                win_rate_history=list(win_rate_history),
                active_bid_cpm=active_bid,
            )

            try:
                bid = policy_func(context)
                bid = min(max_bid_ceiling, max(0.50, float(bid)))
            except Exception:
                # If policy raises an error mid-flight, fallback to safety floor
                bid = 0.50

            active_bid = bid
            effective_bid = bid

        # The true market clearing physics for THIS interval (unrevealed to bidder upfront)
        daypart, market_p90, phase, phase_name = _generate_market_p90(
            hour, seed=seed, shocks=shocks
        )

        if budget_remaining >= 0.50:
            for _ in range(step_auctions):
                cost = effective_bid / 1000.0
                if budget_remaining < cost:
                    if exhausted_hour is None:
                        exhausted_hour = round(hour, 1)
                    effective_bid = 0.0
                    break

                # Competitor bid around current market P90
                jitter = (random.random() - 0.5) * 0.50
                competitor_bid = max(0.15, market_p90 + jitter)

                if effective_bid > competitor_bid:
                    budget_remaining -= cost
                    step_spend += cost
                    step_wins += 1
                    total_impressions += 1
                    total_spend += cost

        step_win_rate = step_wins / step_auctions if step_auctions > 0 else 0.0
        win_rate_history.append(step_win_rate)
        if len(win_rate_history) > 10:
            win_rate_history.pop(0)

        # Telemetry updates after the interval executes
        last_observed_p90 = market_p90
        p90_history.append(market_p90)
        if len(p90_history) > 10:
            p90_history.pop(0)

        stats = daypart_stats[daypart]
        stats["auctions"] += step_auctions
        stats["wins"] += step_wins
        stats["spend"] += step_spend

        points.append({
            "step": step,
            "hour": round(hour, 1),
            "auctionCount": (step + 1) * step_auctions,
            "daypart": daypart,
            "phase": phase,
            "phaseName": phase_name,
            "rivalP90": market_p90,
            "campaignBid": round(effective_bid, 2),
            "stepWins": step_wins,
            "stepCost": round(step_spend, 2),
            "budgetRemaining": round(budget_remaining, 2),
            "winRate": round(step_win_rate, 3),
            "totalWins": total_impressions,
            "totalCost": round(total_spend, 2),
        })

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

    recorded_shocks = [
        asdict(s) for s in (shocks if shocks is not None else generate_market_shocks(42))
    ]

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
        points=points,
        shocks=recorded_shocks,
    )


def load_policy_from_code(code_str: str) -> Callable[[AuctionContext], float]:
    """Compiles a Python code string and extracts the compute_bid function."""
    mod = ModuleType("dynamic_policy")
    exec(code_str, mod.__dict__)
    if not hasattr(mod, "compute_bid"):
        raise ValueError("Code does not define compute_bid(context)")
    return getattr(mod, "compute_bid")


def load_policy_from_file(file_path: str) -> Callable[[AuctionContext], float]:
    """Reads a Python file from disk, compiles it, and extracts compute_bid."""
    with open(file_path, "r", encoding="utf-8") as f:
        code_str = f.read()
    return load_policy_from_code(code_str)


@dataclass
class MultiFlightResult:
    """Aggregate performance metrics across multiple randomized market flights."""

    num_flights: int
    mean_yield_score: float
    std_yield_score: float
    mean_impressions: float
    mean_spend: float
    mean_win_rate: float
    flight_results: list[dict] = field(default_factory=list)
    summary_text: str = ""


def run_multi_simulation(
    policy_func: Callable[[AuctionContext], float],
    seeds: list[int] | None = None,
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
) -> MultiFlightResult:
    """Evaluates a policy across multiple randomized market regimes.

    Tests whether a bidding strategy genuinely generalizes or overfits
    to a single deterministic day's volatility schedule.
    """
    if seeds is None:
        seeds = [42, 101, 202, 303, 404]

    results: list[SimulationResult] = []
    for s in seeds:
        res = run_simulation(
            policy_func=policy_func,
            total_budget=total_budget,
            flight_duration_hours=flight_duration_hours,
            max_bid_ceiling=max_bid_ceiling,
            seed=s,
        )
        results.append(res)

    scores = [r.yield_score for r in results]
    mean_score = sum(scores) / len(scores)
    variance = sum((x - mean_score) ** 2 for x in scores) / len(scores)
    std_score = math.sqrt(variance)
    mean_imp = sum(r.total_impressions for r in results) / len(results)
    mean_spend = sum(r.total_spend for r in results) / len(results)
    mean_win_rate = sum(r.overall_win_rate for r in results) / len(results)

    summary = (
        f"Multi-Flight Generalization ({len(seeds)} Days) | "
        f"Mean Yield: {mean_score:.1f}/100 (±{std_score:.1f}) | "
        f"Avg Impressions: {int(mean_imp):,} | "
        f"Avg Spend: ${mean_spend:.2f}"
    )

    flight_summaries = [
        {
            "seed": s,
            "yield_score": r.yield_score,
            "impressions": r.total_impressions,
            "spend": r.total_spend,
            "win_rate": r.overall_win_rate,
            "shocks": r.shocks,
        }
        for s, r in zip(seeds, results)
    ]

    return MultiFlightResult(
        num_flights=len(seeds),
        mean_yield_score=round(mean_score, 1),
        std_yield_score=round(std_score, 1),
        mean_impressions=round(mean_imp, 1),
        mean_spend=round(mean_spend, 2),
        mean_win_rate=round(mean_win_rate, 2),
        flight_results=flight_summaries,
        summary_text=summary,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simulate video ad campaign bidding flight")
    parser.add_argument("--file", type=str, required=True, help="Path to Python policy script")
    parser.add_argument("--budget", type=float, default=2500.0, help="Campaign budget in USD")
    parser.add_argument("--duration", type=float, default=24.0, help="Flight duration in hours")
    parser.add_argument("--ceiling", type=float, default=10.0, help="Max bid ceiling in USD CPM")
    parser.add_argument("--seed", type=int, default=42, help="Random market seed (42 for canonical workshop incident)")
    parser.add_argument("--multi", action="store_true", help="Run multi-flight evaluation across varied market regimes")
    args = parser.parse_args()

    target_file = args.file
    if not os.path.isabs(target_file):
        target_file = os.path.join(_LAB_ROOT, target_file)

    if not os.path.exists(target_file):
        print(json.dumps({
            "status": "error",
            "error_type": "FileNotFoundError",
            "error_message": f"Policy file not found: {target_file}"
        }))
        sys.exit(1)

    try:
        policy = load_policy_from_file(target_file)

        if args.multi:
            multi_result = run_multi_simulation(
                policy_func=policy,
                total_budget=args.budget,
                flight_duration_hours=args.duration,
                max_bid_ceiling=args.ceiling,
            )
            print(json.dumps({
                "status": "success",
                "filename": os.path.basename(target_file),
                "multi_flight": True,
                "num_flights": multi_result.num_flights,
                "mean_yield_score": multi_result.mean_yield_score,
                "std_yield_score": multi_result.std_yield_score,
                "mean_impressions": multi_result.mean_impressions,
                "mean_spend": multi_result.mean_spend,
                "mean_win_rate": multi_result.mean_win_rate,
                "flight_results": multi_result.flight_results,
                "summary_text": multi_result.summary_text,
            }))
            sys.exit(0)

        result = run_simulation(
            policy_func=policy,
            total_budget=args.budget,
            flight_duration_hours=args.duration,
            max_bid_ceiling=args.ceiling,
            seed=args.seed,
        )

        response = {
            "status": "success",
            "filename": os.path.basename(target_file),
            "seed": args.seed,
            "total_impressions": result.total_impressions,
            "total_spend": result.total_spend,
            "budget_remaining": result.budget_remaining,
            "budget_utilization_pct": result.budget_utilization_pct,
            "effective_cpm": result.effective_cpm,
            "overall_win_rate": result.overall_win_rate,
            "hours_active": result.hours_active,
            "exhausted_hour": result.exhausted_hour,
            "yield_score": result.yield_score,
            "daypart_metrics": result.daypart_metrics,
            "summary_text": result.summary_text,
            "points": result.points,
            "shocks": result.shocks,
        }
        print(json.dumps(response))
    except Exception as e:
        tb = traceback.format_exc()
        print(json.dumps({
            "status": "error",
            "error_type": type(e).__name__,
            "error_message": str(e),
            "traceback": tb,
        }))
        sys.exit(0)
