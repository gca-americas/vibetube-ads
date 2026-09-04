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
