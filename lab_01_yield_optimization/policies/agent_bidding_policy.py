from lib.models import AuctionContext

# Campaign parameters discovered at runtime
TOTAL_BUDGET = 2500.0  # From get_campaign_info()
FLIGHT_DURATION_HOURS = 24.0  # From get_campaign_info()


def compute_bid(context: AuctionContext) -> float:
    # 1. Dynamic Runtime Parameter Discovery & Baseline Velocity
    ideal_hourly_velocity = TOTAL_BUDGET / FLIGHT_DURATION_HOURS

    # 2. Dynamic Budget Pacing Formulation
    # Guard against division by zero for hours_remaining
    hours_remaining_safe = max(0.01, context.hours_remaining)
    current_hourly_burn = context.budget_remaining / hours_remaining_safe
    pacing_factor = min(1.25, max(0.70, current_hourly_burn / ideal_hourly_velocity))

    # 3. Micro-Signals
    micro_signals = 0.0

    # Price Momentum: If P90 is trending up, add a small boost
    if len(context.p90_history) > 1:
        latest_p90 = context.p90_history[-1]
        previous_p90 = context.p90_history[-2]
        if latest_p90 > previous_p90:
            micro_signals += 0.02  # Small boost for upward momentum
        elif latest_p90 < previous_p90:
            micro_signals -= 0.01  # Small reduction for downward momentum

    # Win-Rate Elasticity: Boost if win rate is low, shave if too high (unless
    # late_night)
    target_win_rate = 0.7  # General target
    if (
        context.daypart != "late_night"
    ):  # Late night has 100% win rate, no need to boost there
        if context.win_rate < target_win_rate:
            micro_signals += (
                target_win_rate - context.win_rate
            ) * 0.1  # Boost more if win rate is far below target
        elif context.win_rate > target_win_rate:
            micro_signals -= (
                context.win_rate - target_win_rate
            ) * 0.05  # Shave if winning too much, but less aggressively

    # 4. First-Price Bid Shading & Daypart Adaptation
    base_bid = 0.0
    if context.daypart == "primetime":
        # During primetime, competitors bid very high (avg_p90_competitor ~ 9.74).
        # We need to be aggressive but also consider the hard ceiling.
        # Bid slightly above P90, scaled by pacing.
        base_bid = (context.p90 + 0.05) * pacing_factor + micro_signals
    elif context.daypart == "late_night":
        # Late night has very low competitor P90 (~0.818) and 100% win rate.
        # Bid just below or at the floor to conserve budget.
        # Use a small fixed bid or slightly below P90, scaled by pacing.
        base_bid = max(
            0.50, (context.p90 * 0.95) * pacing_factor + micro_signals
        )  # Ensure minimum bid of 0.50
    elif context.daypart == "morning":
        # Morning has high win rate (~0.95) and low competitor P90 (~2.43).
        # We can be competitive but not overly aggressive.
        base_bid = (context.p90 * 1.02) * pacing_factor + micro_signals
    elif context.daypart == "lunch":
        # Lunch has very low win rate (~0.05) and moderate competitor P90 (~4.38).
        # Be slightly more aggressive than morning to try and gain impressions,
        # but don't overspend if it's a very competitive period.
        base_bid = (context.p90 * 1.05) * pacing_factor + micro_signals
    elif context.daypart == "afternoon":
        # Afternoon has low win rate (~0.17) and high competitor P90 (~8.22).
        # Similar to lunch, try to be competitive but don't overbid into a highly
        # contested period.
        base_bid = (context.p90 * 1.03) * pacing_factor + micro_signals
    else:
        # Default behavior for any unhandled dayparts
        base_bid = (context.p90 * 1.0) * pacing_factor + micro_signals

    # 5. Deterministic Safety Clamping
    # Ensure bid is within valid range [0.50, max_bid_ceiling]
    computed_bid = max(0.50, min(base_bid, context.max_bid_ceiling))

    return computed_bid
