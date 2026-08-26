#!/usr/bin/env python3
"""Campaign Policy Generator.

Top-level Campaign Manager Agent responsible for querying campaign
configuration, collaborating with the BigQuery Data Engineering Agent over A2A,
and synthesizing a production Python bidding policy implementing
`def compute_bid(context: dict) -> float`.
"""

import json
import logging
import os
import re
from pathlib import Path

import requests
from google.genai import types, Client
from bq_data_engineering_a2a_client import BigQueryDataEngineeringA2AClient
from models import CampaignInfo

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("campaign_policy_generator")

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
AD_SERVER_URL = os.environ.get("AD_SERVER_URL", "http://localhost:8080")
MODEL_ID = "gemini-2.5-flash"
SPEC_PATH = Path(__file__).parent / "bidding_policy_spec.md"


def get_campaign_info() -> CampaignInfo:
    """Retrieves active campaign configuration parameters from the ad server.

    Returns:
        CampaignInfo: Pydantic model containing campaign budget, duration,
                      and bid guardrails.

    Raises:
        requests.RequestException: If the ad server is unreachable or fails.
        pydantic.ValidationError: If the ad server response is invalid.
    """
    logger.info("Tool invoked: get_campaign_info")
    url = f"{AD_SERVER_URL}/campaign/config"
    res = requests.get(url, timeout=5)
    res.raise_for_status()
    campaign_info = CampaignInfo.model_validate(res.json())
    logger.info(
        "Campaign configuration retrieved: ID=%s, Budget=$%.2f, Ceiling=$%.2f",
        campaign_info.id,
        campaign_info.total_budget,
        campaign_info.max_bid_ceiling,
    )
    return campaign_info


def query_bigquery_data_engineering_agent(question: str) -> str:
    """Delegates a data exploration or query request to the BigQuery Data Agent.

    Args:
        question: Natural language question describing what tables, schemas,
                  metrics, quantiles, or trends to analyze in BigQuery.

    Returns:
        The BigQuery Data Engineering Agent's analytical findings.
    """
    logger.info("Tool invoked: query_bigquery_data_engineering_agent")
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
    logger.info(
        "Starting Campaign Manager Agent: Autonomous Bidding Strategy Synthesis"
    )

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
    logger.info("Generated Python bidding policy script:\n%s", generated_code)

    return generated_code


if __name__ == "__main__":
    run_campaign_manager_agent()
