from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    min_bid = 0.50
    bid_cpm = context.active_bid_cpm if context.active_bid_cpm is not None else min_bid

    # Adjust bid based on P90 (if available) to be competitive
    target_bid = bid_cpm  # Start with current bid or default

    if context.p90 is not None and context.p90 > 0:
        # Bid slightly above P90 to be competitive, or around P90 if win rate is good.
        target_bid = context.p90 * 1.05  # Bid 5% above P90 as a starting point
    else:
        # If P90 is not available, we can use the current active bid as a base for
        # adjustment
        target_bid = bid_cpm

    # Adjust bid based on win rate
    if context.win_rate < 0.3:  # If win rate is low, try to bid higher
        target_bid *= 1.1
    elif (
        context.win_rate > 0.7
    ):  # If win rate is high, we might be over-bidding, reduce slightly
        target_bid *= 0.9

    # Ensure bid doesn't exceed remaining budget if we have very little left
    # This is a rough estimation. If the remaining budget is very small,
    # we should not bid very high to waste it on one impression.
    # Assuming an average CPM, if remaining budget is less than 5 units,
    # we should be careful not to bid more than our remaining budget.
    if context.budget_remaining < 5 and target_bid > context.budget_remaining:
        target_bid = (
            context.budget_remaining * 0.8
        )  # Spend most of remaining budget, but not all on one bid

    # Clamp the bid between min_bid and max_bid_ceiling
    final_bid = max(min_bid, min(target_bid, context.max_bid_ceiling))

    return final_bid
