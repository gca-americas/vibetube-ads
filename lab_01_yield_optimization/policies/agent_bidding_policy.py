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

    # Campaign constants (retrieved from get_campaign_info)
    INITIAL_TOTAL_BUDGET = 2500.0
    INITIAL_FLIGHT_DURATION_HOURS = 24.0
    MIN_BID_CPM = 0.50
    PACING_SENSITIVITY = 0.5  # Adjusts how aggressively the bid changes based on pacing

    # Ensure we don't divide by zero if campaign is almost over
    if context.hours_remaining <= 0 or context.budget_remaining <= 0:
        return MIN_BID_CPM

    # Calculate ideal spend rate for the entire campaign
    ideal_hourly_spend_rate = INITIAL_TOTAL_BUDGET / INITIAL_FLIGHT_DURATION_HOURS

    # Calculate current required spend rate to hit budget target
    current_required_hourly_spend_rate = (
        context.budget_remaining / context.hours_remaining
    )

    # Calculate pacing ratio
    # Ratio > 1 means we are underspending and need to bid more aggressively
    # Ratio < 1 means we are overspending and need to bid more conservatively
    pacing_ratio = current_required_hourly_spend_rate / ideal_hourly_spend_rate

    # Adjust bid based on pacing. p90 is the base to ensure competitiveness.
    # The pacing_factor will nudge the bid up or down.
    pacing_factor = 1 + (pacing_ratio - 1) * PACING_SENSITIVITY

    # Ensure pacing factor doesn't go too low or too high to prevent extreme bids
    pacing_factor = max(
        0.5, min(pacing_factor, 1.5)
    )  # Example clamping for pacing_factor

    # Calculate the initial bid based on P90 and pacing
    calculated_bid = context.p90 * pacing_factor

    # Apply guardrails
    final_bid = max(MIN_BID_CPM, min(calculated_bid, context.max_bid_ceiling))

    return final_bid
