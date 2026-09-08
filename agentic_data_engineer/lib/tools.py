"""Tool definitions for Vibetube Campaign Manager Agent."""

import json
import logging
import textwrap
from pathlib import Path

import requests
from .config import settings
from .models import AuctionContext, CampaignInfo
from .simulator import load_policy_from_code
from .validator import validate_script

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


def deploy_bidding_policy(python_code: str, strategy_summary: str) -> str:
    """Validates and deploys the synthesized Python bidding policy script to disk.

    Performs deterministic pre-flight self-evaluation:
    1. AST syntax parsing & compute_bid signature verification.
    2. Dynamic execution smoke test against a sample AuctionContext.
    If validation fails, returns rejection diagnostic feedback so the agent can self-correct.

    Args:
        python_code: Complete Python script implementing compute_bid(context).
        strategy_summary: Explanation of the market rationale and pricing logic.

    Returns:
        Confirmation message detailing deployment status or diagnostic error message.
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

    # 1. Deterministic AST & Signature Pre-flight Validation
    validation = validate_script(cleaned_code)
    if not validation.get("valid"):
        line_str = f" on line {validation['line']}" if validation.get("line") else ""
        err_type = validation.get("error_type", "ValidationError")
        msg = validation.get("message", "Script validation failed.")
        rejection_msg = (
            f"Deployment rejected ({err_type}{line_str}): {msg}. "
            "Please fix the script and call deploy_bidding_policy again."
        )
        logger.warning(rejection_msg)
        return rejection_msg

    # 2. Dynamic Smoke Test Execution with sample AuctionContext
    try:
        policy_func = load_policy_from_code(cleaned_code)
        dummy_context = AuctionContext(
            daypart="morning",
            budget_remaining=2500.0,
            hours_remaining=24.0,
            max_bid_ceiling=10.0,
            win_rate=0.5,
            p90=1.5,
            p90_history=[1.4, 1.5],
            win_rate_history=[0.5, 0.5],
            active_bid_cpm=2.5,
        )
        test_bid = policy_func(dummy_context)
        if not isinstance(test_bid, (int, float)) or isinstance(test_bid, bool):
            rejection_msg = (
                f"Deployment rejected: compute_bid returned type {type(test_bid).__name__} instead of float/int. "
                "Please ensure compute_bid(context) returns a numeric bid value."
            )
            logger.warning(rejection_msg)
            return rejection_msg
        if test_bid < 0:
            rejection_msg = (
                f"Deployment rejected: compute_bid returned negative bid (${test_bid:.2f}). "
                "Bids must be positive non-negative values."
            )
            logger.warning(rejection_msg)
            return rejection_msg
    except Exception as e:
        rejection_msg = (
            f"Deployment rejected (Runtime error during pre-flight smoke test): {type(e).__name__}: {str(e)}. "
            "Please fix the script and call deploy_bidding_policy again."
        )
        logger.warning(rejection_msg)
        return rejection_msg

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
    return (
        f"Validation passed (syntax & smoke test verified). "
        f"Successfully deployed bidding policy to {OUTPUT_POLICY_PATH.name}."
    )
