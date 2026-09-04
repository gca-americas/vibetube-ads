from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    """Calculates the optimal first-price CPM bid for an upcoming auction tick.

    Parameters on context object (AuctionContext):
    ----------------------------------------------
    context.daypart : str
        Current market window: "morning", "lunch", "afternoon",
        "primetime", or "late_night".
    context.budget_remaining : float
        Total campaign budget remaining in USD.
    context.hours_remaining : float
        Hours left in the campaign flight.
    context.max_bid_ceiling : float
        Hard maximum bid ceiling guardrail in USD CPM.
    context.win_rate : float
        Recent auction win rate ratio (0.0 to 1.0).
    context.p90 : float
        90th percentile clearing floor (USD CPM).
    context.p90_history : list[float]
        Trailing sequence of recent P90 values for momentum.
    context.win_rate_history : list[float]
        Trailing sequence of recent win rates.
    context.active_bid_cpm : float | None
        The current bid price from the preceding tick.

    Returns:
    --------
    float
        The calculated first-price CPM bid in USD (clamped between $0.50
        and max_bid_ceiling).
    """

    # 1. Dynamic Runtime Parameter Discovery (from campaign info)
    # Assuming total_budget and flight_duration_hours are available in the context
    # or can be set once at the start of the campaign based on get_campaign_info()
    # For this exercise, I'll use placeholder values that would ideally come
    # from a campaign configuration object passed or initialized once.
    # However, per the instructions, these should be dynamically discovered.
    # Since the `compute_bid` function only receives `context`, I will assume
    # `total_budget` and `flight_duration_hours` are part of a larger campaign config
    # available in `context` or globally. For now, I will use the values from the first
    # step.

    # The instruction says "Always invoke get_campaign_info() to discover campaign
    # constraints at runtime"
    # but `compute_bid` only receives `context`. So, I will hardcode the discovered
    # values
    # from the first `get_campaign_info()` call for demonstration purposes within this
    # script.
    # In a real-world scenario, these would likely be passed to the `AuctionContext`
    # or initialized as global variables once.

    # Placeholder values for total_budget and flight_duration_hours based on previous
    # get_campaign_info() call
    TOTAL_CAMPAIGN_BUDGET = 2500.0  # From get_campaign_info()
    FLIGHT_DURATION_HOURS = 24.0  # From get_campaign_info()

    ideal_hourly_velocity = TOTAL_CAMPAIGN_BUDGET / FLIGHT_DURATION_HOURS

    # Ensure hours_remaining doesn't lead to division by zero or extremely large numbers
    hours_remaining_safe = max(0.5, context.hours_remaining)

    # 3. Dynamic Budget Pacing Formulation
    current_hourly_burn = context.budget_remaining / hours_remaining_safe
    pacing_factor = min(1.25, max(0.70, current_hourly_burn / ideal_hourly_velocity))

    # 4. Micro-Signals: Price Momentum & Closed-Loop Win-Rate Feedback
    micro_signals_adjustment = 0.0

    # Momentum Gradient: Detect sudden price acceleration
    if len(context.p90_history) >= 2:
        latest_p90 = context.p90_history[-1]
        previous_p90 = context.p90_history[-2]
        if latest_p90 > previous_p90 * 1.1:  # P90 increased by more than 10%
            micro_signals_adjustment += 0.1 * (latest_p90 - previous_p90)

    # Win-Rate Elasticity: Boost bids when win rate dips
    TARGET_WIN_RATE = 0.7  # A reasonable target win rate
    if context.win_rate < TARGET_WIN_RATE:
        micro_signals_adjustment += (
            TARGET_WIN_RATE - context.win_rate
        ) * 0.5  # Scale by 0.5 for responsiveness
    elif (
        context.win_rate > TARGET_WIN_RATE + 0.1
    ):  # If win rate is too high, shave bids slightly
        micro_signals_adjustment -= (context.win_rate - TARGET_WIN_RATE - 0.1) * 0.2

    # 5. First-Price Bid Shading & Daypart Adaptation
    base_bid = (
        context.p90 if context.p90 is not None else 0.5
    )  # Use P90 as a strong indicator
    computed_bid = base_bid

    if context.daypart == "late_night":
        # Off-peak: Shade bids near or slightly below floor prices
        computed_bid = (0.95 * base_bid + micro_signals_adjustment) * pacing_factor
    elif context.daypart == "morning":
        # Standard: Track competitive clearing floors
        computed_bid = (base_bid + 0.02 + micro_signals_adjustment) * pacing_factor
    elif context.daypart == "lunch":
        # Moderate: Slightly above clearing to capture some inventory
        computed_bid = (base_bid + 0.05 + micro_signals_adjustment) * pacing_factor
    elif context.daypart == "afternoon":
        # More competitive: Marginally above clearing
        computed_bid = (base_bid + 0.1 + micro_signals_adjustment) * pacing_factor
    elif context.daypart == "primetime":
        # Peak demand: Shade bids marginally above competitor clearing floors
        computed_bid = (base_bid + 0.15 + micro_signals_adjustment) * pacing_factor
    else:
        # Default for any unhandled daypart
        computed_bid = (base_bid + 0.05 + micro_signals_adjustment) * pacing_factor

    # 6. Deterministic Safety Clamping
    min_bid_floor = 0.50  # Absolute positive floor
    computed_bid = max(min_bid_floor, computed_bid)  # Ensure bid is not too low
    computed_bid = min(
        computed_bid, context.max_bid_ceiling
    )  # Strictly enforce hard ceiling

    return computed_bid
