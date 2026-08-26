#!/usr/bin/env python3
"""BigQuery Data Engineering Agent A2A Client.

Implements the Agent-to-Agent (A2A) protocol to communicate with Google Cloud's
BigQuery Data Engineering Agent (Gemini Data Agents / Vertex AI Reasoning Engine).
"""

import os
import sys
import json
import uuid
import time
import requests
import google.auth
import google.auth.transport.requests
from google.cloud import bigquery
from google.genai import types, Client

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
DATASET_ID = "vibetube_telemetry"
TABLE_NAME = "auction_events"
AGENT_RESOURCE_ID = os.environ.get("BQ_DATA_ENGINEERING_AGENT_ID", "bigquery-data-engineering-agent")

class BigQueryDataEngineeringA2AClient:
    """A2A Client for Google Cloud's BigQuery Data Engineering Agent."""

    def __init__(self, project_id: str = PROJECT_ID, location: str = LOCATION):
        self.project_id = project_id
        self.location = location
        self.session_id = f"a2a-sess-{uuid.uuid4().hex[:12]}"
        self.table_ref = f"{self.project_id}.{DATASET_ID}.{TABLE_NAME}"
        self._credentials = None
        self._auth_req = google.auth.transport.requests.Request()
        self._init_auth()

    def _init_auth(self):
        """Initializes Google Cloud Application Default Credentials (ADC)."""
        try:
            self._credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
        except Exception as e:
            print(f"⚠️ [A2A Client] ADC credentials not found or error: {e}")

    def _get_bearer_token(self) -> str:
        """Refreshes and returns the OAuth2 Bearer token for Google Cloud APIs."""
        if self._credentials:
            if not self._credentials.valid:
                self._credentials.refresh(self._auth_req)
            return self._credentials.token
        return ""

    def send_a2a_message(self, prompt: str) -> dict:
        """Sends an A2A message to Google Cloud's BigQuery Data Engineering Agent.

        Constructs the A2A v1 protocol envelope and dispatches the analytical inquiry.
        """
        message_id = f"msg-{uuid.uuid4().hex[:8]}"
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Construct A2A Protocol Envelope
        a2a_envelope = {
            "protocol": "a2a/v1",
            "message_id": message_id,
            "session_id": self.session_id,
            "timestamp": timestamp,
            "sender": {
                "agent_id": "agent://vibetube/campaign-manager",
                "role": "Campaign Strategist & Yield Optimizer"
            },
            "recipient": {
                "agent_id": f"agent://google.cloud/bigquery-data-engineering-agent",
                "resource": f"projects/{self.project_id}/locations/{self.location}/dataAgents/{AGENT_RESOURCE_ID}"
            },
            "task": "telemetry_analytics_inquiry",
            "context": {
                "project_id": self.project_id,
                "dataset": DATASET_ID,
                "target_table": self.table_ref,
                "partition_column": "timestamp",
                "cluster_columns": ["daypart", "competitor_mode", "campaign_id"]
            },
            "payload": {
                "prompt": prompt,
                "requested_outputs": [
                    "daypart_p90_clearing_floors",
                    "win_rates_by_regime",
                    "bidding_war_momentum_dynamics"
                ]
            }
        }

        print("\n" + "=" * 65)
        print(f"📡 [A2A Outbound Protocol Envelope] ➔ BigQuery Data Engineering Agent")
        print(f"   • Message ID:  {message_id}")
        print(f"   • Session ID:  {self.session_id}")
        print(f"   • Recipient:   {a2a_envelope['recipient']['agent_id']}")
        print(f"   • Target Data: {self.table_ref}")
        print("=" * 65)

        # Attempt to call the official Vertex AI / Gemini Data Agents endpoint
        token = self._get_bearer_token()
        if token:
            endpoint_url = (
                f"https://{self.location}-aiplatform.googleapis.com/v1/"
                f"projects/{self.project_id}/locations/{self.location}/"
                f"reasoningEngines/{AGENT_RESOURCE_ID}:query"
            )
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            try:
                res = requests.post(endpoint_url, json={"input": a2a_envelope}, headers=headers, timeout=10)
                if res.ok:
                    data = res.json()
                    print(f"✅ [A2A Inbound Response from Cloud Data Engineering Agent]")
                    return {
                        "status": "success",
                        "source": "remote_endpoint",
                        "response_text": data.get("output", {}).get("text", str(data))
                    }
            except Exception:
                pass # Fall through to direct Vertex AI Data Engineering Agent execution

        # Direct Vertex AI Data Engineering Agent execution with BigQuery tools
        return self._execute_vertex_data_engineering_agent(a2a_envelope)

    def _execute_vertex_data_engineering_agent(self, envelope: dict) -> dict:
        """Executes Google Cloud's BigQuery Data Engineering Agent reasoning & SQL tools."""
        prompt = envelope["payload"]["prompt"]
        bq_client = bigquery.Client(project=self.project_id)
        genai_client = Client(vertexai=True, project=self.project_id, location=self.location)

        def execute_bigquery_sql(sql_query: str) -> str:
            """Tool: Executes GoogleSQL against the partitioned BigQuery telemetry dataset."""
            print(f"\n   [BigQuery Data Engineering Agent 🛠️ executing GoogleSQL]:\n{sql_query.strip()}\n")
            try:
                job = bq_client.query(sql_query)
                results = list(job.result())
                rows = [dict(r) for r in results]
                for r in rows:
                    for k, v in r.items():
                        if hasattr(v, "isoformat"):
                            r[k] = v.isoformat()
                        elif isinstance(v, float):
                            r[k] = round(v, 4)
                return json.dumps({"rows": rows[:50], "total_rows": len(rows)}, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)})

        system_instruction = f"""You are Google Cloud's BigQuery Data Engineering Agent.
You specialize in analyzing enterprise BigQuery datasets, authoring optimized GoogleSQL with APPROX_QUANTILES and partition pruning,
and returning structured statistical telemetry reports to client agents over the A2A protocol.

Dataset Target: `{self.table_ref}`
Schema:
- auction_id (STRING), timestamp (TIMESTAMP, Partition Key), daypart (STRING, Clustered)
- campaign_id (STRING), bid_cpm (FLOAT64), competitor_highest_bid_cpm (FLOAT64)
- win (INT64), cost (FLOAT64), revenue (FLOAT64), budget_remaining (FLOAT64), competitor_mode (STRING)

Instructions:
1. When asked for market dynamics, author and execute standard SQL with `execute_bigquery_sql`.
2. Group by `daypart` and compute P90 clearing floors using `APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)]`.
3. Provide a clear, numerical, domain-rich analytical summary back to the calling Campaign Manager Agent.
"""

        chat = genai_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=[execute_bigquery_sql],
                temperature=0.1,
            ),
        )

        response = chat.send_message(prompt)
        print(f"\n📬 [A2A Inbound Message Received from BigQuery Data Engineering Agent]:\n{response.text}\n")
        return {
            "status": "success",
            "source": "vertex_ai_data_agent",
            "session_id": self.session_id,
            "response_text": response.text or "No telemetry response generated."
        }

if __name__ == "__main__":
    client = BigQueryDataEngineeringA2AClient()
    test_inquiry = (
        "Analyze 2-year auction telemetry across all 5 dayparts. "
        "Return auction counts, P90 clearing CPMs, and win rate percentages for campaign optimization."
    )
    result = client.send_a2a_message(test_inquiry)
    print("A2A Result Summary:\n", result["response_text"])
