"""Tool definitions for Vibetube Bidding Agent."""

import logging
import textwrap
from pathlib import Path
from typing import Any

import google.auth
from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig
from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset
import requests
from .config import settings
from .models import AuctionContext, CampaignInfo
from .simulator import load_policy_from_code, run_simulation
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


def get_campaign_info() -> dict:
    """Retrieves active campaign configuration parameters from the ad server.

    Returns:
        dict: Dictionary containing campaign budget, duration,
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
    return campaign_info.model_dump()


def _patch_google_auth():
    """Patches google.auth to prevent Cloud Shell metadata server token refresh failures."""
    try:
        import datetime
        import subprocess
        import google.auth.compute_engine.credentials as ce_creds

        _orig_retrieve_info = ce_creds.Credentials._retrieve_info
        _orig_perform_refresh = ce_creds.Credentials._perform_refresh_token

        def _safe_retrieve_info(self, request):
            self._service_account_email = "default"
            try:
                return _orig_retrieve_info(self, request)
            except Exception:
                self._service_account_email = "default"
                if self._scopes is None:
                    self._scopes = getattr(self, "_default_scopes", None)

        def _safe_perform_refresh(self, request):
            try:
                _orig_perform_refresh(self, request)
            except Exception as e:
                try:
                    token = subprocess.check_output(
                        ["gcloud", "auth", "print-access-token"],
                        text=True,
                        timeout=10,
                        stderr=subprocess.DEVNULL,
                    ).strip()
                    if token:
                        self.token = token
                        self.expiry = datetime.datetime.now(
                            datetime.timezone.utc
                        ) + datetime.timedelta(minutes=45)
                        return
                except Exception:
                    pass
                raise e

        ce_creds.Credentials._retrieve_info = _safe_retrieve_info
        ce_creds.Credentials._perform_refresh_token = _safe_perform_refresh
    except Exception:
        pass


_patch_google_auth()

# Native ADK Data Agent Toolset connecting to Google Cloud's BigQuery Data Engineering Agent
credentials, _ = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
cred_config = DataAgentCredentialsConfig(credentials=credentials)
tool_config = DataAgentToolConfig(
    api_endpoint="https://geminidataanalytics.googleapis.com",
    location="global",
)
data_agent_toolset = DataAgentToolset(
    credentials_config=cred_config,
    data_agent_tool_config=tool_config,
)


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


def evaluate_policy(
    policy_code: str,
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
) -> dict[str, Any]:
    """Simulates candidate bidding policy across a 24-hour market flight in-memory."""
    try:
        policy_func = load_policy_from_code(policy_code)
        result = run_simulation(
            policy_func,
            total_budget=total_budget,
            flight_duration_hours=flight_duration_hours,
            max_bid_ceiling=max_bid_ceiling,
        )
        return {
            "status": "success",
            "score": result.yield_score,
            "impressions_won": result.total_impressions,
            "total_spend": result.total_spend,
            "budget_remaining": result.budget_remaining,
            "budget_utilization_pct": result.budget_utilization_pct,
            "effective_cpm": result.effective_cpm,
            "hours_active": result.hours_active,
            "exhausted_hour": result.exhausted_hour,
            "overall_win_rate_pct": result.overall_win_rate,
            "daypart_metrics": result.daypart_metrics,
            "summary": result.summary_text,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "score": 0.0,
            "impressions_won": 0,
            "total_spend": 0.0,
            "budget_remaining": total_budget,
            "effective_cpm": 0.0,
            "summary": f"Policy compilation/execution failed: {e}",
        }

