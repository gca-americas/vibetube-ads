from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    """Calculates the optimal first-price CPM bid for an upcoming video ad auction tick.

    Parameters on context object (AuctionContext):
    ----------------------------------------------
    context.daypart : str
        Current market time window: "morning", "lunch", "afternoon",
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
        90th percentile clearing price (USD CPM) across competing auctions.
    context.p90_history : list[float]
        Trailing sequence of recent P90 clearing values for market
        momentum velocity.
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
    # Campaign constants derived from initial get_campaign_info() call
    # total_budget: 2500, flight_duration_hours: 24
    TOTAL_CAMPAIGN_BUDGET = 2500.0
    TOTAL_FLIGHT_DURATION_HOURS = 24.0

    # Handle edge case where no time remains to avoid division by zero or nonsensical
    # pacing
    if (
        context.hours_remaining <= 0.01
    ):  # Small epsilon to handle floating point near zero
        # If campaign is effectively over, bid minimum or remaining budget if very
        # small, up to max_bid_ceiling
        if context.budget_remaining > 0.0:
            return max(0.50, min(context.budget_remaining, context.max_bid_ceiling))
        return 0.50  # Default minimal bid if no budget left and no time

    # Calculate the target spend rate for the entire campaign
    target_hourly_spend_rate = TOTAL_CAMPAIGN_BUDGET / TOTAL_FLIGHT_DURATION_HOURS

    # Calculate the ideal budget that *should* be remaining at this point in time
    ideal_budget_remaining = target_hourly_spend_rate * context.hours_remaining

    # Determine how much the current budget deviates from the ideal
    # Positive deviation = underspending, Negative deviation = overspending
    budget_deviation = context.budget_remaining - ideal_budget_remaining

    # Calculate a pacing adjustment factor
    # This factor will increase the bid if underspending, decrease if overspending.
    # A sensitivity multiplier (2.0) determines how aggressively the bid reacts to
    # budget deviations.
    pacing_factor = 1.0 + (budget_deviation / TOTAL_CAMPAIGN_BUDGET) * 2.0

    # Clamp the pacing factor to prevent extreme bid adjustments (e.g., bid can be 50%
    # less or 50% more than base)
    pacing_factor = max(0.5, min(pacing_factor, 1.5))

    # Calculate a base bid:
    # Start with a bid slightly above the 90th percentile clearing price (P90)
    # A 5% margin is added to increase win probability.
    # A floor of 0.75 USD CPM is applied to ensure bids are not too low, especially if
    # P90 is zero or very small.
    base_bid = max(context.p90 * 1.05, 0.75)

    # Apply the pacing factor to the base bid
    dynamic_bid = base_bid * pacing_factor

    # Apply hard guardrails:
    # 1. Ensure the bid does not exceed the campaign's maximum bid ceiling.
    final_bid = min(dynamic_bid, context.max_bid_ceiling)
    # 2. Ensure the bid is not below the absolute minimum floor of 0.50 USD CPM.
    final_bid = max(final_bid, 0.50)

    return final_bid
