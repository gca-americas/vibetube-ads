from models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # Initialize the bid.
    bid = 0.0

    # Determine a base bid as a significant fraction of the maximum allowed bid ceiling.
    # This ensures competitiveness in the absence of specific market clearing price (P90) data.
    base_bid_fraction = 0.85
    bid = context.max_bid_ceiling * base_bid_fraction

    # Adjust the bid dynamically based on the recent auction win rate.
    # This aims to optimize for impression volume while managing cost.
    if context.win_rate < 0.5:
        # If the win rate is low, increase the bid to improve the chances of winning more auctions.
        bid *= 1.15  # Increase bid by 15%
    elif context.win_rate > 0.8:
        # If the win rate is high, slightly decrease the bid to potentially acquire impressions
        # at a lower cost, assuming we can maintain a good win rate.
        bid *= 0.90  # Decrease bid by 10%

    # Ensure the calculated bid adheres to the campaign's hard maximum bid ceiling
    # and the minimum bid floor of $0.50.
    bid = max(0.50, min(bid, context.max_bid_ceiling))

    return bid
