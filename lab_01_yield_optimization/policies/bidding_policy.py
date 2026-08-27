from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    min_bid = 0.50

    calculated_bid = 2.50  # Default starting bid if no other info

    # Base bid strategy: bid slightly above P90 to improve win rate
    if context.p90 is not None and context.p90 > 0:
        calculated_bid = context.p90 * 1.05  # Bid 5% above P90

        # Adjust aggressiveness based on recent win rate
        if context.win_rate is not None:
            if context.win_rate < 0.2:  # If win rate is low, be more aggressive
                calculated_bid = context.p90 * 1.10  # Bid 10% above P90
            elif context.win_rate > 0.8:
                # If win rate is high, shade down slightly to conserve budget
                calculated_bid = context.p90 * 1.03
    elif context.active_bid_cpm is not None:
        # Fallback to previous active bid
        calculated_bid = context.active_bid_cpm * 1.05

    # Apply hard constraints: minimum and maximum bid
    final_bid = max(min_bid, calculated_bid)
    final_bid = min(final_bid, context.max_bid_ceiling)

    # Emergency budget-pacing considerations
    if context.budget_remaining is not None and context.hours_remaining is not None:
        if context.budget_remaining < 5.0 and context.hours_remaining > 2.0:
            # Low budget with remaining time: bid minimum floor
            final_bid = min_bid
        elif context.hours_remaining < 1.0 and context.budget_remaining > 10.0:
            # Flight ending with surplus budget: accelerate to near ceiling
            final_bid = context.max_bid_ceiling * 0.95

    return final_bid
