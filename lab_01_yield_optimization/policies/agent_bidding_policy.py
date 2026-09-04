from lib.models import AuctionContext

# Campaign parameters discovered at deployment time from get_campaign_info()
# These are constant for the entire campaign duration.
# The agent retrieves these once and "injects" them into the deployed policy script.
_TOTAL_CAMPAIGN_BUDGET = 2500.0
_FLIGHT_DURATION_HOURS = 24.0

# Calculate ideal hourly velocity once at the start of the campaign for pacing
_IDEAL_HOURLY_VELOCITY = _TOTAL_CAMPAIGN_BUDGET / _FLIGHT_DURATION_HOURS


def compute_bid(context: AuctionContext) -> float:
    """Calculates the optimal first-price CPM bid for an upcoming auction tick."""

    # 1. Dynamic Budget Pacing Formulation
    # Guard against division by zero for hours_remaining (though max(0.5, ...) handles
    # small values)
    current_hourly_burn = context.budget_remaining / max(0.5, context.hours_remaining)
    pacing_factor = min(1.25, max(0.70, current_hourly_burn / _IDEAL_HOURLY_VELOCITY))

    # 2. Micro-Signals: Price Momentum & Closed-Loop Win-Rate Feedback
    p90_momentum_factor = 0.0
    if context.p90_history and len(context.p90_history) > 1:
        # Consider the last 5 P90 values for momentum
        recent_p90s = (
            context.p90_history[-5:]
            if len(context.p90_history) >= 5
            else context.p90_history
        )
        avg_recent_p90 = sum(recent_p90s) / len(recent_p90s)

        if avg_recent_p90 > 0:  # Avoid division by zero
            # If current P90 is significantly higher than recent average
            if context.p90 > avg_recent_p90 * 1.05:
                p90_momentum_factor = 0.05
            # If current P90 is significantly lower than recent average
            elif context.p90 < avg_recent_p90 * 0.95:
                p90_momentum_factor = -0.05

    win_rate_adjustment = 0.0
    # Boost bids if win rate is too low, especially if it's not a known high win-rate
    # daypart
    if context.win_rate < 0.20:
        win_rate_adjustment = 0.10  # Aggressively boost
    elif context.win_rate > 0.90 and context.daypart not in [
        "primetime",
        "lunch",
        "afternoon",
    ]:
        # Only shave if we're over-winning in less competitive dayparts
        win_rate_adjustment = -0.02  # Slightly reduce to optimize spend

    micro_signals = p90_momentum_factor + win_rate_adjustment

    # 3. First-Price Bid Shading & Daypart Adaptation
    base_bid = 0.0

    # Fallback P90 if context.p90 is not available or zero to ensure a positive baseline
    effective_p90 = max(0.50, context.p90 if context.p90 is not None else 1.0)

    if context.daypart == "late_night":
        # Off-peak, high historical win rate, shade below P90 to conserve budget
        base_bid = (effective_p90 * 0.95) + micro_signals
    elif context.daypart == "morning":
        # Standard daypart, relatively high historical win rate, shade slightly below
        # P90
        base_bid = (effective_p90 * 0.98) + micro_signals
    elif context.daypart == "lunch":
        # Standard daypart, very low historical win rate, bid aggressively above P90
        base_bid = (effective_p90 + 0.10) + micro_signals
    elif context.daypart == "afternoon":
        # Standard daypart, low historical win rate, bid aggressively above P90
        base_bid = (effective_p90 + 0.07) + micro_signals
    elif context.daypart == "primetime":
        # Peak demand, 0% historical win rate, be very aggressive to gain impressions
        base_bid = (effective_p90 + 0.15) + micro_signals
    else:
        # Default for any unhandled daypart, use P90 as a base with micro-signals
        base_bid = effective_p90 + micro_signals

    # Apply pacing factor to the shaded base bid to balance spend over time
    computed_bid = base_bid * pacing_factor

    # 4. Deterministic Safety Clamping
    # Ensure bid is at least a minimum positive value (e.g., $0.50 CPM)
    computed_bid = max(0.50, computed_bid)
    # Ensure bid does not exceed the campaign's hard max bid ceiling
    computed_bid = min(computed_bid, context.max_bid_ceiling)

    return computed_bid
