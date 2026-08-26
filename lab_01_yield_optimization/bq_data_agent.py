#!/usr/bin/env python3
"""BigQuery Data Engineering Agent (A2A Specialist).

Specialized subagent that interfaces directly with BigQuery telemetry data.
Translates analytical requests from the Campaign Manager Agent into optimized SQL,
executes queries against partitioned telemetry tables, and returns structured data insights.
"""

import os
import json
from google.cloud import bigquery
from google.genai import types, Client

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
DATASET_ID = "vibetube_telemetry"
TABLE_NAME = "auction_events"

class BigQueryDataEngineeringAgent:
    def __init__(self, project_id: str = PROJECT_ID):
        self.project_id = project_id
        self.bq_client = bigquery.Client(project=project_id)
        self.genai_client = Client(vertexai=True, project=project_id, location="us-central1")
        self.table_ref = f"{self.project_id}.{DATASET_ID}.{TABLE_NAME}"
        self.query_history = []

    def execute_sql(self, sql_query: str) -> str:
        """Executes a GoogleSQL standard query against BigQuery telemetry table.
        
        Args:
            sql_query: The standard SQL query to execute.
            
        Returns:
            JSON string containing query results (rows, count, execution metadata).
        """
        self.query_history.append(sql_query.strip())
        print(f"\n   [BQ Data Agent 🛠️ executing SQL]:\n{sql_query.strip()}\n")
        try:
            query_job = self.bq_client.query(sql_query)
            results = list(query_job.result())
            rows = [dict(row) for row in results]
            
            # Format timestamps/floats for JSON serialization
            serialized = []
            for r in rows:
                row_dict = {}
                for k, v in r.items():
                    if hasattr(v, "isoformat"):
                        row_dict[k] = v.isoformat()
                    elif isinstance(v, float):
                        row_dict[k] = round(v, 4)
                    else:
                        row_dict[k] = v
                serialized.append(row_dict)
                
            return json.dumps({
                "status": "success",
                "total_rows": len(serialized),
                "rows": serialized[:50] # cap preview at 50 rows
            }, indent=2)
        except Exception as e:
            return json.dumps({"status": "error", "message": str(e)})

    def get_table_schema(self) -> str:
        """Returns the schema description of the auction telemetry table."""
        try:
            table = self.bq_client.get_table(self.table_ref)
            schema_info = [{"name": field.name, "type": field.field_type, "mode": field.mode} for field in table.schema]
            return json.dumps({"table": self.table_ref, "schema": schema_info}, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    def handle_a2a_request(self, request_prompt: str) -> str:
        """Processes an incoming A2A data inquiry from another agent (e.g. Campaign Manager)."""
        print(f"\n📥 [A2A Inbound Message to BQ Data Engineer]:\n{request_prompt}")
        
        system_instruction = f"""You are the Vibetube BigQuery Data Engineering Agent.
Your role in this multi-agent system is to answer analytical data requests from the Campaign Manager Agent.
You have direct tool access to BigQuery standard SQL execution against `{self.table_ref}`.

Table Schema:
- auction_id STRING
- timestamp TIMESTAMP (Partitioned)
- daypart STRING ('late_night', 'morning', 'lunch', 'afternoon', 'primetime') (Clustered)
- campaign_id STRING
- bid_cpm FLOAT64
- competitor_highest_bid_cpm FLOAT64
- win INT64 (1 or 0)
- cost FLOAT64
- revenue FLOAT64
- budget_remaining FLOAT64
- competitor_mode STRING ('normal', 'spike', 'dropout')

Guidelines:
1. When asked about market dynamics, quantiles, win rates, or pacing, author and run standard SQL using `execute_sql`.
2. Use `APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)]` to calculate P90 clearing floors.
3. Group by `daypart` and inspect metrics like win rates, average rival bids, and distribution.
4. Provide a clear, structured, numerical summary back to the Campaign Manager Agent with concrete CPM clearing floors and findings.
"""

        tools = [self.execute_sql, self.get_table_schema]
        chat = self.genai_client.chats.create(
            model="gemini-2.5-flash",
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                tools=tools,
                temperature=0.1,
            ),
        )

        response = chat.send_message(request_prompt)
        print(f"\n📤 [A2A Outbound Response from BQ Data Engineer]:\n{response.text}\n")
        return response.text or "No telemetry analysis generated."

if __name__ == "__main__":
    agent = BigQueryDataEngineeringAgent()
    sample_request = (
        "Analyze the 2-year auction telemetry across all dayparts (morning, lunch, afternoon, primetime, late_night). "
        "Provide total auction volume, win rate with $2.50 flat bid, average competitor bid, and P90 clearing price for each daypart."
    )
    res = agent.handle_a2a_request(sample_request)
    print("Agent Result:\n", res)
