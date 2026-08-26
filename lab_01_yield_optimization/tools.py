"""Tool definitions for Vibetube Campaign Manager Agent."""

import json
import logging
import os
from pathlib import Path

import requests
from bq_data_engineering_a2a_client import BigQueryDataEngineeringA2AClient
from models import CampaignInfo

logger = logging.getLogger("campaign_tools")

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
AD_SERVER_URL = os.environ.get("AD_SERVER_URL", "http://localhost:8080")
OUTPUT_POLICY_PATH = Path(__file__).parent / "bidding_policy.py"


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


def deploy_bidding_policy(python_code: str, strategy_summary: str) -> str:
    """Deploys the synthesized Python bidding policy script directly to disk.

    Args:
        python_code: The complete Python script implementing compute_bid(context).
        strategy_summary: Concise explanation of the market rationale and pricing logic.

    Returns:
        Confirmation message detailing deployment status and file location.
    """
    logger.info("Tool invoked: deploy_bidding_policy")
    logger.info("Strategy Rationale: %s", strategy_summary)

    # Clean potential wrapping code markdown fences if present
    cleaned_code = python_code.strip()
    if cleaned_code.startswith("```python"):
        cleaned_code = cleaned_code[len("```python") :].strip()
    if cleaned_code.startswith("```"):
        cleaned_code = cleaned_code[len("```") :].strip()
    if cleaned_code.endswith("```"):
        cleaned_code = cleaned_code[:-3].strip()

    try:
        import black

        cleaned_code = black.format_str(
            cleaned_code, mode=black.FileMode(line_length=88)
        )
    except Exception as e:
        logger.debug("Black auto-format skipped: %s", e)

    OUTPUT_POLICY_PATH.write_text(cleaned_code, encoding="utf-8")
    logger.info(
        "Successfully deployed %d bytes to %s",
        len(cleaned_code),
        OUTPUT_POLICY_PATH,
    )
    return f"Successfully deployed bidding policy to {OUTPUT_POLICY_PATH.name}."
