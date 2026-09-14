"""Judge Agent ADK module for evaluating bidding policies."""

from pathlib import Path

from google.adk.agents import LlmAgent
from google.genai import types

from lib.config import settings
from lib.tools import evaluate_policy

PROMPT_PATH = Path(__file__).resolve().parent / "judge_prompt.md"

retry_config = types.GenerateContentConfig(
    http_options=types.HttpOptions(
        retry_options=types.HttpRetryOptions(
            attempts=6,
            initial_delay=2.0,
            max_delay=60.0,
            http_status_codes=[429, 500, 503, 504],
        )
    )
)

judge_agent = LlmAgent(
    name="simulation_judge",
    model=settings.model_name,
    description="Simulates and critiques candidate bidding policies.",
    instruction=PROMPT_PATH.read_text(encoding="utf-8"),
    tools=[evaluate_policy],
    generate_content_config=retry_config,
)


def evaluate_policy_with_judge(policy_code: str) -> dict:
    """Executes the Judge Agent to simulate and critique a candidate bidding policy."""
    import re
    from google.adk.runners import InMemoryRunner
    from google.genai import types

    runner = InMemoryRunner(agent=judge_agent)
    session = runner.session_service.create_session_sync(
        app_name=runner.app_name, user_id="evaluator"
    )
    prompt = (
        "Evaluate this candidate bidding policy using evaluate_policy:\n\n"
        f"```python\n{policy_code}\n```"
    )
    message = types.Content(
        role="user",
        parts=[types.Part.from_text(text=prompt)],
    )

    simulation_telemetry = {}
    content_chunks = []

    for event in runner.run(user_id="evaluator", session_id=session.id, new_message=message):
        func_resps = (
            event.get_function_responses()
            if hasattr(event, "get_function_responses")
            else []
        )
        for fr in func_resps:
            if fr.response and isinstance(fr.response, dict):
                simulation_telemetry = fr.response

        if event.content and event.content.parts:
            for p in event.content.parts:
                if p.text:
                    content_chunks.append(p.text)

    # Fallback to local evaluate_policy if tool wasn't invoked by LLM
    if not simulation_telemetry:
        simulation_telemetry = evaluate_policy(policy_code)

    full_text = "".join(content_chunks).strip()

    # Parse out diagnostics and recommendations sections from the critique
    diagnostics = ""
    recommendations = ""

    diag_match = re.search(
        r"#{1,4}\s*(?:\d+\.?)?\s*[*_]*Root[- ]Cause\s*Diagnostics[^\n]*\n([\s\S]*?)(?=#{1,4}\s*(?:\d+\.?)?\s*[*_]*Algorithmic\s*Recommendations|#{1,4}\s*(?:\d+\.?)?\s*[*_]*Recommendations|\Z)",
        full_text,
        re.IGNORECASE,
    )
    if not diag_match:
        diag_match = re.search(
            r"#{1,4}\s*(?:\d+\.?)?\s*[*_]*Diagnostics[^\n]*\n([\s\S]*?)(?=#{1,4}\s*(?:\d+\.?)?\s*[*_]*Recommendations|\Z)",
            full_text,
            re.IGNORECASE,
        )
    if diag_match:
        diagnostics = diag_match.group(1).strip()

    recs_match = re.search(
        r"#{1,4}\s*(?:\d+\.?)?\s*[*_]*Algorithmic\s*Recommendations[^\n]*\n([\s\S]*?)(?=#{1,4}|\Z)",
        full_text,
        re.IGNORECASE,
    )
    if not recs_match:
        recs_match = re.search(
            r"#{1,4}\s*(?:\d+\.?)?\s*[*_]*Recommendations[^\n]*\n([\s\S]*?)(?=#{1,4}|\Z)",
            full_text,
            re.IGNORECASE,
        )
    if recs_match:
        recommendations = recs_match.group(1).strip()

    if not diagnostics and full_text:
        diagnostics = full_text

    return {
        "status": "success",
        "score": simulation_telemetry.get("score"),
        "total_impressions": simulation_telemetry.get("impressions_won"),
        "total_spend": simulation_telemetry.get("total_spend"),
        "budget_remaining": simulation_telemetry.get("budget_remaining"),
        "budget_utilization_pct": simulation_telemetry.get("budget_utilization_pct"),
        "effective_cpm": simulation_telemetry.get("effective_cpm"),
        "overall_win_rate": simulation_telemetry.get("overall_win_rate_pct"),
        "exhausted_hour": simulation_telemetry.get("exhausted_hour"),
        "diagnostics": diagnostics,
        "recommendations": recommendations,
        "full_critique": full_text,
    }


if __name__ == "__main__":
    import argparse
    import json
    import sys

    parser = argparse.ArgumentParser(description="Execute Judge Agent on a candidate bidding policy")
    parser.add_argument("--file", required=True, help="Path to candidate policy file")
    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.is_absolute():
        file_path = Path(__file__).resolve().parent / args.file

    if not file_path.exists():
        print(json.dumps({"status": "error", "error_message": f"File not found: {file_path}"}))
        sys.exit(1)

    try:
        code = file_path.read_text(encoding="utf-8")
        result = evaluate_policy_with_judge(code)
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"status": "error", "error_message": str(exc)}))
        sys.exit(1)
