#!/usr/bin/env python3
"""Initializes and pre-populates BigQuery telemetry for Vibetube Ads.

Ensures dataset `vibetube_telemetry` and table `auction_events` exist and are
populated with realistic baseline test flight telemetry matching the exact
daypart clearing prices ($9.60 primetime P90 vs $0.85 late-night floor).
"""

import datetime
import json
import os
import random
import subprocess
import sys
import tempfile
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

DATASET_ID = os.getenv("BQ_DATASET_ID", "vibetube_telemetry")
TABLE_ID = os.getenv("BQ_TABLE_ID", "auction_events")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")


def get_project_id() -> str:
    """Resolves active Google Cloud Project ID."""
    if env_proj := os.getenv("GOOGLE_CLOUD_PROJECT"):
        return env_proj
    try:
        proc = subprocess.run(
            ["gcloud", "config", "get-value", "project"],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except Exception:
        pass
    return "vibeflix-sandbox"


def ensure_dataset(client: bigquery.Client, dataset_ref: bigquery.DatasetReference) -> str:
    """Creates the BigQuery dataset if it does not already exist, returning its location."""
    try:
        ds = client.get_dataset(dataset_ref)
        return ds.location or "US"
    except NotFound:
        loc = os.getenv("BQ_LOCATION", "US")
        dataset = bigquery.Dataset(dataset_ref)
        dataset.location = loc
        client.create_dataset(dataset, exists_ok=True)
        print(f"[BigQuery] Created dataset '{dataset_ref.dataset_id}' in {loc}.")
        return loc


def verify_telemetry(client: bigquery.Client, table_ref: bigquery.TableReference, location: str = "US") -> None:
    """Runs a quick verification query to confirm daypart distributions."""
    try:
        query = f"""
        SELECT 
          daypart,
          COUNT(*) AS event_count,
          ROUND(APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)], 2) AS p90_clearing
        FROM `{table_ref.project}.{table_ref.dataset_id}.{table_ref.table_id}`
        WHERE campaign_id = 'camp-default'
        GROUP BY daypart
        ORDER BY p90_clearing DESC
        """
        query_job = client.query(query, location=location)
        print(f"[BigQuery] Verified active telemetry in '{table_ref.dataset_id}.{table_ref.table_id}':")
        for row in query_job.result():
            print(f"  - {row.daypart:<12}: {row.event_count:>4} events | P90: ${row.p90_clearing:.2f} CPM")
    except Exception as e:
        print(f"[BigQuery] Verification note: {e}")


def ensure_table_and_seed(client: bigquery.Client, table_ref: bigquery.TableReference, location: str = "US", force: bool = False) -> None:
    """Creates the auction_events table and populates baseline telemetry if empty."""
    schema = [
        bigquery.SchemaField(
            "auction_id", "STRING", mode="NULLABLE",
            description="Unique auction event identifier"
        ),
        bigquery.SchemaField(
            "timestamp", "TIMESTAMP", mode="NULLABLE",
            description="Exact time the auction occurred (UTC)"
        ),
        bigquery.SchemaField(
            "daypart", "STRING", mode="NULLABLE",
            description="Market daypart (late_night, morning, lunch, afternoon, primetime)"
        ),
        bigquery.SchemaField(
            "campaign_id", "STRING", mode="NULLABLE",
            description="The campaign identifier (e.g. 'camp-default')"
        ),
        bigquery.SchemaField(
            "bid_cpm", "FLOAT64", mode="NULLABLE",
            description="Our submitted CPM bid price ($)"
        ),
        bigquery.SchemaField(
            "competitor_highest_bid_cpm", "FLOAT64", mode="NULLABLE",
            description="Highest rival bid in the auction ($)"
        ),
        bigquery.SchemaField(
            "win", "INT64", mode="NULLABLE",
            description="1 if the impression was won, 0 if outbid"
        ),
        bigquery.SchemaField(
            "cost", "FLOAT64", mode="NULLABLE",
            description="Deducted spend if won (bid_cpm / 1000)"
        ),
        bigquery.SchemaField(
            "revenue", "FLOAT64", mode="NULLABLE",
            description="Attributed revenue value ($)"
        ),
        bigquery.SchemaField(
            "budget_remaining", "FLOAT64", mode="NULLABLE",
            description="Remaining campaign budget in USD"
        ),
        bigquery.SchemaField(
            "competitor_mode", "STRING", mode="NULLABLE",
            description="Competitor bidding dynamics (standard vs adversarial)"
        ),
    ]

    try:
        table = client.get_table(table_ref)
        # Update schema field descriptions so BigQuery Studio displays documentation
        table.schema = schema
        client.update_table(table, ["schema"])
        if not force:
            query_job = client.query(
                f"SELECT COUNT(1) AS row_count FROM `{table_ref.project}.{table_ref.dataset_id}.{table_ref.table_id}`",
                location=location,
            )
            results = list(query_job.result())
            if results and results[0].row_count > 0:
                print(
                    f"[BigQuery] Table '{table_ref.dataset_id}.{table_ref.table_id}' already contains "
                    f"{results[0].row_count:,} telemetry events with updated schema descriptions."
                )
                verify_telemetry(client, table_ref, location=location)
                return
    except NotFound:
        table = bigquery.Table(table_ref, schema=schema)
        table.time_partitioning = bigquery.TimePartitioning(
            type_=bigquery.TimePartitioningType.DAY,
            field="timestamp",
        )
        table = client.create_table(table, exists_ok=True)
        print(f"[BigQuery] Created partitioned table '{table_ref.dataset_id}.{table_ref.table_id}'.")

    full_scale = "--quick" not in sys.argv and os.getenv("QUICK_SEED") != "1"
    target_count = 600000 if full_scale else 2800
    print(f"[BigQuery] Seeding baseline flight telemetry into 'auction_events' ({target_count:,} target auctions)...")
    
    import json
    import tempfile
    
    # Generate and stream into a temporary NDJSON file for high-speed BigQuery batch loading
    with tempfile.NamedTemporaryFile(mode="w+", suffix=".json", delete=False) as tmp_file:
        tmp_path = tmp_file.name
        count = generate_baseline_telemetry_file(tmp_file, full=full_scale)
        
    try:
        with open(tmp_path, "rb") as source_file:
            job_config = bigquery.LoadJobConfig(
                source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
                schema=schema,
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND if not force else bigquery.WriteDisposition.WRITE_TRUNCATE,
            )
            load_job = client.load_table_from_file(source_file, table_ref, job_config=job_config, location=location)
            print(f"[BigQuery] Submitted batch load job {load_job.job_id} for {count:,} events...")
            load_job.result()  # Wait for completion
            
        print(f"[BigQuery] Successfully loaded {count:,} baseline auction events into BigQuery.")
        verify_telemetry(client, table_ref, location=location)
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def generate_baseline_telemetry_file(file_obj, full: bool = True) -> int:
    """Generates synthetic baseline flight auction events across 24h directly to a file."""
    random.seed(42)  # Deterministic seed for reproducible quantiles
    our_bid = 2.50
    budget_remaining = 2500.00
    base_time = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # 600,000 baseline auctions across 24 hours (25,000 / hour)
    if full:
        dayparts = [
            {"name": "late_night", "start_h": 0, "end_h": 6, "p90": 0.85, "min_comp": 0.20, "max_comp": 1.10, "samples": 150000},
            {"name": "morning",    "start_h": 6, "end_h": 11, "p90": 2.40, "min_comp": 1.10, "max_comp": 2.70, "samples": 125000},
            {"name": "lunch",      "start_h": 11, "end_h": 14, "p90": 4.20, "min_comp": 2.20, "max_comp": 4.60, "samples": 75000},
            {"name": "afternoon",  "start_h": 14, "end_h": 18, "p90": 8.80, "min_comp": 3.00, "max_comp": 9.20, "samples": 100000},
            {"name": "primetime",  "start_h": 18, "end_h": 22, "p90": 9.60, "min_comp": 6.50, "max_comp": 10.20, "samples": 100000},
            {"name": "late_night", "start_h": 22, "end_h": 24, "p90": 0.85, "min_comp": 0.20, "max_comp": 1.10, "samples": 50000},
        ]
    else:
        dayparts = [
            {"name": "late_night", "start_h": 0, "end_h": 6, "p90": 0.85, "min_comp": 0.20, "max_comp": 1.10, "samples": 600},
            {"name": "morning",    "start_h": 6, "end_h": 11, "p90": 2.40, "min_comp": 1.10, "max_comp": 2.70, "samples": 500},
            {"name": "lunch",      "start_h": 11, "end_h": 14, "p90": 4.20, "min_comp": 2.20, "max_comp": 4.60, "samples": 400},
            {"name": "afternoon",  "start_h": 14, "end_h": 18, "p90": 8.80, "min_comp": 3.00, "max_comp": 9.20, "samples": 500},
            {"name": "primetime",  "start_h": 18, "end_h": 22, "p90": 9.60, "min_comp": 6.50, "max_comp": 10.20, "samples": 600},
            {"name": "late_night", "start_h": 22, "end_h": 24, "p90": 0.85, "min_comp": 0.20, "max_comp": 1.10, "samples": 200},
        ]

    total_generated = 0
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
                
            record = {
                "auction_id": f"auc-{event_time.strftime('%Y%m%d%H%M%S')}-{idx:06d}",
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
            }
            file_obj.write(json.dumps(record) + "\n")
            total_generated += 1

    file_obj.flush()
    return total_generated


def main():
    force = "--force" in sys.argv or os.getenv("FORCE_RESEED") == "1"
    try:
        project_id = get_project_id()
        client = bigquery.Client(project=project_id, location=LOCATION)
        dataset_ref = bigquery.DatasetReference(project_id, DATASET_ID)
        table_ref = dataset_ref.table(TABLE_ID)
        
        print(f"[BigQuery] Initializing telemetry platform for project '{project_id}'...")
        loc = ensure_dataset(client, dataset_ref)
        ensure_table_and_seed(client, table_ref, location=loc, force=force)
        print("[BigQuery] Telemetry platform ready.")
    except Exception as e:
        print(f"[BigQuery] Note: BigQuery initialization error: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
