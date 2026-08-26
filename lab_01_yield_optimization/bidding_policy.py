def compute_bid(context: dict) -> float:
    daypart = context["daypart"]
    budget_remaining = context["budget_remaining"]
    hours_remaining = context["hours_remaining"]
    max_bid_ceiling = context["max_bid_ceiling"]
    win_rate = context["win_rate"]
    p90 = context["p90"]
    p90_history = context.get("p90_history", [])
    active_bid_cpm = context.get("active_bid_cpm", 0.0)

    # Define a minimum bid to ensure participation
    MIN_BID_CPM = 0.50

    # 1. Base bid: Slightly above P90 to be competitive
    # We'll add a small margin to P90 to increase win probability
    base_bid = p90 * 1.05  # Bid 5% above P90

    # 2. Budget Pacing: Adjust bid based on remaining budget and time
    # Given the extremely low budget_remaining (0.0068), the primary goal should be to
    # spend the remaining budget effectively without overbidding.
    # If budget is almost depleted, bid very conservatively, close to the minimum.

    if budget_remaining < 1.0:  # If less than $1 remaining, be very conservative
        bid = MIN_BID_CPM
    elif (
        hours_remaining > 0 and budget_remaining / hours_remaining < p90 * 2
    ):  # If budget per hour is low relative to P90
        bid = max(MIN_BID_CPM, p90 * 0.9)  # Bid slightly below P90 or at minimum
    else:
        bid = base_bid  # Use the base bid

    # 3. Win Rate Adjustment (optional, but good for fine-tuning)
    # If win rate is too low, increase bid slightly, but respect budget pacing
    if win_rate < 0.7 and bid < max_bid_ceiling:  # If win rate is below 70%
        bid *= 1.05  # Increase bid by 5%
    elif (
        win_rate > 0.9 and bid > MIN_BID_CPM
    ):  # If win rate is very high, we might be overbidding
        # Only reduce if we are significantly above P90 and have a high win rate
        if bid > p90 * 1.1:
            bid *= 0.98  # Slightly reduce bid

    # 4. Market Momentum (using p90_history)
    # If P90 is trending up, be more aggressive. If trending down, be more conservative.
    if len(p90_history) >= 2:
        latest_p90 = p90_history[-1]
        previous_p90 = p90_history[-2]
        if latest_p90 > previous_p90 * 1.1:  # P90 increased by more than 10%
            bid *= 1.03  # Increase bid slightly
        elif latest_p90 < previous_p90 * 0.9:  # P90 decreased by more than 10%
            bid *= 0.97  # Decrease bid slightly

    # 5. Clamp bid between MIN_BID_CPM and max_bid_ceiling
    bid = max(MIN_BID_CPM, min(bid, max_bid_ceiling))

    return bid
