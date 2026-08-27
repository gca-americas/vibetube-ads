"""Vibetube Campaign Manager ADK Agent Package."""

import sys
from pathlib import Path

# Add parent directory to sys.path
PARENT_DIR = Path(__file__).resolve().parent.parent
if str(PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(PARENT_DIR))

from google.adk.agents import LlmAgent
from tools import (
    deploy_bidding_policy,
    get_campaign_info,
    query_bigquery_data_engineering_agent,
)

SPEC_PATH = PARENT_DIR / "bidding_policy_spec.md"

root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    tools=[
        get_campaign_info,
        query_bigquery_data_engineering_agent,
        deploy_bidding_policy,
    ],
)
