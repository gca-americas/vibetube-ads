import os
import sys
import json
import time
import requests
from google.cloud import bigquery
from google.genai import types, Client

# Configuration
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
AD_SERVER_URL = os.environ.get("AD_SERVER_URL", "http://localhost:8080")
SCRIPT_PATH = "/Users/ljhenne/Git/github.com/gca-americas/vibetube-ads/lab_01_yield_optimization/bidding_policy.py"

EXECUTION_LOG = {
    "sql_queries": [],
    "tool_calls": [],
    "reasoning": "",
    "generated_script": "",
    "new_bid": None,
    "status": "success",
}


def get_bq_client():
    return bigquery.Client(project=PROJECT_ID)


def get_genai_client():
    return Client(vertexai=True, project=PROJECT_ID, location="us-central1")


def get_campaign_config() -> str:
    """Fetches active campaign parameters including budget, ceiling, and active bid.

    Returns:
        JSON string of campaign configuration parameters.
    """
    EXECUTION_LOG["tool_calls"].append({"tool": "get_campaign_config", "args": {}})
    try:
        res = requests.get(f"{AD_SERVER_URL}/campaign/config")
        if res.ok:
            return res.text
        return '{"active_bid_cpm": 2.50, "max_bid_ceiling": 10.00, "total_budget": 2500.00}'
    except Exception as e:
        return f'{{"error": "{e}", "max_bid_ceiling": 10.00, "total_budget": 2500.00}}'


def query_telemetry(sql: str) -> str:
    """Executes a SQL query against BigQuery vibetube_telemetry dataset to inspect auction events.

    Args:
        sql: The BigQuery standard SQL query to execute.

    Returns:
        Tabular results of query execution.
    """
    EXECUTION_LOG["sql_queries"].append(sql.strip())
    EXECUTION_LOG["tool_calls"].append(
        {"tool": "query_telemetry", "args": {"sql": sql.strip()}}
    )
    try:
        bq = get_bq_client()
        query_job = bq.query(sql)
        results = query_job.result()
        rows = [dict(row) for row in results]
        return str(rows)
    except Exception as e:
        return f"Error executing query: {e}"


def get_bidding_history() -> str:
    """Queries historical telemetry across dayparts to evaluate clearing prices and win rates.

    Returns:
        Summary table grouped by daypart.
    """
    sql = f"""
    SELECT 
      daypart,
      COUNT(*) AS total_auctions,
      ROUND(AVG(competitor_highest_bid_cpm), 2) AS avg_competitor_bid,
      ROUND(APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)], 2) AS p90_cpm,
      ROUND(AVG(win) * 100, 1) AS win_rate_pct
    FROM `{PROJECT_ID}.vibetube_telemetry.auction_events`
    GROUP BY daypart
    ORDER BY total_auctions DESC;
    """
    return query_telemetry(sql)


def update_bidding_script(python_code: str) -> str:
    """Deploys an updated Python compute_bid script to the production bidding policy file.

    Args:
        python_code: The complete Python script implementing compute_bid(telemetry, campaign).

    Returns:
        Confirmation status message.
    """
    EXECUTION_LOG["generated_script"] = python_code
    EXECUTION_LOG["tool_calls"].append(
        {"tool": "update_bidding_script", "args": {"length": len(python_code)}}
    )
    try:
        with open(SCRIPT_PATH, "w", encoding="utf-8") as f:
            f.write(python_code)

        # Also notify ad server if running
        try:
            requests.post(
                f"{AD_SERVER_URL}/campaign/script",
                json={"script": python_code},
                timeout=2,
            )
        except Exception:
            pass

        return f"Successfully deployed updated bidding policy script ({len(python_code)} bytes)."
    except Exception as e:
        return f"Error writing bidding script: {e}"


def update_bid_cpm(bid_cpm: float) -> str:
    """Updates the active campaign bid CPM on the ad server.

    Args:
        bid_cpm: The new bid price in dollars CPM (e.g. 2.50).

    Returns:
        Server confirmation response status.
    """
    b = float(bid_cpm)
    EXECUTION_LOG["new_bid"] = b
    EXECUTION_LOG["tool_calls"].append(
        {"tool": "update_bid_cpm", "args": {"bid_cpm": b}}
    )
    try:
        res = requests.post(f"{AD_SERVER_URL}/campaign/update", json={"bid_cpm": b})
        if res.ok:
            return f"Successfully updated active bid CPM to ${b:.2f}"
        return f"Failed to update bid: {res.text}"
    except Exception as e:
        return f"Connection error updating bid: {e}"


def run_agent_cycle(as_json: bool = False):
    """Runs a single reasoning and data engineering optimization cycle using Gemini 2.5 Flash."""
    if not as_json:
        print("=" * 60)
        print("🤖 ADK Data Engineer Agent: Optimizing Bidding Policy Script")
        print("=" * 60)

    system_instruction = f"""You are the Vibetube Autonomous AI Data Engineer & Bidding Strategist.
Your mission is to analyze BigQuery flight telemetry across all dayparts (`morning`, `afternoon`, `primetime`, `late_night`)
and author a clean, robust, multi-regime Python `compute_bid(context: dict) -> float` function to deploy into production.

CONTEXT DICTIONARY SPECIFICATION:
`compute_bid(context: dict) -> float` receives:
- `context["daypart"]`: str ("morning" | "afternoon" | "primetime" | "late_night")
- `context["recent_p90_cpm"]`: float (Current rolling 5-minute P90 clearing floor in $)
- `context["p90_history"]`: list[float] (Last 5 P90 values for momentum/trend slope detection)
- `context["recent_win_rate"]`: float (Current rolling win rate from 0.0 to 1.0)
- `context["win_rate_history"]`: list[float] (Last 5 win rate values)
- `context["budget_remaining"]`: float (Dollars left in the campaign)
- `context["hours_remaining"]`: float (Hours remaining in the 24-hour campaign flight)
- `context["max_bid_ceiling"]`: float (Hard guardrail authorized ceiling in $, typically $10.00)

BUSINESS OBJECTIVES & ECONOMIC PRINCIPLES:
1. Multi-Daypart Clearance:
   - `morning`: Lower competition floor (~$2.35 P90). Bid ~$2.40 CPM.
   - `afternoon`: Building traffic (~$3.50 P90). Bid ~$3.55 CPM.
   - `primetime`: Peak competition surge (~$9.60 P90). Bid ~$9.65 CPM (capped at ceiling).
   - `late_night`: Competitor dropout cooldown (~$0.85 P90). Shade bid down to ~$0.90 CPM to prevent 10x overpayment.
2. Momentum & Vector Signals:
   - Use `context["p90_history"]` to detect velocity (`p90_history[-1] - p90_history[0]`).
   - If velocity is strongly positive (> 1.5), market is surging into a bidding war; bid aggressively.
   - If velocity is strongly negative (< -1.5), market is crashing into cooldown; shade bids down immediately.
3. Pacing & Budget Protection:
   - Compute `pacing = (budget_remaining / hours_remaining) / target_hourly_rate` to dynamically scale bid aggression.
4. Authorized Ceiling: Always cap final bid with `min(bid, max_bid_ceiling)`.
5. Code Quality: Author clean, idiomatic, standalone Python for `def compute_bid(context: dict) -> float`.

WORKFLOW:
1. Inspect campaign parameters via `get_campaign_config()`.
2. Query telemetry across dayparts using `get_bidding_history()` and `query_telemetry()`.
3. Synthesize the multi-regime `compute_bid(context: dict)` Python function.
4. Deploy the script using `update_bidding_script(python_code)`.
5. Output a structured rationale explaining the discovered daypart dynamics, pacing strategy, and code changes.
"""

    prompt = (
        f"Project ID: {PROJECT_ID}. Query campaign config and BigQuery auction telemetry "
        "by daypart. Analyze the market clearing prices across morning, afternoon, primetime, "
        "and late night. Author and deploy an optimized, robust Python bidding script to "
        "`bidding_policy.py` using `update_bidding_script` implementing `def compute_bid(context: dict) -> float` "
        "that uses `p90_history` for momentum detection, clears surges during primetime, "
        "and shades bids down during late night to maximize total impressions delivered."
    )

    tools = [
        get_campaign_config,
        query_telemetry,
        get_bidding_history,
        update_bidding_script,
        update_bid_cpm,
    ]

    client = get_genai_client()
    chat = client.chats.create(
        model="gemini-2.5-flash",
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            tools=tools,
            temperature=0.2,
        ),
    )
    response = chat.send_message(prompt)

    EXECUTION_LOG["reasoning"] = response.text or ""

    if as_json:
        print(json.dumps(EXECUTION_LOG))
    else:
        print("\n🧠 Agent Execution Trace:")
        print(response.text)

    return EXECUTION_LOG


if __name__ == "__main__":
    is_json = "--json" in sys.argv
    run_agent_cycle(as_json=is_json)
