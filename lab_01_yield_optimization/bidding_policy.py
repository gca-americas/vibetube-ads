"""Vibetube Ads - Bidding Policy Script

This function is invoked by the Vibetube Ad Serving Engine on every auction tick
to determine the optimal first-price CPM bid for video ad placement.

Available Context Fields:
------------------------
- context["daypart"]: str ("morning" | "afternoon" | "primetime" | "late_night")
- context["recent_p90_cpm"]: float (Current rolling 5-minute P90 clearing floor in $)
- context["p90_history"]: list[float] (Last 5 P90 values for momentum/trend detection)
- context["recent_win_rate"]: float (Current rolling win rate from 0.0 to 1.0)
- context["win_rate_history"]: list[float] (Last 5 win rate values)
- context["budget_remaining"]: float (Dollars left in the campaign)
- context["hours_remaining"]: float (Hours remaining in the 24-hour campaign flight)
- context["max_bid_ceiling"]: float (Hard guardrail authorized ceiling in $)
"""

def compute_bid(context: dict) -> float:
    # Baseline Starting Policy: Naive flat bid ($2.50 CPM)
    current_bid = 2.50
    ceiling = context.get("max_bid_ceiling", 10.00)
    
    return min(current_bid, ceiling)