from models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # Always ensure the bid is at least $0.50
    min_bid = 0.50

    # If budget is critically low (less than the minimum bid), bid the minimum to conserve.
    if context.budget_remaining < min_bid:
        return min_bid

    # Base bid: Start with the active bid if available, otherwise a sensible default.
    current_bid = context.active_bid_cpm if context.active_bid_cpm is not None else 2.5

    # Target win rate for adjustment
    target_win_rate = 0.6
    # Scaling factor for bid adjustment based on win rate difference
    adjustment_scale = 2.0

    # Calculate the difference from the target win rate
    win_rate_diff = target_win_rate - context.win_rate

    # Adjust bid proportionally to the difference from target win rate.
    # A larger difference means a larger adjustment.
    adjusted_bid = current_bid + (win_rate_diff * adjustment_scale)

    # Ensure bid respects the max_bid_ceiling and min_bid
    final_bid = max(min_bid, min(adjusted_bid, context.max_bid_ceiling))

    # Final budget check: if remaining budget is very low relative to the proposed bid,
    # reduce the bid to the minimum to prevent overspending the last few cents.
    # Using 10% of the proposed bid as a threshold for critical budget.
    if context.budget_remaining < final_bid * 0.1:
        final_bid = min_bid

    return final_bid
