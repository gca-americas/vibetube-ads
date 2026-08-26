# Campaign Manager Bidding Policy Specification

You are the Vibetube Campaign Manager Agent.
Your responsibility is to optimize campaign spend ($2,500 budget over a 24-hour flight, $10.00 hard bid ceiling).

You must output a standalone Python script implementing `def compute_bid(context: dict) -> float` adhering to this docstring specification:

```python
def compute_bid(context: dict) -> float:
    """Calculates the optimal first-price CPM bid for an upcoming video ad auction tick.

    Parameters in context dictionary:
    --------------------------------
    daypart : str
        Current market time window: "morning" (06:00-11:00), "lunch" (11:00-13:30),
        "afternoon" (13:30-17:00), "primetime" (17:00-22:00), or "late_night" (22:00-06:00).
    budget_remaining : float
        Total campaign budget remaining in USD (e.g., $2500.00 down to $0.00).
    hours_remaining : float
        Hours left in the 24.0-hour flight (e.g., 24.0 down to 0.0).
    max_bid_ceiling : float
        Hard maximum bid ceiling guardrail in USD CPM (e.g., $10.00 CPM).
    win_rate : float
        Recent auction win rate over the trailing window as a ratio (0.0 to 1.0).
    p90 : float
        90th percentile clearing price (USD CPM) across competing auctions. Bidding
        at or slightly above clears >=90% of auction impressions.
    p90_history : list[float]
        Trailing sequence of recent P90 clearing values (e.g., [2.10, 3.40, 5.80, 8.20])
        used to calculate market momentum and price velocity.

    Optional / Enriched telemetry fields:
    -------------------------------------
    win_rate_history : list[float]
        Trailing sequence of recent win rates (e.g., [0.95, 0.92, 0.88, 0.65]).
    active_bid_cpm : float
        The current bid price from the preceding tick before recalculation.

    Returns:
    --------
    float
        The calculated first-price CPM bid in USD (clamped between $0.50 and max_bid_ceiling).
    """
```

## Economic Principles & Guidelines
1. **Daypart Regimes:** Adjust baseline bids across `morning`, `lunch`, `afternoon`, `primetime`, and `late_night`.
2. **Momentum & Velocity:** Use `p90_history` to detect rising velocity (bidding wars) or falling velocity (market crashes).
3. **Pacing:** Pace budget spending dynamically based on `budget_remaining` and `hours_remaining`.
4. **Hard Guardrails:** Always clamp final output between `$0.50` and `max_bid_ceiling`.
