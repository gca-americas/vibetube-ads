import os
from pathlib import Path
from google.cloud import bigquery

PROJECT_ID = os.environ.get("PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
DATASET_ID = "ad_telemetry"
TABLE_ID = "auction_events"
SEED_FILE = Path(__file__).resolve().parent.parent / "data" / "telemetry_seed.parquet"

client = bigquery.Client(project=PROJECT_ID)
dataset_ref = client.create_dataset(DATASET_ID, exists_ok=True)
table_ref = dataset_ref.table(TABLE_ID)

job_config = bigquery.LoadJobConfig(
    source_format=bigquery.SourceFormat.PARQUET,
    write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
)

with open(SEED_FILE, "rb") as f:
    load_job = client.load_table_from_file(f, table_ref, job_config=job_config)
load_job.result()

print(f"✅ Loaded {client.get_table(table_ref).num_rows:,} rows into {DATASET_ID}.{TABLE_ID}.")
