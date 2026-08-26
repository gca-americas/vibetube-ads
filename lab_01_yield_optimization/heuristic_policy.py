"""Vibetube Ads - Hand-Coded Dayparting Heuristic
Authored by Data Engineer to handle diurnal traffic waves.
"""


def compute_bid(context: dict) -> float:
    daypart = context.get("daypart", "morning")
    ceiling = context.get("max_bid_ceiling", 10.00)

    if daypart == "primetime":
        return min(9.65, ceiling)
    elif daypart == "late_night":
        return 0.90
    elif daypart == "afternoon":
        return 3.55
    else:
        return 2.40
