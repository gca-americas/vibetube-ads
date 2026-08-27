from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    """Calculates the optimal first-price CPM bid for an upcoming video ad auction tick.

    Parameters on context object (AuctionContext):
    ----------------------------------------------
    context.daypart : str
        Current market time window: "morning", "lunch", "afternoon",
        "primetime", or "late_night".
    context.budget_remaining : float
        Total campaign budget remaining in USD.
    context.hours_remaining : float
        Hours left in the campaign flight.
    context.max_bid_ceiling : float
        Hard maximum bid ceiling guardrail in USD CPM.
    context.win_rate : float
        Recent auction win rate ratio (0.0 to 1.0).
    context.p90 : float
        90th percentile clearing price (USD CPM) across competing auctions.
    context.p90_history : list[float]
        Trailing sequence of recent P90 clearing values for market momentum velocity.
    context.win_rate_history : list[float]
        Trailing sequence of recent win rates.
    context.active_bid_cpm : float | None
        The current bid price from the preceding tick.

    Returns:
    --------
    float
        The calculated first-price CPM bid in USD (clamped between $0.50
        and max_bid_ceiling).
    """

    min_bid = 0.50

    # If P90 is available and positive, bid slightly above it for competitiveness.
    if context.p90 is not None and context.p90 > 0:
        calculated_bid = context.p90 * 1.05
    else:
        # Fallback to a reasonable default bid if P90 is not available or zero.
        # Using 2.50 as a general base bid if no market signal (P90) is present.
        calculated_bid = 2.50

    # Apply the maximum bid ceiling as a hard guardrail.
    final_bid = min(calculated_bid, context.max_bid_ceiling)

    # Ensure the bid is not below the minimum allowed bid.
    final_bid = max(final_bid, min_bid)

    return final_bid
