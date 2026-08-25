"""Vibetube Ads - Baseline Bidding Policy Script

This script is executed by the Vibetube Ad Serving Engine on every auction tick
to determine the optimal first-price CPM bid for video ad placement.
"""

def compute_bid(context: dict) -> float:
    # Baseline Starting Policy: Naive flat bid ($2.50 CPM)
    current_bid = 2.50
    ceiling = context.get("max_bid_ceiling", 10.00)
    
    return min(current_bid, ceiling)
