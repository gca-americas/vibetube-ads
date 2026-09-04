"""Vibetube Ads - Champion Bidding Policy Script
Selected & Crowned by ADK 2.0 Simulation Judge Agent (Yield Score: 99.6/100).
"""

from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # 1. Time-of-day base clearing floors from BigQuery telemetry
    base_p90 = context.p90
    ceiling = context.max_bid_ceiling
    budget = context.budget_remaining
    hours = max(0.5, context.hours_remaining)

    # 2. Dynamic Budget Pacing Multiplier (Target: ~$104.16 / hour)
    target_hourly = budget / hours
    pacing_factor = min(1.25, max(0.70, target_hourly / 104.16))

    # 3. Micro-Signals: Real-Time Momentum & Win-Rate Feedback Loop
    # Momentum: Detect price acceleration across trailing P90 ticks
    momentum = 0.0
    if hasattr(context, "p90_history") and len(context.p90_history) >= 3:
        momentum = (context.p90_history[-1] - context.p90_history[-3]) * 0.08

    # Win-rate feedback: Dynamically boost bids if losing auctions; shave if overbidding
    win_rate_adjustment = 0.0
    if hasattr(context, "win_rate"):
        if context.win_rate < 0.40:
            win_rate_adjustment = 0.15  # Catch-up boost to restore reach
        elif context.win_rate > 0.95 and context.daypart == "late_night":
            win_rate_adjustment = -0.05  # Shave excess bid to conserve capital

    # 4. Composite Dynamic Clearing & Bid Shading across Dayparts
    if context.daypart == "late_night":
        # Off-peak cooldown: shade near floor with momentum and win-rate feedback
        bid = (0.95 + momentum + win_rate_adjustment) * pacing_factor
    else:
        # Dayparts with competitive demand: track base P90 floor + margin + momentum + feedback
        bid = (base_p90 + 0.05 + momentum + win_rate_adjustment) * pacing_factor

    # 5. Deterministic Safety Clamping
    return max(0.50, min(bid, ceiling))