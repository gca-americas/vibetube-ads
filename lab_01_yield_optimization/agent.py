"""Vibetube Campaign Manager ADK Agent Module."""

import os
import sys
from pathlib import Path

# Add current directory to sys.path to resolve lib
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

import google.auth
from google.adk.agents import LlmAgent
from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig
from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset
from lib.config import settings
from lib.tools import deploy_bidding_policy, get_campaign_info

SPEC_PATH = CURRENT_DIR / "bidding_policy_spec.md"

# Configure Google Cloud Vertex AI and Gemini Data Agents API
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "True")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.project_id)
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", settings.location)

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

if __name__ == "__main__":
    import asyncio
    from google.adk.runners import Runner
    from google.adk.sessions import InMemorySessionService
    from google.genai import types

    async def main():
        prompt = (
            sys.argv[1]
            if len(sys.argv) > 1
            else (
                "Retrieve active campaign info, analyze BigQuery telemetry "
                "across dayparts using the BigQuery Data Engineering Agent, "
                "and deploy an adaptive bidding policy that balances spend "
                "pacing, clearing CPMs, and win rates."
            )
        )
        session_service = InMemorySessionService()
        session = await session_service.create_session(
            session_id="cli-session", app_name="vibetube_ads", user_id="user"
        )
        runner = Runner(
            agent=root_agent,
            session_service=session_service,
            app_name="vibetube_ads",
        )
        msg = types.Content(role="user", parts=[types.Part.from_text(text=prompt)])
        async for event in runner.run_async(
            session_id=session.id, user_id="user", new_message=msg
        ):
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        print(part.text)

    asyncio.run(main())
