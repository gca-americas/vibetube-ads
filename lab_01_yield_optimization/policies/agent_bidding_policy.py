from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    min_bid = 0.50
    # Ensure min_bid is not greater than max_bid_ceiling if max_bid_ceiling is very low.
    if context.max_bid_ceiling < min_bid:
        min_bid = context.max_bid_ceiling

    # Handle cases where there's no time or budget left, or P90 is zero.
    if context.hours_remaining <= 0 or context.budget_remaining <= 0:
        return min_bid  # Bid minimum to finish campaign or if budget exhausted

    # 1. Base bid around P90 to be competitive.
    # Bid 5% above P90, or use min_bid if P90 is zero.
    base_bid = context.p90 * 1.05 if context.p90 > 0 else min_bid

    # 2. Adjust bid based on win rate to optimize for impressions and efficiency.
    # Target an optimal win rate (e.g., 65%). If current win rate is below, increase
    # bid; if above, decrease bid.
    optimal_win_rate = 0.65
    # Controls how much the bid reacts to win rate deviation.
    win_rate_aggressiveness = 0.8
    win_rate_factor = (
        1 + (optimal_win_rate - context.win_rate) * win_rate_aggressiveness
    )
    adjusted_bid = base_bid * win_rate_factor

    # 3. Dynamic Budget Pacing: Adjust bid aggressiveness based on remaining budget and
    # time.
    pacing_factor = 1.0
    conservative_budget_threshold = context.max_bid_ceiling * 5  # e.g., $10 * 5 = $50
    significant_time_threshold = 1.0  # 1 hour

    if (
        context.budget_remaining < conservative_budget_threshold
        and context.hours_remaining > significant_time_threshold
    ):
        # Scale bid down, but not too aggressively (min 20% of adjusted bid)
        pacing_factor = max(
            0.2, context.budget_remaining / conservative_budget_threshold
        )
        adjusted_bid *= pacing_factor
    elif (
        context.budget_remaining > 0 and context.hours_remaining <= 0.25
    ):  # Last 15 minutes, try to spend
        # If budget remains and time is almost up, become more aggressive.
        pacing_factor = 1.2  # Bid 20% more aggressively to spend remaining budget.
        adjusted_bid *= pacing_factor

    # 4. Apply hard constraints: max_bid_ceiling and min_bid.
    final_bid = max(min_bid, min(adjusted_bid, context.max_bid_ceiling))

    # 5. Final check for extremely low budget: If remaining budget cannot even afford
    # one impression at computed CPM,
    # default to min_bid to try and spend residual.
    if context.budget_remaining > 0 and (context.budget_remaining * 1000 < final_bid):
        final_bid = min_bid  # Spend residual at minimum bid.

    return float(final_bid)
