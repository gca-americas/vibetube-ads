from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # Minimum bid allowed for an impression.
    MIN_BID = 0.50

    # If the remaining budget is critically low (less than what a single impression
    # would cost at the minimum CPM of $0.50), bid 0 to prevent accidental overspend.
    # $0.50 CPM means $0.0005 per impression.
    if context.budget_remaining < 0.0005:
        return 0.0

    # Initialize bid based on the 90th percentile clearing price (P90).
    # If P90 is not available, default to a high fraction of max_bid_ceiling
    # to remain competitive, but this should be rare in practice.
    base_bid = context.p90 if context.p90 is not None else context.max_bid_ceiling * 0.8

    # Adjust bid based on the recent win rate to optimize impression volume.
    # These thresholds are heuristic and can be tuned based on campaign performance.
    if context.win_rate is not None:
        if (
            context.win_rate < 0.6
        ):  # If win rate is low, increase bid to be more aggressive
            bid = base_bid * 1.15
        elif (
            context.win_rate > 0.85
        ):  # If win rate is high, we might be overbidding, slightly reduce bid
            bid = base_bid * 0.9
        else:  # Moderate win rate, use the base bid
            bid = base_bid
    else:
        # If win rate is not available, use the base_bid (derived from P90 or default)
        bid = base_bid

    # Ensure the calculated bid does not exceed the hard maximum bid ceiling.
    bid = min(bid, context.max_bid_ceiling)

    # Ensure the calculated bid is at least the minimum allowed bid,
    # unless budget was exhausted and handled at the beginning.
    bid = max(bid, MIN_BID)

    return bid
