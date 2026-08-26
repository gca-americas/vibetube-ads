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
