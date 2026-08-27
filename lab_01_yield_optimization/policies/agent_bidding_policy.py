from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # Constants
    MIN_BID_CPM = 0.50
    P90_AGGRESSION_MULTIPLIER = 1.25  # Increased aggression as per recommendation
    PACING_MULTIPLIER_MIN = 0.5
    PACING_MULTIPLIER_MAX = 5.0  # Increased upper limit as per recommendation
    WIN_RATE_TOO_LOW_THRESHOLD = 0.4
    WIN_RATE_TOO_HIGH_THRESHOLD = 0.9
    WIN_RATE_ADJUSTMENT_FACTOR = 0.1  # Small adjustment for win rate

    # Heuristic for baseline expected impressions per hour. This is used to normalize
    # the pacing logic.
    # Ideally, this would come from historical campaign data or campaign type.
    EXPECTED_IMPRESSIONS_PER_HOUR_BASELINE = 100.0

    # Handle edge cases for remaining budget and time
    if context.budget_remaining <= 0:
        return MIN_BID_CPM

    # Use a small epsilon to prevent division by zero for hours_remaining and p90
    hours_remaining_safe = max(0.01, context.hours_remaining)
    p90_safe = max(0.01, context.p90)

    # 1. Base Bid Calculation (more aggressive)
    # Target P90 with increased aggression to ensure competitiveness
    base_bid = p90_safe * P90_AGGRESSION_MULTIPLIER

    # 2. Dynamic Pacing Adjustment
    # Calculate expected USD spend per hour if bidding at P90 and getting baseline
    # impressions
    expected_usd_per_hour_at_p90_baseline = (
        p90_safe / 1000.0
    ) * EXPECTED_IMPRESSIONS_PER_HOUR_BASELINE

    # Calculate current required spend rate per hour to exhaust remaining budget
    current_required_usd_per_hour = context.budget_remaining / hours_remaining_safe

    pacing_multiplier = 1.0  # Default value
    if expected_usd_per_hour_at_p90_baseline > 0:
        # The pacing multiplier is the ratio of current required spend rate to the
        # baseline expected spend rate.
        # If current_required_usd_per_hour is much higher, we need to bid more
        # aggressively (multiplier > 1).
        # If lower, bid less aggressively (multiplier < 1).
        pacing_multiplier = (
            current_required_usd_per_hour / expected_usd_per_hour_at_p90_baseline
        )

    # Clamp the pacing multiplier as per recommendation to allow for more aggressive
    # adjustments
    pacing_multiplier = max(
        PACING_MULTIPLIER_MIN, min(pacing_multiplier, PACING_MULTIPLIER_MAX)
    )

    # Apply pacing multiplier to the base bid
    bid_after_pacing = base_bid * pacing_multiplier

    # 3. Win Rate Adjustment
    # Adjust bid based on recent win rate to optimize for impressions won
    win_rate_adjustment_factor = 1.0
    if context.win_rate < WIN_RATE_TOO_LOW_THRESHOLD:
        # If win rate is too low, increase bid to be more competitive
        win_rate_adjustment_factor += WIN_RATE_ADJUSTMENT_FACTOR
    elif context.win_rate > WIN_RATE_TOO_HIGH_THRESHOLD:
        # If win rate is too high, we might be overbidding, so slightly decrease bid
        win_rate_adjustment_factor -= WIN_RATE_ADJUSTMENT_FACTOR

    final_bid = bid_after_pacing * win_rate_adjustment_factor

    # 4. Apply Maximum Bid Ceiling guardrail
    final_bid = min(final_bid, context.max_bid_ceiling)

    # 5. Apply Minimum Bid floor
    final_bid = max(final_bid, MIN_BID_CPM)

    return final_bid
