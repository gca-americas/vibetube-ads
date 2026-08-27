import os
import sys
from pathlib import Path

# Default to Vertex AI backend with Application Default Credentials (ADC)
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", "us-central1")

# Add current directory to sys.path to resolve lib
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from google.adk.agents import LlmAgent
from lib.tools import deploy_bidding_policy, get_campaign_info, query_bigquery_agent

SPEC_PATH = CURRENT_DIR / "bidding_policy_spec.md"

root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    tools=[
        get_campaign_info,
        query_bigquery_agent,
        deploy_bidding_policy,
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
                "Retrieve active campaign info, analyze telemetry across "
                "dayparts, and deploy an optimized bidding policy."
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
