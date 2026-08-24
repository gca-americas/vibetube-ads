import sys
import json
import os
from google.cloud import bigquery

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")

def insert_batch(events):
    client = bigquery.Client(project=PROJECT_ID)
    table_id = f"{PROJECT_ID}.vibetube_telemetry.auction_events"
    errors = client.insert_rows_json(table_id, events)
    if errors:
        print(f"Insert errors: {errors}", file=sys.stderr)
        return False
    print(f"Successfully streamed {len(events)} events to BigQuery table {table_id}")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            events = json.load(f)
            insert_batch(events)
