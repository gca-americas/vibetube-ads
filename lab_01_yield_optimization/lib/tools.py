"""Tool definitions for Vibetube Campaign Manager Agent."""

import json
import logging
import textwrap
from pathlib import Path

import requests
from bq_agent import BigQueryAgentClient
from .config import settings
from .models import CampaignInfo

logger = logging.getLogger("campaign_tools")
OUTPUT_POLICY_PATH = (
    Path(__file__).resolve().parent.parent / "policies" / "agent_bidding_policy.py"
)


def _wrap_long_lines(code: str, max_len: int = 88) -> str:
    """Wraps long comment lines to strictly adhere to max_len characters."""
    lines = []
    for line in code.splitlines():
        if len(line) <= max_len:
            lines.append(line)
            continue
        stripped = line.lstrip()
        indent = line[: len(line) - len(stripped)]
        if stripped.startswith("#"):
            wrapped = textwrap.wrap(
                stripped[1:].strip(), width=max_len - len(indent) - 2
            )
            for w in wrapped:
                lines.append(f"{indent}# {w}")
        elif "  #" in line:
            code_part, comment_part = line.split("  #", 1)
            wrapped = textwrap.wrap(
                comment_part.strip(), width=max_len - len(indent) - 2
            )
            for w in wrapped:
                lines.append(f"{indent}# {w}")
            lines.append(code_part)
        else:
            lines.append(line)
    return "\n".join(lines)


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
    url = f"{settings.ad_server_url}/campaign/config"
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


def query_bigquery_agent(question: str) -> str:
    """Delegates a data exploration or query request to the BigQuery Agent.

    Args:
        question: Natural language question describing what tables, schemas,
                  metrics, quantiles, or trends to analyze in BigQuery.

    Returns:
        The BigQuery Agent's analytical findings.
    """
    logger.info("Tool invoked: query_bigquery_agent")
    a2a_client = BigQueryAgentClient()
    result = a2a_client.send_a2a_message(question)
    return result.get("response_text", "No response from BigQuery Agent.")


def deploy_bidding_policy(python_code: str, strategy_summary: str) -> str:
    """Deploys the synthesized Python bidding policy script directly to disk.

    Args:
        python_code: Complete Python script implementing compute_bid(context).
        strategy_summary: Explanation of the market rationale and pricing logic.

    Returns:
        Confirmation message detailing deployment status and file location.
    """
    logger.info("Tool invoked: deploy_bidding_policy")
    logger.info("Strategy Rationale: %s", strategy_summary)

    cleaned_code = python_code.strip()
    if cleaned_code.startswith("```python"):
        cleaned_code = cleaned_code[len("```python") :].strip()
    if cleaned_code.startswith("```"):
        cleaned_code = cleaned_code[len("```") :].strip()
    if cleaned_code.endswith("```"):
        cleaned_code = cleaned_code[:-3].strip()

    cleaned_code = _wrap_long_lines(cleaned_code, max_len=88)

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
