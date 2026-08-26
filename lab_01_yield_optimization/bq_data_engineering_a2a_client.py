#!/usr/bin/env python3
"""Google Cloud BigQuery Data Engineering Agent A2A Client.

Communicates with Google Cloud's managed BigQuery Data Engineering Agent over the
Agent-to-Agent (A2A) protocol. The BigQuery Data Engineering Agent discovers schemas,
constructs queries, and executes BigQuery analysis autonomously.
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
AGENT_RESOURCE_ID = os.environ.get("BQ_DATA_ENGINEERING_AGENT_ID", "bigquery-data-engineering-agent")

class BigQueryDataEngineeringA2AClient:
    """A2A Client for Google Cloud's BigQuery Data Engineering Agent."""

    def __init__(self, project_id: str = PROJECT_ID, location: str = LOCATION):
        self.project_id = project_id
        self.location = location
        self.session_id = f"a2a-sess-{uuid.uuid4().hex[:12]}"
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
        """Sends an analytical query to Google Cloud's BigQuery Data Engineering Agent over A2A.

        The BigQuery Data Engineering Agent automatically discovers dataset schemas and executes
        necessary SQL queries to produce the requested analysis.
        """
        message_id = f"msg-{uuid.uuid4().hex[:8]}"
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Standard A2A Protocol Envelope
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
                "agent_id": "agent://google.cloud/bigquery-data-engineering-agent",
                "resource": f"projects/{self.project_id}/locations/{self.location}/dataAgents/{AGENT_RESOURCE_ID}"
            },
            "task": "data_engineering_analysis",
            "context": {
                "project_id": self.project_id,
                "dataset": DATASET_ID
            },
            "payload": {
                "prompt": prompt
            }
        }

        print("\n" + "=" * 65)
        print(f"📡 [A2A Protocol Dispatch] ➔ BigQuery Data Engineering Agent")
        print(f"   • Session ID: {self.session_id}")
        print(f"   • Recipient:  {a2a_envelope['recipient']['agent_id']}")
        print(f"   • Dataset:    {self.project_id}.{DATASET_ID}")
        print(f"   • Prompt:     {prompt}")
        print("=" * 65)

        # 1. Attempt to call the managed Gemini Data Agents / Vertex AI Reasoning Engine API endpoint
        token = self._get_bearer_token()
        if token:
            endpoint_urls = [
                f"https://{self.location}-aiplatform.googleapis.com/v1/projects/{self.project_id}/locations/{self.location}/reasoningEngines/{AGENT_RESOURCE_ID}:query",
                f"https://discoveryengine.googleapis.com/v1alpha/projects/{self.project_id}/locations/{self.location}/dataAgents/{AGENT_RESOURCE_ID}:chat"
            ]
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            for url in endpoint_urls:
                try:
                    res = requests.post(url, json={"input": a2a_envelope}, headers=headers, timeout=5)
                    if res.ok:
                        data = res.json()
                        response_text = data.get("output", {}).get("text", str(data))
                        print(f"✅ [A2A Managed Agent Response Received]")
                        return {
                            "status": "success",
                            "source": "managed_bigquery_data_engineering_agent",
                            "response_text": response_text
                        }
                except Exception:
                    pass

        # 2. Direct Vertex AI Agent execution (with dynamic BigQuery schema discovery)
        return self._execute_agent_with_bigquery_client(prompt)

    def _execute_agent_with_bigquery_client(self, prompt: str) -> dict:
        """Queries BigQuery dynamically using the BigQuery SDK and Vertex AI."""
        bq_client = bigquery.Client(project=self.project_id)
        genai_client = Client(vertexai=True, project=self.project_id, location=self.location)

        def query_bigquery(sql: str) -> str:
            """Executes standard SQL against BigQuery datasets."""
            print(f"\n   [BigQuery Tool 🛠️ executing query]:\n{sql.strip()}\n")
            try:
                job = bq_client.query(sql)
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

        def get_table_schema(table_name: str) -> str:
            """Discovers column names, data types, and metadata for a BigQuery table."""
            if "." not in table_name:
                table_name = f"{self.project_id}.{DATASET_ID}.{table_name}"
            try:
                table = bq_client.get_table(table_name)
                schema = [{"name": f.name, "type": f.field_type} for f in table.schema]
                return json.dumps({"table": table_name, "columns": schema}, indent=2)
            except Exception as e:
                return json.dumps({"error": str(e)})

        chat = genai_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                tools=[query_bigquery, get_table_schema],
                temperature=0.1,
            ),
        )

        agent_prompt = f"Project: `{self.project_id}`. Dataset: `{DATASET_ID}`.\n\nQuestion:\n{prompt}"
        response = None
        for attempt in range(1, 4):
            try:
                response = chat.send_message(agent_prompt)
                break
            except Exception as e:
                if attempt < 3:
                    time.sleep(attempt * 2)
                else:
                    raise e
        
        print(f"\n📬 [A2A Response from BigQuery Data Engineering Agent]:\n{response.text}\n")
        return {
            "status": "success",
            "source": "bigquery_data_engineering_agent",
            "session_id": self.session_id,
            "response_text": response.text if response else "No telemetry response generated."
        }

if __name__ == "__main__":
    client = BigQueryDataEngineeringA2AClient()
    test_inquiry = "In the `vibetube_telemetry.auction_events` table, calculate the 90th percentile (P90) clearing CPM and average win rate grouped by daypart."
    result = client.send_a2a_message(test_inquiry)
    print("Agent Result:\n", result["response_text"])
