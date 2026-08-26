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

    # 1. Initialize base bid based on daypart clearing strategies
    # Using the insights from the Data Engineering Agent and the prompt's guidance.
    base_bid = p90 # Start with p90 as a baseline, then adjust

    if daypart == "late_night":
        # Agent: Avg P90 = 0.90, Win Rate = 100%. Prompt: Shade bids down to ~$0.90-$0.95.
        # Bid slightly above P90 to ensure wins without overpaying, given 100% win rate.
        base_bid = p90 + 0.05
    elif daypart == "morning":
        # Agent: Avg P90 = 2.47, Win Rate = 95.43%. Prompt: Bid ~$2.45.
        # Bid slightly above P90 to steadily accumulate volume.
        base_bid = p90 + 0.05
    elif daypart == "lunch":
        # Agent: Avg P90 = 4.49, Win Rate = 1.76%. Prompt: Lift bids to ~$4.25-$4.55.
        # Need to bid aggressively to clear the market, given the low win rate.
        base_bid = p90 + 0.06
    elif daypart == "afternoon":
        # Agent: Avg P90 = 8.05, High Volatility. Prompt: Base ~$2.60, up to ~$9.20, crash to ~$1.80.
        # This daypart is highly volatile; the base bid is competitive, but momentum will heavily influence it.
        base_bid = p90 + 0.05
    elif daypart == "primetime":
        # Agent: Avg P90 = 9.83, Win Rate = 0%. Prompt: Bid aggressively near ~$9.65-$9.85.
        # Need to bid very aggressively, close to the ceiling, to win in this premium daypart.
        base_bid = p90 + 0.02

    # 2. Momentum & Velocity Detection
    if len(p90_history) >= 2:
        velocity = p90_history[-1] - p90_history[0]
        if velocity > 1.50:
            # Escalating bidding war, front-run competitors
            base_bid = p90 + 0.10
        elif velocity < -1.50:
            # Market crash, drop bid significantly to avoid overpaying
            base_bid = max(0.50, p90 * 0.7) # Drop to 70% of P90, but not below the minimum bid floor

    # 3. Dynamic Budget Pacing
    # Daily budget $2500, 24 hours. Target hourly burn rate = $2500 / 24 = $104.16
    daily_budget = 2500.0
    target_hourly_burn_rate = daily_budget / 24.0

    # Ensure hours_remaining is not zero or too small to avoid division by zero or excessively large pacing factor
    effective_hours_remaining = max(hours_remaining, 0.5)

    # Calculate current pacing factor relative to target hourly burn rate
    # (budget_remaining / effective_hours_remaining) gives the current actual hourly burn rate
    pacing_factor = (budget_remaining / effective_hours_remaining) / target_hourly_burn_rate

    if pacing_factor > 1.2:
        # Behind pace, scale bid up slightly to capture more impressions
        base_bid *= 1.05
    elif pacing_factor < 0.8:
        # Ahead of pace or low budget, shade bid downward to preserve budget
        base_bid *= 0.90

    # 4. Hard Guardrails
    # Clamp final bid between $0.50 (minimum) and max_bid_ceiling
    calculated_bid = max(0.50, min(base_bid, max_bid_ceiling))

    return calculated_bid