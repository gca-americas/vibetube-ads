#!/usr/bin/env python3
"""Initializes and pre-populates BigQuery telemetry for Vibetube Ads.

Ensures dataset `vibetube_telemetry` and table `auction_events` exist and are
populated with realistic baseline test flight telemetry matching the exact
diurnal clearing prices ($9.60 primetime P90 vs $0.85 late-night floor).
"""

import datetime
import os
import random
import sys
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

DATASET_ID = os.getenv("BQ_DATASET_ID", "vibetube_telemetry")
TABLE_ID = os.getenv("BQ_TABLE_ID", "auction_events")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")


def get_project_id(client: bigquery.Client) -> str:
    """Resolves active Google Cloud Project ID."""
    return (
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or client.project
        or "vibeflix-sandbox"
    )


def ensure_dataset(client: bigquery.Client, dataset_ref: bigquery.DatasetReference) -> None:
    """Creates the BigQuery dataset if it does not already exist."""
    try:
        client.get_dataset(dataset_ref)
    except NotFound:
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = LOCATION
        client.create_dataset(dataset, exists_ok=True)
        print(f"[BigQuery] Created dataset '{dataset_ref.dataset_id}' in {LOCATION}.")


def ensure_table_and_seed(client: bigquery.Client, table_ref: bigquery.TableReference) -> None:
    """Creates the auction_events table and populates baseline telemetry if empty."""
    schema = [
        bigquery.SchemaField("timestamp", "TIMESTAMP", mode="REQUIRED"),
        bigquery.SchemaField("daypart", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("campaign_id", "STRING", mode="REQUIRED"),
        bigquery.SchemaField("bid_cpm", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("competitor_highest_bid_cpm", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("win", "INT64", mode="REQUIRED"),
        bigquery.SchemaField("cost", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("revenue", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("budget_remaining", "FLOAT64", mode="REQUIRED"),
        bigquery.SchemaField("competitor_mode", "STRING", mode="NULLABLE"),
    ]

    try:
        table = client.get_table(table_ref)
        # Check if table already has rows
        query_job = client.query(f"SELECT COUNT(1) AS row_count FROM `{table_ref.project}.{table_ref.dataset_id}.{table_ref.table_id}`")
        results = list(query_job.result())
        if results and results[0].row_count > 0:
            print(f"[BigQuery] Table '{table_ref.dataset_id}.{table_ref.table_id}' already exists and contains {results[0].row_count:,} telemetry events. Skipping seeding.")
            return
    except NotFound:
        table = bigquery.Table(table_ref, schema=schema)
        # Partition by day on timestamp for optimal query performance
        table.time_partitioning = bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY,
            field="timestamp",
        )
        table = client.create_table(table, exists_ok=True)
        print(f"[BigQuery] Created table '{table_ref.dataset_id}.{table_ref.table_id}'.")

    print("[BigQuery] Seeding baseline flight telemetry into 'auction_events'...")
    rows = generate_baseline_telemetry()
    
    # Insert in batches
    batch_size = 500
    errors = []
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        err = client.insert_rows_json(table_ref, batch)
        if err:
            errors.extend(err)
            
    if errors:
        print(f"[BigQuery] Warning: encountered insert errors: {errors[:3]}", file=sys.stderr)
    else:
        print(f"[BigQuery] Successfully seeded {len(rows):,} baseline auction events.")


def generate_baseline_telemetry() -> list[dict]:
    """Generates synthetic baseline flight auction events across 24h."""
    rows = []
    random.seed(42)  # Deterministic seed for reproducible quantiles
    
    # Baseline configuration: flat $2.50 CPM bid, $2500 total budget
    our_bid = 2.50
    budget_remaining = 2500.00
    base_time = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    dayparts = [
        {"name": "late_night", "start_h": 0, "end_h": 6, "p90": 0.85, "min_comp": 0.20, "max_comp": 1.10, "samples": 600},
        {"name": "morning",    "start_h": 6, "end_h": 11, "p90": 2.40, "min_comp": 1.10, "max_comp": 2.70, "samples": 500},
        {"name": "lunch",      "start_h": 11, "end_h": 14, "p90": 4.20, "min_comp": 2.20, "max_comp": 4.60, "samples": 400},
        {"name": "afternoon",  "start_h": 14, "end_h": 18, "p90": 8.80, "min_comp": 3.00, "max_comp": 9.20, "samples": 500},
        {"name": "primetime",  "start_h": 18, "end_h": 22, "p90": 9.60, "min_comp": 6.50, "max_comp": 10.20, "samples": 600},
        {"name": "late_night", "start_h": 22, "end_h": 24, "p90": 0.85, "min_comp": 0.20, "max_comp": 1.10, "samples": 200},
    ]

    for regime in dayparts:
        duration_minutes = (regime["end_h"] - regime["start_h"]) * 60
        samples = regime["samples"]
        
        for idx in range(samples):
            minute_offset = int((idx / max(samples - 1, 1)) * duration_minutes)
            event_time = base_time + datetime.timedelta(hours=regime["start_h"], minutes=minute_offset, seconds=random.randint(0, 59))
            
            if random.random() < 0.90:
                comp_bid = random.uniform(regime["min_comp"], regime["p90"])
            else:
                comp_bid = random.uniform(regime["p90"], regime["max_comp"])
                
            comp_bid = round(comp_bid, 2)
            
            win = 1 if our_bid >= comp_bid and budget_remaining >= (our_bid / 1000.0) else 0
            cost = round(our_bid / 1000.0, 5) if win else 0.0
            revenue = round(cost * 1.35, 5) if win else 0.0
            
            if win:
                budget_remaining = max(0.0, budget_remaining - cost)
                
            rows.append({
                "timestamp": event_time.isoformat(),
                "daypart": regime["name"],
                "campaign_id": "camp-default",
                "bid_cpm": our_bid,
                "competitor_highest_bid_cpm": comp_bid,
                "win": win,
                "cost": cost,
                "revenue": revenue,
                "budget_remaining": round(budget_remaining, 2),
                "competitor_mode": "adversarial" if regime["name"] in ["afternoon", "primetime"] else "standard",
            })

    return rows


def main():
    try:
        client = bigquery.Client()
        project_id = get_project_id(client)
        dataset_ref = bigquery.DatasetReference(project_id, DATASET_ID)
        table_ref = dataset_ref.table(TABLE_ID)
        
        print(f"[BigQuery] Initializing telemetry platform for project '{project_id}'...")
        ensure_dataset(client, dataset_ref)
        ensure_table_and_seed(client, table_ref)
        print("[BigQuery] Telemetry platform ready.")
    except Exception as e:
        print(f"[BigQuery] Note: BigQuery initialization skipped ({e}). Telemetry can also be loaded via BigQuery Studio.", file=sys.stderr)


if __name__ == "__main__":
    main()
