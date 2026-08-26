#!/usr/bin/env python3
"""Campaign Policy Generator.

Top-level Campaign Manager Agent responsible for querying campaign
configuration, collaborating with the BigQuery Data Engineering Agent over A2A,
and deploying a production Python bidding policy implementing
`def compute_bid(context: dict) -> float`.
"""

import logging
import os
from pathlib import Path

from google.genai import types, Client
from tools import (
    deploy_bidding_policy,
    get_campaign_info,
    query_bigquery_data_engineering_agent,
)

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("campaign_policy_generator")

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
MODEL_ID = "gemini-2.5-flash"
SPEC_PATH = Path(__file__).parent / "bidding_policy_spec.md"


def run_campaign_manager_agent() -> str:
    """Invokes the Campaign Manager Agent with runtime tools."""
    logger.info(
        "Starting Campaign Manager Agent: Autonomous Bidding Strategy Synthesis"
    )

    system_instruction = SPEC_PATH.read_text(encoding="utf-8")
    client = Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

    chat = client.chats.create(
        model=MODEL_ID,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=[
                get_campaign_info,
                query_bigquery_data_engineering_agent,
                deploy_bidding_policy,
            ],
            temperature=0.2,
        ),
    )
    prompt = (
        "Retrieve active campaign info and consult the BigQuery Data "
        "Engineering Agent to analyze historical auction telemetry across "
        "dayparts. Formulate an optimal bidding strategy and deploy the "
        "production Python `def compute_bid(context: dict) -> float` policy "
        "using the `deploy_bidding_policy` tool."
    )
    response = chat.send_message(prompt)
    logger.info("Agent run completed. Response: %s", response.text)
    return response.text or ""


if __name__ == "__main__":
    run_campaign_manager_agent()
