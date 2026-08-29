"""Vibetube Ads - AI-Optimized Bidding Policy Script
Authored by ADK AI Data Engineer Agent (Gemini 2.5 Flash) via BigQuery Telemetry.
"""

from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    daypart = context.daypart
    p90 = context.p90
    p90_history = context.p90_history
    win_rate = context.win_rate
    ceiling = context.max_bid_ceiling
    budget = context.budget_remaining
    hours = max(0.5, context.hours_remaining)

    # 1. Dynamic Budget Pacing Multiplier (Target: ~$104.16 / hr)
    target_hourly = budget / hours
    pacing = min(1.2, max(0.6, target_hourly / 104.16))

    # 2. Velocity Momentum Detection from Vector Telemetry
    velocity = p90_history[-1] - p90_history[0]

    # 3. Multi-Regime Clearance & Bid Shading
    if daypart == "late_night" or velocity < -1.5:
        # Midnight cooldown: shade down to clearance floor ($0.85 P90)
        return min(0.90, ceiling)
    elif daypart == "primetime" or velocity > 1.5:
        # Aggressive evening surge: clear floor with pacing modulation
        return min((p90 + 0.05) * pacing, ceiling)
    elif daypart == "afternoon":
        # Midday & bidding war tracking
        return min((p90 + 0.05) * pacing, ceiling)
    else:
        return min(2.40, ceiling)