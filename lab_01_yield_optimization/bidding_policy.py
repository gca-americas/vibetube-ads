"""Vibetube Ads - Production Bidding Policy Script

This script is executed by the Vibetube Ad Serving Engine to compute active
CPM bids for incoming video ad auction requests.

Engine Interface:
    compute_bid(telemetry, campaign) -> float
"""

def compute_bid(telemetry: dict, campaign: dict) -> float:
    """Computes the active CPM bid price for an incoming auction tick.
    
    Args:
        telemetry: Real-time market metrics dictionary containing:
            - 'daypart': 'morning' | 'afternoon' | 'primetime' | 'late_night'
            - 'competitor_p90': float (e.g. 2.35, 9.60, 0.85)
            - 'win_rate': float (0.0 to 1.0)
            - 'scenario': 'standard' | 'bidding_war' | 'dayparting' | 'chaos'
        campaign: Active campaign configuration dictionary containing:
            - 'budget_remaining': float (e.g. 2500.00)
            - 'max_bid_ceiling': float (e.g. 10.00)
            - 'active_bid_cpm': float (e.g. 2.50)
            
    Returns:
        float: The calculated CPM bid in USD (e.g. 2.50).
    """
    # Baseline Heuristic: Static starting bid
    current_bid = campaign.get("active_bid_cpm", 2.50)
    ceiling = campaign.get("max_bid_ceiling", 10.00)
    
    # Return starting bid capped at ceiling
    return min(current_bid, ceiling)
