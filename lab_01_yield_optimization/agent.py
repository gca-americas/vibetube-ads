"""Vibetube Campaign Manager ADK Agent Module."""

from pathlib import Path

import google.auth
from google.adk.agents import LlmAgent
from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig
from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset

from lib.config import settings
from lib.tools import deploy_bidding_policy, get_campaign_info

SPEC_PATH = Path(__file__).resolve().parent / "bidding_policy_spec.md"

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

root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    tools=[
        get_campaign_info,
        deploy_bidding_policy,
        data_agent_toolset,
    ],
)
