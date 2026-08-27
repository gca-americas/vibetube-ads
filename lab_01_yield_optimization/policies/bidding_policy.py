from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    min_bid = 0.50

    # Initialize bid with a default low value, will be updated by strategy
    calculated_bid = min_bid

    # Strategy 1: Bid slightly above P90 if available and positive, to be competitive.
    if context.p90 is not None and context.p90 > 0:
        calculated_bid = context.p90 * 1.05
    else:
        # Strategy 2: Fallback when P90 is not available.
        # This strategy prioritizes spending the budget towards the end of the campaign
        # or when the budget is critically low, by bidding aggressively up to the
        # ceiling.

        # Thresholds for aggressive bidding:
        # If budget remaining is very low (e.g., less than $5 for a campaign that
        # started with $2500)
        # OR if hours remaining is very low (e.g., less than 1 hour).
        if context.budget_remaining < 5.0 or context.hours_remaining < 1.0:
            calculated_bid = context.max_bid_ceiling
        else:
            # Strategy 3: Default bid when P90 is not available and budget/time are not
            # critical.
            # Use the active bid from the previous tick if available.
            # Otherwise, use a robust default that aims to be competitive but not
            # necessarily maxed out.
            # A default of 75% of max_bid_ceiling is a reasonable starting point without
            # market data.
            calculated_bid = (
                context.active_bid_cpm
                if context.active_bid_cpm is not None
                else context.max_bid_ceiling * 0.75
            )

    # Apply guardrails: Ensure the bid is within the allowed range ($0.50 to
    # max_bid_ceiling).
    final_bid = max(min_bid, min(calculated_bid, context.max_bid_ceiling))

    return final_bid
