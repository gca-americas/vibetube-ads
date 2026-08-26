#!/usr/bin/env python3
"""Campaign Policy Generator.

Top-level Campaign Manager Agent responsible for querying campaign
configuration, collaborating with the BigQuery Data Engineering Agent over A2A,
and synthesizing a production Python bidding policy implementing
`def compute_bid(context: dict) -> float`.
"""

import json
import os
import re
from pathlib import Path

import requests
from pydantic import BaseModel, Field
from google.genai import types, Client
from bq_data_engineering_a2a_client import BigQueryDataEngineeringA2AClient

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
AD_SERVER_URL = os.environ.get("AD_SERVER_URL", "http://localhost:8080")
MODEL_ID = "gemini-2.5-flash"
SPEC_PATH = Path(__file__).parent / "bidding_policy_spec.md"


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


def get_campaign_info() -> CampaignInfo:
    """Retrieves active campaign configuration parameters from the ad server.

    Returns:
        CampaignInfo: Pydantic model containing campaign budget, duration,
                      and bid guardrails.

    Raises:
        requests.RequestException: If the ad server is unreachable or fails.
        pydantic.ValidationError: If the ad server response is invalid.
    """
    print("\n   [Tool 🛠️ get_campaign_info invoked]")
    url = f"{AD_SERVER_URL}/campaign/config"
    res = requests.get(url, timeout=5)
    res.raise_for_status()
    return CampaignInfo.model_validate(res.json())


def query_bigquery_data_engineering_agent(question: str) -> str:
    """Delegates a data exploration or query request to the BigQuery Data Agent.

    Args:
        question: Natural language question describing what tables, schemas,
                  metrics, quantiles, or trends to analyze in BigQuery.

    Returns:
        The BigQuery Data Engineering Agent's analytical findings.
    """
    print(f"\n   [Tool 🛠️ query_bigquery_data_engineering_agent invoked]")
    a2a_client = BigQueryDataEngineeringA2AClient(
        project_id=PROJECT_ID, location=LOCATION
    )
    result = a2a_client.send_a2a_message(question)
    return result.get(
        "response_text", "No response from BigQuery Data Engineering Agent."
    )


def extract_python_code(response_text: str) -> str:
    """Extracts python code block from markdown response."""
    blocks = re.findall(r"```python\s*([\s\S]*?)\s*```", response_text)
    for block in blocks:
        if "def compute_bid" in block:
            return block.strip()
    return response_text.strip()


def run_campaign_manager_agent() -> str:
    """Invokes the Campaign Manager Agent with runtime campaign & BigQuery tools."""
    print("=" * 65)
    print("🎯 Campaign Manager Agent: Autonomous Bidding Strategy Synthesis")
    print("=" * 65)

    system_instruction = SPEC_PATH.read_text(encoding="utf-8")
    client = Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

    chat = client.chats.create(
        model=MODEL_ID,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[get_campaign_info, query_bigquery_data_engineering_agent],
            temperature=0.2,
        ),
    )
    prompt = (
        "Retrieve the active campaign info and consult the BigQuery Data "
        "Engineering Agent to analyze historical auction telemetry across "
        "dayparts. Formulate an optimal bidding strategy and generate the "
        "production Python `def compute_bid(context: dict) -> float` script."
    )
    response = chat.send_message(prompt)

    generated_code = extract_python_code(response.text)
    print("\n📝 Generated Python Script:")
    print("-" * 65)
    print(generated_code)
    print("-" * 65)

    return generated_code


if __name__ == "__main__":
    run_campaign_manager_agent()
