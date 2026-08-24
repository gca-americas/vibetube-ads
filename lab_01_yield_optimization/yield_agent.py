import os
import time
import requests
from google.cloud import bigquery
from google.genai import types
from google.genai import Client

# Configuration
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
AD_SERVER_URL = os.environ.get("AD_SERVER_URL", "http://localhost:8080")

import json
import sys

EXECUTION_LOG = {
    "sql_queries": [],
    "tool_calls": [],
    "reasoning": "",
    "new_bid": None,
    "status": "success"
}

def get_bq_client():
    return bigquery.Client(project=PROJECT_ID)

def get_genai_client():
    return Client(vertexai=True, project=PROJECT_ID, location="us-central1")

def get_campaign_config() -> str:
    """Fetches the active campaign configuration from the ad server, including max_bid_ceiling and total_budget.
    
    Returns:
        A formatted JSON string of the active campaign parameters.
    """
    EXECUTION_LOG["tool_calls"].append({"tool": "get_campaign_config", "args": {}})
    try:
        res = requests.get(f"{AD_SERVER_URL}/campaign/config")
        if res.ok:
            return res.text
        return '{"active_bid_cpm": 2.50, "max_bid_ceiling": 10.00}'
    except Exception as e:
        return f'{{"error": "{e}", "max_bid_ceiling": 10.00}}'

def query_telemetry(sql: str) -> str:
    """Executes a SQL query against BigQuery vibetube_telemetry dataset to inspect auction events and win rates.
    
    Args:
        sql: The BigQuery standard SQL query to execute.
        
    Returns:
        A formatted tabular string of query results.
    """
    EXECUTION_LOG["sql_queries"].append(sql.strip())
    EXECUTION_LOG["tool_calls"].append({"tool": "query_telemetry", "args": {"sql": sql.strip()}})
    try:
        bq = get_bq_client()
        query_job = bq.query(sql)
        results = query_job.result()
        rows = [dict(row) for row in results]
        return str(rows)
    except Exception as e:
        return f"Error executing query: {e}"

def get_bidding_history() -> str:
    """Queries historical 5-minute time windows over the last 20 minutes to audit past bidding decisions against competitor prices.
    
    Returns:
        A time-series summary of average our bids, competitor average bids, win rates, and total spend.
    """
    sql = f"""
    SELECT 
      TIMESTAMP_TRUNC(timestamp, MINUTE) AS time_window,
      ROUND(AVG(bid_cpm), 2) AS our_avg_bid,
      ROUND(AVG(competitor_highest_bid_cpm), 2) AS competitor_avg_bid,
      ROUND(AVG(win) * 100, 1) AS win_rate_pct,
      ROUND(SUM(cost), 4) AS spend
    FROM `{PROJECT_ID}.vibetube_telemetry.auction_events`
    WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE)
    GROUP BY time_window
    ORDER BY time_window DESC
    LIMIT 5;
    """
    return query_telemetry(sql)

def update_bid_cpm(bid_cpm: float) -> str:
    """Updates the active campaign bid CPM on the ad server.
    
    Args:
        bid_cpm: The new bid price in dollars CPM (e.g. 2.50).
        
    Returns:
        Server confirmation response status.
    """
    b = float(bid_cpm)
    EXECUTION_LOG["new_bid"] = b
    EXECUTION_LOG["tool_calls"].append({"tool": "update_bid_cpm", "args": {"bid_cpm": b}})
    try:
        res = requests.post(f"{AD_SERVER_URL}/campaign/update", json={"bid_cpm": b})
        if res.ok:
            return f"Successfully updated active bid CPM to ${b:.2f}"
        return f"Failed to update bid: {res.text}"
    except Exception as e:
        return f"Connection error updating bid: {e}"

def run_agent_cycle(as_json: bool = False):
    """Runs a single reasoning and optimization cycle using Gemini 2.5 Flash."""
    if not as_json:
        print("=" * 60)
        print("🤖 ADK Yield Agent: Initiating Telemetry Audit & Optimization Cycle")
        print("=" * 60)
    
    system_instruction = f"""You are the Vibetube Autonomous Yield Optimization Agent.
Your objective is to maximize ad impression win rate and click revenue while
protecting the campaign budget from overpaying in first-price auctions.

CRITICAL AUCTION DYNAMICS & CONSTRAINTS:
1. Authorized Ceiling: Check `get_campaign_config` and never submit a bid
   exceeding `max_bid_ceiling`.
2. First-Price Dynamics: In a first-price auction, winners pay EXACTLY what they bid.
3. Market Surges: If competitors surge, raise bid to meet or clear min-to-win
   price without exceeding `max_bid_ceiling`.
4. Competitor Pullbacks: Continuing to bid peak rates overpays in a first-price
   auction. Use `get_bidding_history` to detect whether competitor prices have
   dropped, and immediately shade active bid down to the new clearance floor
   (~min_to_win + $0.05).

WORKFLOW:
1. Call `get_campaign_config` to verify parameters and authorized `max_bid_ceiling`.
2. Query 5-minute auction events using `query_telemetry` to inspect `min_to_win_cpm` and win rates.
3. Call `get_bidding_history` to inspect the rolling decision trail.
4. If underbidding during a surge, call `update_bid_cpm` to raise bid (capped by `max_bid_ceiling`).
5. If competitor prices cooled down and win rate is high (>85%), shade bid down to (~min_to_win + $0.05).
6. Provide a thorough, professional economic rationale explaining:
   - Specific telemetry observations (e.g. competitor P90 / min_to_win price, win rate).
   - Market risks analyzed (e.g. first-price overpayment penalty vs underbidding traffic loss).
   - Exact mathematical justification for the chosen bid price.
"""

    prompt = (
        f"Project ID: {PROJECT_ID}. Query campaign config, recent BigQuery auction "
        "telemetry, and historical bidding trends. Adjust the active campaign "
        "bid CPM if necessary to maximize yield and win rate without overpaying in first-price auctions. "
        "Provide a detailed, step-by-step economic rationale for your decision."
    )

    tools = [get_campaign_config, query_telemetry, get_bidding_history, update_bid_cpm]

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
