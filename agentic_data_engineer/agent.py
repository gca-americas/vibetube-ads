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

# ==============================================================================
# Enterprise ADK 2.0 Agent Tool Binding
# ==============================================================================
# Google Cloud Agent Development Kit (ADK) 2.0 binds Python callables and managed
# toolsets directly to the LlmAgent. During runtime execution, Gemini reasons
# over function signatures and docstrings to select and execute tools autonomously.
#
# The Campaign Manager requires 3 enterprise tools:
# 1. The Wallet (get_campaign_info):
#    Fetches active budget, remaining flight hours, and the $4.50 bid ceiling.
# 2. The Clock & Competition (data_agent_toolset):
#    Binds the Gemini Data Analytics Agent to run natural language telemetry
#    inquiries directly against Google Cloud BigQuery.
# 3. The Action (deploy_bidding_policy):
#    Validates synthesized Python compute_bid formulas via AST and runtime
#    smoke tests, then atomically commits the winning code to disk.
root_agent = LlmAgent(
    name="campaign_manager",
    model=settings.model_name,
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    tools=[
        get_campaign_info,      # Tool 1: The Wallet (REST API boundary reader)
        data_agent_toolset,     # Tool 2: The Clock & Market (BigQuery A2A toolset)
        deploy_bidding_policy,  # Tool 3: The Action (AST validator & code actuator)
    ],
)


async def run_cycle() -> dict:
    """Runs a single execution cycle of the root agent and returns structured results."""
    from google.adk.runners import InMemoryRunner
    from google.genai import types

    runner = InMemoryRunner(agent=root_agent)
    session = await runner.session_service.create_session(
        app_name=runner.app_name, user_id="agent-user"
    )
    prompt = (
        "Retrieve active campaign info, analyze auction telemetry across "
        "dayparts, and deploy compute_bid policy."
    )
    tool_calls = []
    sql_queries = []
    reasoning = []
    async for event in runner.run_async(
        user_id="agent-user",
        session_id=session.id,
        new_message=types.Content(
            role="user", parts=[types.Part.from_text(text=prompt)]
        ),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.function_call:
                    args = (
                        dict(part.function_call.args)
                        if part.function_call.args
                        else {}
                    )
                    tool_calls.append({
                        "name": part.function_call.name,
                        "args": args,
                    })
                    if "query" in args:
                        sql_queries.append(str(args["query"]))
                    elif "question" in args:
                        sql_queries.append(str(args["question"]))
                if part.text:
                    reasoning.append(part.text)

    policy_path = (
        Path(__file__).resolve().parent / "policies" / "agent_bidding_policy.py"
    )
    script_content = (
        policy_path.read_text(encoding="utf-8") if policy_path.exists() else ""
    )
    return {
        "status": "success",
        "script": script_content,
        "tool_calls": tool_calls,
        "sql_queries": sql_queries,
        "reasoning": "\n".join(reasoning),
    }


def main():
    import asyncio
    import json

    result = asyncio.run(run_cycle())
    print(json.dumps(result))


if __name__ == "__main__":
    main()
