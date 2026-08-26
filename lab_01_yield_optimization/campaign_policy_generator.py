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
from google.genai import types, Client
from bq_data_engineering_a2a_client import BigQueryDataEngineeringA2AClient

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
AD_SERVER_URL = os.environ.get("AD_SERVER_URL", "http://localhost:8080")
MODEL_ID = "gemini-2.5-flash"
SPEC_PATH = Path(__file__).parent / "bidding_policy_spec.md"


def get_campaign_info() -> str:
    """Retrieves active campaign configuration parameters.

    Returns:
        JSON string containing total budget, flight duration, max bid ceiling,
        and current active bid.
    """
    print("\n   [Tool 🛠️ get_campaign_info invoked]")
    try:
        res = requests.get(f"{AD_SERVER_URL}/campaign/config", timeout=3)
        if res.ok:
            return res.text
    except Exception:
        pass
    return json.dumps(
        {
            "total_budget": 2500.00,
            "flight_duration_hours": 24.0,
            "max_bid_ceiling": 10.00,
            "base_bid_cpm": 2.50,
            "active_bid_cpm": 2.50,
        },
        indent=2,
    )


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
