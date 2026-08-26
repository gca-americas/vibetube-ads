def compute_bid(context: dict) -> float:
    """Calculates the optimal first-price CPM bid for an upcoming video ad auction tick.

    Parameters in context dictionary:
    --------------------------------
    daypart : str
        Current market time window: "morning" (06:00-11:00), "lunch" (11:00-13:30),
        "afternoon" (13:30-17:00), "primetime" (17:00-22:00), or "late_night" (22:00-06:00).
    budget_remaining : float
        Total campaign budget remaining in USD (e.g., $2500.00 down to $0.00).
    hours_remaining : float
        Hours left in the 24.0-hour flight (e.g., 24.0 down to 0.0).
    max_bid_ceiling : float
        Hard maximum bid ceiling guardrail in USD CPM (e.g., $10.00 CPM).
    win_rate : float
        Recent auction win rate over the trailing window as a ratio (0.0 to 1.0).
    p90 : float
        90th percentile clearing price (USD CPM) across competing auctions. Bidding
        at or slightly above clears >=90% of auction impressions.
    p90_history : list[float]
        Trailing sequence of recent P90 clearing values (e.g., [2.10, 3.40, 5.80, 8.20])
        used to calculate market momentum and price velocity.

    Optional / Enriched telemetry fields:
    -------------------------------------
    win_rate_history : list[float]
        Trailing sequence of recent win rates (e.g., [0.95, 0.92, 0.88, 0.65]).
    active_bid_cpm : float
        The current bid price from the preceding tick before recalculation.

    Returns:
    --------
    float
        The calculated first-price CPM bid in USD (clamped between $0.50 and max_bid_ceiling).
    """

    daypart = context["daypart"]
    budget_remaining = context["budget_remaining"]
    hours_remaining = context["hours_remaining"]
    max_bid_ceiling = context["max_bid_ceiling"]
    p90 = context["p90"]
    p90_history = context.get("p90_history", [])

    # 1. Daypart Clearing Strategies (Base Bid)
    base_bid = 0.0
    if daypart == "late_night":
        # Floor drops to ~$0.85-$0.95. Shade bids down to ~$0.90-$0.95 to avoid wasting budget on 100% win rate overpayment.
        base_bid = 0.93 # Based on telemetry P90, slightly above to ensure wins but not overpay
    elif daypart == "morning":
        # Modest floor ~$2.40. Bid ~$2.45 to steadily accumulate volume.
        base_bid = 2.47 # Based on telemetry P90, slightly above to ensure wins
    elif daypart == "lunch":
        # Midday competition surges to ~$4.20-$4.50. Lift bids to ~$4.25-$4.55.
        base_bid = 4.49 # Based on telemetry P90, slightly above to ensure wins
    elif daypart == "afternoon":
        # High volatility. Base is ~$2.60, ramping up to ~$9.20 during bidding wars, then crashing to ~$1.80.
        # We'll use the current p90 as a starting point for afternoon due to its volatility.
        base_bid = p90
    elif daypart == "primetime":
        # High volume peak clearing floor ~$9.50-$9.80. Bid aggressively near ~$9.65-$9.85 (capped at ceiling).
        base_bid = 9.83 # Based on telemetry P90, aiming to be competitive

    # Adjust base bid based on current p90, especially for dynamic dayparts
    if daypart not in ["late_night", "morning"]: # For more competitive dayparts, react more to current P90
        base_bid = max(base_bid, p90 + 0.05) # Ensure we are at least slightly above current P90

    # 2. Momentum & Velocity Detection
    momentum_adjustment = 0.0
    if len(p90_history) >= 2:
        velocity = p90_history[-1] - p90_history[0]
        if velocity > 1.50: # Escalating bidding war
            momentum_adjustment = 0.10 # Front-run competitors
            base_bid = p90 + momentum_adjustment # Override base_bid to react immediately
        elif velocity < -1.50: # Post-war crash
            momentum_adjustment = -0.50 # Drop bid significantly to avoid overpaying
            base_bid = p90 + momentum_adjustment # Override base_bid to react immediately

    # 3. Dynamic Budget Pacing
    pacing_factor = 1.0
    if hours_remaining > 0.5: # Avoid division by zero or extreme pacing at very end
        # Target hourly burn rate: $2500 / 24h = $104.16/h
        target_hourly_burn = 2500.0 / 24.0
        current_hourly_burn_rate = budget_remaining / hours_remaining

        if current_hourly_burn_rate > (target_hourly_burn * 1.2): # Behind pace, need to spend more
            pacing_factor = 1.08 # Scale bid up slightly (+8%)
        elif current_hourly_burn_rate < (target_hourly_burn * 0.8): # Ahead of pace / low budget, preserve budget
            pacing_factor = 0.90 # Shade bid downward (-10%)

    calculated_bid = base_bid * pacing_factor

    # 4. Hard Guardrails
    # Clamp final bid: return max(0.50, min(calculated_bid, max_bid_ceiling))
    final_bid = max(0.50, min(calculated_bid, max_bid_ceiling))

    return final_bid