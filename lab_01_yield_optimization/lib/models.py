"""Data models for Vibetube yield optimization and campaign management."""

from pydantic import BaseModel, Field


class CampaignInfo(BaseModel):
    """Active advertising campaign configuration parameters."""

    id: str = Field(..., description="Unique campaign identifier")
    name: str = Field(..., description="Campaign name")
    total_budget: float = Field(..., description="Total campaign budget in USD")
    budget_remaining: float = Field(..., description="Current budget remaining in USD")
    max_bid_ceiling: float = Field(
        ..., description="Hard maximum bid ceiling guardrail in USD CPM"
    )
    base_bid_cpm: float = Field(
        default=2.50, description="Base starting bid price in USD CPM"
    )
    active_bid_cpm: float = Field(
        default=2.50, description="Current active bid price in USD CPM"
    )
    flight_duration_hours: float = Field(
        default=24.0, description="Total campaign flight duration in hours"
    )


class AuctionContext(BaseModel):
    """Runtime auction tick telemetry and campaign constraints."""

    daypart: str = Field(
        ...,
        description=(
            "Market window: 'morning', 'lunch', 'afternoon', 'primetime', "
            "or 'late_night'"
        ),
    )
    budget_remaining: float = Field(
        ..., description="Total campaign budget remaining in USD"
    )
    hours_remaining: float = Field(..., description="Hours left in the campaign flight")
    max_bid_ceiling: float = Field(
        ..., description="Hard maximum bid ceiling guardrail in USD CPM"
    )
    win_rate: float = Field(
        ..., description="Recent auction win rate ratio (0.0 to 1.0)"
    )
    p90: float = Field(
        ...,
        description="90th percentile competitor clearing price in USD CPM",
    )
    p90_history: list[float] = Field(
        default_factory=list,
        description="Trailing P90 values for momentum velocity",
    )
    win_rate_history: list[float] = Field(
        default_factory=list,
        description="Trailing win rates over recent ticks",
    )
    active_bid_cpm: float | None = Field(
        default=None,
        description="Current bid price from preceding tick",
    )
