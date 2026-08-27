from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    TOTAL_CAMPAIGN_BUDGET = 2500.0
    TOTAL_FLIGHT_HOURS = 24.0

    # Handle edge case for end of campaign or very little time remaining
    if context.hours_remaining <= 0.0:
        # If no time left, attempt to spend any remaining budget up to the min bid,
        # otherwise bid the minimum to avoid zero bid.
        return (
            max(0.50, min(context.budget_remaining, context.max_bid_ceiling))
            if context.budget_remaining > 0
            else 0.50
        )

    # Calculate ideal budget remaining based on linear spend trajectory
    # This indicates what the budget *should* be at this point in the campaign
    ideal_budget_remaining = TOTAL_CAMPAIGN_BUDGET * (
        context.hours_remaining / TOTAL_FLIGHT_HOURS
    )

    # Calculate pacing adjustment factor
    # If we have more budget than we ideally should (underspending), increase bid.
    # If we have less budget than we ideally should (overspending), decrease bid.
    pacing_adjustment = 1.0  # Default to no adjustment
    if (
        ideal_budget_remaining > 0.001
    ):  # Avoid division by zero when ideal_budget_remaining is very small
        pacing_adjustment = context.budget_remaining / ideal_budget_remaining
        # Clamp pacing adjustment to prevent extreme bidding or severe underspending
        pacing_adjustment = max(0.2, min(pacing_adjustment, 3.0))
    elif (
        context.budget_remaining > 0
    ):  # If ideal_budget_remaining is ~0 but budget still exists, bid aggressively
        pacing_adjustment = 3.0

    # Win rate adjustment to optimize for impression opportunities
    # Bid more aggressively if win rate is low, less if it's high
    win_rate_adjustment_factor = 1.0
    if context.win_rate < 0.4:
        win_rate_adjustment_factor = 1.25  # More aggressive for low win rates
    elif context.win_rate > 0.8:
        win_rate_adjustment_factor = 0.8  # Less aggressive for high win rates

    # Base bid on P90 clearing price, adjusted by win rate factor
    proposed_bid = context.p90 * win_rate_adjustment_factor

    # Apply the dynamic pacing adjustment to the proposed bid
    final_bid = proposed_bid * pacing_adjustment

    # Ensure the bid respects the hard maximum bid ceiling and minimum bid
    final_bid = max(0.50, min(final_bid, context.max_bid_ceiling))

    # Crucially, ensure we don't bid more than the remaining budget,
    # unless the remaining budget is less than the minimum bid (0.50).
    # In that case, we still bid 0.50 to exhaust the last bits.
    if context.budget_remaining > 0.0 and context.budget_remaining < final_bid:
        if context.budget_remaining < 0.50:
            final_bid = (
                0.50  # Bid minimum if budget is less than min_bid but still exists
            )
        else:
            final_bid = (
                context.budget_remaining
            )  # Bid exact remaining budget if it's between min_bid and calculated bid

    return final_bid
