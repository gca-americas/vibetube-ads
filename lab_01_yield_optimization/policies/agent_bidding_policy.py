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

    # --- Configuration Constants (derived from total_budget from get_campaign_info) ---
    TOTAL_CAMPAIGN_BUDGET = 2500.0  # From get_campaign_info() response
    CONSERVATION_BUDGET_THRESHOLD = 100.0
    AGGRESSIVE_BUDGET_THRESHOLD_20_PERCENT = 0.2 * TOTAL_CAMPAIGN_BUDGET
    AGGRESSIVE_BUDGET_THRESHOLD_10_PERCENT = 0.1 * TOTAL_CAMPAIGN_BUDGET

    # 1. Increase Initial Bid Competitiveness: Bid 15% above P90 for increased
    # competitiveness
    target_bid = context.p90 * 1.15

    # 2. Re-evaluate High Win Rate Adjustment: Adjust bid based on win rate
    if context.win_rate < 0.7:
        # Increase bid if win rate is low to capture more impressions
        target_bid *= 1.15
    # Removed reduction for high win rate to encourage spending given past under-
    # spending issues.

    # 3. Revise Budget Pacing Heuristics for Aggression
    # If significant budget remains with limited time, be very aggressive
    if (
        context.hours_remaining < 4.0
        and context.budget_remaining > AGGRESSIVE_BUDGET_THRESHOLD_20_PERCENT
    ):
        target_bid *= 1.75  # Significantly more aggressive
    elif (
        context.hours_remaining < 2.0
        and context.budget_remaining > AGGRESSIVE_BUDGET_THRESHOLD_10_PERCENT
    ):
        target_bid *= 1.5  # Moderately aggressive
    elif context.hours_remaining < 0.5:
        # Last 30 minutes, final push before the 15-min ultimate push
        target_bid *= 1.25
    # Conserve only if budget is truly low AND there's still significant time
    elif (
        context.budget_remaining < CONSERVATION_BUDGET_THRESHOLD
        and context.hours_remaining > 2.0
    ):
        target_bid *= 0.6  # Conserve budget if low and still early in flight

    # Ensure the bid respects the max_bid_ceiling and a minimum bid of $0.50
    target_bid = max(0.50, min(target_bid, context.max_bid_ceiling))

    return target_bid
