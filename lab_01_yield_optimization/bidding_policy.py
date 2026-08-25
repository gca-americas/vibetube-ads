"""Vibetube Ads - AI-Optimized Bidding Policy Script
Authored by ADK AI Data Engineer Agent (Gemini 2.5 Flash) via BigQuery Telemetry.
"""

def compute_bid(context: dict) -> float:
    daypart = context.get("daypart", "morning")
    p90 = context.get("recent_p90_cpm", 2.35)
    p90_history = context.get("p90_history", [p90] * 5)
    win_rate = context.get("recent_win_rate", 0.85)
    ceiling = context.get("max_bid_ceiling", 10.00)
    budget = context.get("budget_remaining", 2500.00)
    hours = max(0.5, context.get("hours_remaining", 12.0))

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