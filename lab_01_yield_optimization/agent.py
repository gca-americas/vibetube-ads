"""Vibetube Campaign Manager ADK Agent Module."""

import sys
from pathlib import Path

# Add current directory to sys.path to resolve lib
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from google.adk.agents import LlmAgent
from lib.tools import (
    deploy_bidding_policy,
    get_campaign_info,
    query_bigquery_data_engineering_agent,
)

SPEC_PATH = CURRENT_DIR / "bidding_policy_spec.md"

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
