"""Vibetube Bidding Agent ADK Agent Module."""

from pathlib import Path

from google.adk.agents import LlmAgent

from lib.config import settings
from lib.tools import data_agent_toolset, deploy_bidding_policy, get_campaign_info

PROMPT_PATH = Path(__file__).resolve().parent / "bidding_policy_prompt.md"

root_agent = LlmAgent(
    name="bidding_agent",
    model="gemini-3.8-flash",
    instruction=PROMPT_PATH.read_text(encoding="utf-8"),
    tools=[get_campaign_info, data_agent_toolset, deploy_bidding_policy],
)


async def run_cycle(emit_events: bool = True) -> dict:
    """Runs a single execution cycle of the root agent and returns structured results."""
    import asyncio
    import json
    import sys
    from google.adk.runners import InMemoryRunner
    from google.genai import types

    def emit(event_data: dict) -> None:
        if emit_events:
            try:
                print(json.dumps(event_data, default=str), flush=True)
                sys.stdout.flush()
            except Exception:
                pass

    emit({"type": "init", "message": "Initializing Gemini Agent session..."})

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
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
            campaign_info_dict = None
            step3_started = False

            async for event in runner.run_async(
                user_id="agent-user",
                session_id=session.id,
                new_message=types.Content(
                    role="user", parts=[types.Part.from_text(text=prompt)]
                ),
            ):
                # 1. Inspect function calls (tool invocation initiation)
                func_calls = (
                    event.get_function_calls()
                    if hasattr(event, "get_function_calls")
                    else []
                )
                for fc in func_calls:
                    args = dict(fc.args) if fc.args else {}
                    tool_name = fc.name or ""
                    tool_calls.append({"name": tool_name, "args": args})

                    if tool_name == "get_campaign_info":
                        emit({
                            "type": "step_start",
                            "step": 1,
                            "name": "get_campaign_info",
                            "message": "Querying ad server for live campaign parameters (budget, flight duration, bid ceilings)...",
                        })
                    elif "data_agent" in tool_name or tool_name in [
                        "ask_data_agent",
                        "list_accessible_data_agents",
                        "get_data_agent_info",
                    ]:
                        query = args.get("query") or args.get("question") or ""
                        if query:
                            sql_queries.append(str(query))
                        emit({
                            "type": "step_start",
                            "step": 2,
                            "name": "data_agent_toolset",
                            "message": "Dispatched natural language analytical intent to BigQuery Data Engineering Agent...",
                            "query": str(query),
                        })
                    elif tool_name == "deploy_bidding_policy":
                        code = args.get("python_code") or ""
                        summary = args.get("strategy_summary") or ""
                        emit({
                            "type": "step_start",
                            "step": 4,
                            "name": "deploy_bidding_policy",
                            "message": "Validating Python AST, verifying compute_bid signature, and testing AuctionContext...",
                            "code": code,
                            "summary": summary,
                        })

                # 2. Inspect function responses (tool invocation completion)
                func_responses = (
                    event.get_function_responses()
                    if hasattr(event, "get_function_responses")
                    else []
                )
                for fr in func_responses:
                    resp_name = fr.name or ""
                    resp_data = fr.response
                    if resp_name == "get_campaign_info":
                        campaign_dict = None
                        if isinstance(resp_data, dict):
                            res_val = resp_data.get("result")
                            if isinstance(res_val, dict):
                                campaign_dict = res_val
                            elif isinstance(res_val, str) and "=" in res_val:
                                import re
                                parsed = {}
                                for m in re.finditer(r"([a-zA-Z_]+)=('[^']*'|\"[^\"]*\"|[^\s,]+)", res_val):
                                    k, v = m.group(1), m.group(2).strip("'\"")
                                    try:
                                        parsed[k] = float(v) if "." in v else int(v)
                                    except ValueError:
                                        parsed[k] = v
                                campaign_dict = parsed if parsed else resp_data
                            else:
                                campaign_dict = resp_data
                        campaign_info_dict = campaign_dict
                        emit({
                            "type": "step_done",
                            "step": 1,
                            "name": "get_campaign_info",
                            "data": campaign_dict,
                            "campaign_info": campaign_dict,
                        })
                    elif "data_agent" in resp_name or resp_name in [
                        "ask_data_agent",
                        "list_accessible_data_agents",
                        "get_data_agent_info",
                    ]:
                        generated_sql = ""
                        findings = ""
                        if isinstance(resp_data, dict):
                            for item in resp_data.get("response", []):
                                if isinstance(item, dict):
                                    if "data" in item and isinstance(item["data"], dict) and "generatedSql" in item["data"]:
                                        generated_sql = item["data"]["generatedSql"]
                                    if "text" in item and isinstance(item["text"], dict):
                                        if item["text"].get("textType") == "FINAL_RESPONSE":
                                            parts = item["text"].get("parts", [])
                                            if parts:
                                                findings = "\n\n".join(parts)
                        if generated_sql and generated_sql not in sql_queries:
                            sql_queries.append(generated_sql)
                        emit({
                            "type": "step_done",
                            "step": 2,
                            "name": "data_agent_toolset",
                            "data": resp_data,
                            "generated_sql": generated_sql,
                            "findings": findings,
                        })
                    elif resp_name == "deploy_bidding_policy":
                        emit({
                            "type": "step_done",
                            "step": 4,
                            "name": "deploy_bidding_policy",
                            "data": resp_data,
                        })

                # 3. Inspect text/thought parts (Gemini reasoning engine)
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.text:
                            if not step3_started:
                                step3_started = True
                                emit({
                                    "type": "step_start",
                                    "step": 3,
                                    "name": "reasoning",
                                    "message": "Synthesizing bidding policy and mathematical rules...",
                                })
                            reasoning.append(part.text)
                            emit({
                                "type": "reasoning_chunk",
                                "step": 3,
                                "name": "reasoning",
                                "chunk": part.text,
                            })

            policy_path = (
                Path(__file__).resolve().parent / "policies" / "agent_bidding_policy.py"
            )
            script_content = (
                policy_path.read_text(encoding="utf-8") if policy_path.exists() else ""
            )
            final_result = {
                "type": "complete",
                "status": "success",
                "script": script_content,
                "tool_calls": tool_calls,
                "sql_queries": sql_queries,
                "reasoning": "\n".join(reasoning),
                "campaign_info": campaign_info_dict,
            }
            emit(final_result)
            return final_result
        except Exception as exc:
            if attempt < max_attempts:
                emit({
                    "type": "retry",
                    "attempt": attempt,
                    "max_attempts": max_attempts,
                    "error": str(exc),
                })
                await asyncio.sleep(2 * attempt)
                continue
            emit({
                "type": "error",
                "status": "error",
                "error_message": str(exc),
            })
            raise


def main():
    import asyncio

    asyncio.run(run_cycle())


if __name__ == "__main__":
    main()
