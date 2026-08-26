#!/usr/bin/env python3
"""Campaign Manager Agent (A2A Coordinator).

Coordinates with the BigQuery Data Engineering Agent over A2A protocol to analyze
historical telemetry from ~730M auctions, synthesize bidding strategy insights,
and generate the production `compute_bid(context: dict) -> float` Python function.
"""

import os
import sys
import json
import re
from google.genai import types, Client
from bq_data_engineering_a2a_client import BigQueryDataEngineeringA2AClient

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
POLICY_OUTPUT_PATH = "/Users/ljhenne/Git/github.com/gca-americas/vibetube-ads/lab_01_yield_optimization/bidding_policy.py"

DOCSTRING_SPEC = '''def compute_bid(context: dict) -> float:
    """Calculates the optimal first-price CPM bid for an upcoming video ad auction tick.

    Parameters in context dictionary:
    --------------------------------
    daypart : str
        Current market time window: "morning" (06:00-11:00), "lunch" (11:00-13:30),
        "afternoon" (13:30-17:00), "primetime" (17:00-22:00), or "late_night" (22:00-06:00).
    budget_remaining : float
        Total campaign budget remaining in USD (e.g., $2500.00 down to $0.00).
    hours_remaining : float
        Hours left in the 24.0-hour flight (e.g., 24.0 down to 0.0).
    max_bid_ceiling : float
        Hard maximum bid ceiling guardrail in USD CPM (e.g., $10.00 CPM).
    win_rate : float
        Recent auction win rate over the trailing window as a ratio (0.0 to 1.0).
    p90 : float
        90th percentile clearing price (USD CPM) across competing auctions. Bidding
        at or slightly above clears >=90% of auction impressions.
    p90_history : list[float]
        Trailing sequence of recent P90 clearing values (e.g., [2.10, 3.40, 5.80, 8.20])
        used to calculate market momentum and price velocity.

    Optional / Enriched telemetry fields:
    -------------------------------------
    win_rate_history : list[float]
        Trailing sequence of recent win rates (e.g., [0.95, 0.92, 0.88, 0.65]).
    active_bid_cpm : float
        The current bid price from the preceding tick before recalculation.

    Returns:
    --------
    float
        The calculated first-price CPM bid in USD (clamped between $0.50 and max_bid_ceiling).
    """
'''

class CampaignManagerAgent:
    def __init__(self, project_id: str = PROJECT_ID):
        self.project_id = project_id
        self.genai_client = Client(vertexai=True, project=project_id, location="us-central1")
        self.a2a_client = BigQueryDataEngineeringA2AClient(project_id=project_id)
        self.a2a_log = []

    def ask_data_engineering_agent(self, analytical_inquiry: str) -> str:
        """A2A Tool: Sends an analytical data query/request to Google Cloud's BigQuery Data Engineering Agent.
        
        Args:
            analytical_inquiry: Clear natural language description of data, quantiles,
                                distributions, or trends needed from BigQuery.
                                
        Returns:
            The Data Engineering Agent's detailed analytical report with concrete numbers over A2A.
        """
        print(f"\n💬 [A2A Protocol Dispatch]: Campaign Manager ➔ BigQuery Data Engineering Agent")
        self.a2a_log.append({"direction": "out", "message": analytical_inquiry})
        
        a2a_result = self.a2a_client.send_a2a_message(analytical_inquiry)
        response_text = a2a_result.get("response_text", "")
        
        print(f"\n💬 [A2A Protocol Delivery]: BigQuery Data Engineering Agent ➔ Campaign Manager")
        self.a2a_log.append({"direction": "in", "message": response_text, "source": a2a_result.get("source")})
        return response_text

    def run_optimization_workflow(self, deploy: bool = True) -> dict:
        """Runs the complete Campaign Manager reasoning, A2A telemetry inquiry, and code synthesis loop."""
        print("=" * 70)
        print("🎯 Campaign Manager Agent: Autonomous Bidding Strategy Synthesis")
        print("=" * 70)

        system_instruction = f"""You are the Vibetube Lead Campaign Manager and Quantitative Bidding Strategist.
Your mission is to maximize impressions delivered for a $2,500 daily flight while respecting safety guardrails ($10.00 ceiling).

You have access to an autonomous BigQuery Data Engineering Agent via the tool `ask_data_engineering_agent`.
You do NOT execute raw SQL yourself. Instead, you send analytical inquiries to your Data Engineering Agent over A2A
to inspect market clearing floors (P90), win rates across dayparts, and momentum dynamics.

REQUIRED FUNCTION SPECIFICATION:
You must synthesize and output a standalone Python function `def compute_bid(context: dict) -> float` that includes the exact docstring below:

```python
{DOCSTRING_SPEC}
```

BUSINESS & ECONOMIC LOGIC TO EMBED:
1. Daypart Clearing Strategies (based on BigQuery telemetry findings):
   - Late Night (dropout): Floor drops to ~$0.85-$0.95. Shade bids down to ~$0.90-$0.95 to avoid wasting budget on 100% win rate overpayment.
   - Morning (normal): Modest floor ~$2.40. Bid ~$2.45 to steadily accumulate volume.
   - Lunch (spike): Midday competition surges to ~$4.20-$4.50. Lift bids to ~$4.25-$4.55.
   - Afternoon (bidding wars & crash): High volatility. Base is ~$2.60, ramping up to ~$9.20 during bidding wars, then crashing to ~$1.80.
   - Primetime (peak): High volume peak clearing floor ~$9.50-$9.80. Bid aggressively near ~$9.65-$9.85 (capped at ceiling).
2. Momentum & Velocity Detection:
   - Use `context.get("p90_history", [])` to calculate slope / velocity: `velocity = p90_history[-1] - p90_history[0]`.
   - If velocity > +1.50, market is in an escalating bidding war; front-run competitors with `bid = p90 + 0.10`.
   - If velocity < -1.50, market experienced a post-war crash; immediately drop bid to avoid overpaying on collapsed inventory.
3. Dynamic Budget Pacing:
   - Calculate hourly burn rate vs remaining hours: `pacing_factor = (budget_remaining / max(hours_remaining, 0.5)) / 104.16` ($2500 / 24h = $104.16/h).
   - If behind pace (pacing_factor > 1.2), scale bid up slightly (+5-10%) to capture more impressions.
   - If ahead of pace / low budget (pacing_factor < 0.8), shade bid downward (-10%) to preserve budget for high-value primetime.
4. Hard Guardrails:
   - Clamp final bid: `return max(0.50, min(calculated_bid, max_bid_ceiling))`.

WORKFLOW:
1. Use `ask_data_engineering_agent` to query 2-year telemetry by daypart (clearing P90, average rival bids, volume, win rates).
2. Review the findings and formulate the mathematical bidding formula with daypart baseline, momentum offset, and pacing multiplier.
3. Generate the complete Python code block implementing `def compute_bid(context: dict) -> float`.
4. Provide a structured summary of your economic reasoning and telemetry insights.
"""

        tools = [self.ask_data_engineering_agent]
        chat = self.genai_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools,
                temperature=0.2,
            ),
        )

        user_prompt = (
            "Initiate campaign optimization. Consult the BigQuery Data Engineering Agent to analyze "
            "the 2-year (~730M row) auction telemetry across all dayparts. Formulate an optimal multi-regime "
            "bidding strategy using dayparts, P90 clearing thresholds, p90_history momentum velocity, "
            "and budget pacing. Output the complete Python code for `def compute_bid(context: dict) -> float`."
        )

        response = chat.send_message(user_prompt)
        reasoning_text = response.text or ""
        print("\n🧠 Campaign Manager Final Strategy & Output:\n", reasoning_text)

        # Extract Python code from response
        extracted_code = self._extract_python_code(reasoning_text)
        if not extracted_code:
            # Fallback extraction of compute_bid definition
            match = re.search(r"(def compute_bid\([\s\S]+)", reasoning_text)
            if match:
                extracted_code = match.group(1)

        # Verify and test the generated function
        test_results = self._test_generated_function(extracted_code)

        # Deploy to bidding_policy.py if requested and tests pass
        if deploy and extracted_code and test_results["success"]:
            with open(POLICY_OUTPUT_PATH, "w", encoding="utf-8") as f:
                f.write(extracted_code)
            print(f"\n🚀 Successfully deployed verified bidding policy to `{POLICY_OUTPUT_PATH}`!")

        return {
            "reasoning": reasoning_text,
            "code": extracted_code,
            "a2a_log": self.a2a_log,
            "test_results": test_results
        }

    def _extract_python_code(self, text: str) -> str:
        """Extracts python code blocks from markdown."""
        blocks = re.findall(r"```python\s*([\s\S]*?)\s*```", text)
        for b in blocks:
            if "def compute_bid" in b:
                return b.strip()
        return ""

    def _test_generated_function(self, code_str: str) -> dict:
        """Runs test fixtures against the synthesized compute_bid function."""
        if not code_str:
            return {"success": False, "error": "No Python code found in agent response."}

        print("\n🔬 Testing synthesized `compute_bid(context)` function against test fixtures...")
        local_scope = {}
        try:
            exec(code_str, local_scope)
            if "compute_bid" not in local_scope:
                return {"success": False, "error": "`compute_bid` function not defined in code."}
            
            compute_bid_fn = local_scope["compute_bid"]
            
            fixtures = [
                {"name": "Morning Normal", "ctx": {"daypart": "morning", "p90": 2.45, "p90_history": [2.30, 2.35, 2.40, 2.45], "budget_remaining": 2200.0, "hours_remaining": 18.0, "max_bid_ceiling": 10.0, "win_rate": 0.85}},
                {"name": "Lunch Spike", "ctx": {"daypart": "lunch", "p90": 4.30, "p90_history": [3.20, 3.60, 4.00, 4.30], "budget_remaining": 1800.0, "hours_remaining": 12.0, "max_bid_ceiling": 10.0, "win_rate": 0.50}},
                {"name": "Afternoon Bidding War Ramp", "ctx": {"daypart": "afternoon", "p90": 8.50, "p90_history": [4.00, 5.50, 7.00, 8.50], "budget_remaining": 1200.0, "hours_remaining": 8.0, "max_bid_ceiling": 10.0, "win_rate": 0.20}},
                {"name": "Afternoon Post-War Crash", "ctx": {"daypart": "afternoon", "p90": 1.80, "p90_history": [8.50, 6.00, 3.50, 1.80], "budget_remaining": 1000.0, "hours_remaining": 7.0, "max_bid_ceiling": 10.0, "win_rate": 0.90}},
                {"name": "Primetime Peak Surge", "ctx": {"daypart": "primetime", "p90": 9.60, "p90_history": [8.80, 9.20, 9.50, 9.60], "budget_remaining": 700.0, "hours_remaining": 4.0, "max_bid_ceiling": 10.0, "win_rate": 0.35}},
                {"name": "Late Night Dropout", "ctx": {"daypart": "late_night", "p90": 0.90, "p90_history": [3.50, 1.80, 1.10, 0.90], "budget_remaining": 200.0, "hours_remaining": 2.0, "max_bid_ceiling": 10.0, "win_rate": 0.98}},
            ]

            results = []
            for f in fixtures:
                bid = compute_bid_fn(f["ctx"])
                assert isinstance(bid, (int, float)), f"Expected numeric return value, got {type(bid)}"
                assert 0.50 <= bid <= f["ctx"]["max_bid_ceiling"], f"Bid ${bid:.2f} out of bounds ($0.50 - ${f['ctx']['max_bid_ceiling']:.2f})"
                print(f"   ✓ [{f['name']}]: Computed Bid = ${bid:.2f} CPM")
                results.append({"fixture": f["name"], "bid": round(float(bid), 2)})

            print("✅ All test fixtures passed!")
            return {"success": True, "fixture_results": results}
        except Exception as e:
            print(f"❌ Test verification failed: {e}")
            return {"success": False, "error": str(e)}

if __name__ == "__main__":
    agent = CampaignManagerAgent()
    result = agent.run_optimization_workflow(deploy=True)
