#!/usr/bin/env python3
"""Synthetic 730M Record (2-Year) BigQuery Auction Telemetry Generator.

Generates realistic, diurnal video ad auction telemetry into BigQuery:
- 730 days (2 full years of telemetry)
- ~1,000,000 auctions per day (~730,000,000 records total)
- Partitioned by DATE(timestamp) and clustered by daypart, competitor_mode, campaign_id.
- Captures 5 dayparts: late_night ($0.85-$0.95), morning ($1.40-$2.40), lunch ($3.80-$4.20),
  afternoon ($2.60-$9.20 bidding war & crash), and primetime ($9.40-$9.60).
"""

import os
import sys
import time
import argparse
from google.cloud import bigquery

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
DATASET_ID = "vibetube_telemetry"
TABLE_NAME = "auction_events"

def get_bq_client():
    return bigquery.Client(project=PROJECT_ID)

def create_table_if_not_exists(client: bigquery.Client, table_ref: str, drop_existing: bool = False):
    """Creates the partitioned and clustered BigQuery telemetry table."""
    if drop_existing:
        print(f"⚠️ Dropping existing table `{table_ref}`...")
        client.query(f"DROP TABLE IF EXISTS `{table_ref}`").result()

    ddl = f"""
    CREATE TABLE IF NOT EXISTS `{table_ref}` (
      auction_id STRING OPTIONS(description="Unique auction identifier"),
      timestamp TIMESTAMP OPTIONS(description="Auction event timestamp (UTC)"),
      daypart STRING OPTIONS(description="Diurnal market daypart: late_night, morning, lunch, afternoon, primetime"),
      campaign_id STRING OPTIONS(description="Campaign identifier"),
      bid_cpm FLOAT64 OPTIONS(description="Our campaign bid in USD CPM"),
      competitor_highest_bid_cpm FLOAT64 OPTIONS(description="Highest competing rival bid in USD CPM"),
      win INT64 OPTIONS(description="1 if our bid won the auction, 0 otherwise"),
      cost FLOAT64 OPTIONS(description="Actual cost charged for impression in USD"),
      revenue FLOAT64 OPTIONS(description="Estimated value / revenue generated"),
      budget_remaining FLOAT64 OPTIONS(description="Campaign budget remaining after auction"),
      competitor_mode STRING OPTIONS(description="Market regime: normal, spike, dropout")
    )
    PARTITION BY DATE(timestamp)
    CLUSTER BY daypart, competitor_mode, campaign_id
    OPTIONS(
      description="2-Year historical video ad auction telemetry dataset (~730M records)"
    );
    """
    print(f"🔨 Ensuring table `{table_ref}` exists with partitioning and clustering...")
    client.query(ddl).result()
    print(f"✅ Table structure verified.")

def generate_batch_sql(table_ref: str, start_day: int, num_days: int, rows_per_day: int) -> str:
    """Generates serverless SQL to synthesize realistic auction telemetry directly inside BigQuery."""
    return f"""
    INSERT INTO `{table_ref}` (
      auction_id, timestamp, daypart, campaign_id,
      bid_cpm, competitor_highest_bid_cpm, win, cost,
      revenue, budget_remaining, competitor_mode
    )
    WITH date_offsets AS (
      SELECT day_offset
      FROM UNNEST(GENERATE_ARRAY({start_day}, {start_day + num_days - 1})) AS day_offset
    ),
    auctions AS (
      SELECT
        d.day_offset,
        idx,
        -- Generate random timestamp within that specific day
        TIMESTAMP_ADD(
          TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL (730 - d.day_offset) DAY),
          INTERVAL CAST(FLOOR(RAND() * 86400) AS INT64) SECOND
        ) AS event_time,
        RAND() AS r_cat,
        RAND() AS r_price,
        RAND() AS r_bid
      FROM date_offsets d
      CROSS JOIN UNNEST(GENERATE_ARRAY(1, {rows_per_day})) AS idx
    ),
    enriched AS (
      SELECT
        CONCAT("auc_", SUBSTR(GENERATE_UUID(), 1, 12)) AS auction_id,
        event_time AS timestamp,
        -- Determine daypart and market regime based on hour of day
        EXTRACT(HOUR FROM event_time) + EXTRACT(MINUTE FROM event_time)/60.0 AS hour_dec,
        CASE
          WHEN r_cat < 0.35 THEN "camp-neon-runner"
          WHEN r_cat < 0.70 THEN "camp-rival-pulse"
          ELSE "camp-generic-stream"
        END AS campaign_id,
        r_price,
        r_bid
      FROM auctions
    ),
    modeled AS (
      SELECT
        auction_id,
        timestamp,
        CASE
          WHEN hour_dec < 6.0 THEN "late_night"
          WHEN hour_dec < 11.0 THEN "morning"
          WHEN hour_dec < 13.5 THEN "lunch"
          WHEN hour_dec < 17.0 THEN "afternoon"
          WHEN hour_dec < 22.0 THEN "primetime"
          ELSE "late_night"
        END AS daypart,
        campaign_id,
        -- Market clearing pricing model (P90 dynamics)
        CASE
          -- Late night: $0.85 - $0.95
          WHEN hour_dec < 6.0 OR hour_dec >= 22.0 THEN
            ROUND(0.75 + (0.15 * r_price) + (0.10 * SIN(hour_dec)), 2)
          -- Morning: $1.40 - $2.40
          WHEN hour_dec < 11.0 THEN
            ROUND(1.30 + ((hour_dec - 6.0) * 0.22) + (0.35 * r_price), 2)
          -- Lunch peak: $3.80 - $4.20
          WHEN hour_dec < 13.5 THEN
            ROUND(3.60 + (0.50 * SIN((hour_dec - 11.0) * 1.25)) + (0.55 * r_price), 2)
          -- Afternoon baseline / bidding war / crash: $1.80 - $9.20
          WHEN hour_dec < 17.0 THEN
            IF(r_price < 0.20,
               ROUND(1.60 + 0.30 * r_price, 2), -- Flash post-war crash
               ROUND(2.40 + (1.80 * (hour_dec - 13.5)) + (1.20 * r_price), 2)) -- War ramp
          -- Primetime surge: $9.40 - $9.80
          ELSE
            ROUND(9.20 + (0.35 * SIN(hour_dec)) + (0.45 * r_price), 2)
        END AS competitor_highest_bid_cpm,
        -- Our campaign bid model
        ROUND(IF(r_bid < 0.60, 2.50, 2.50 + 1.50 * r_bid), 2) AS bid_cpm,
        CASE
          WHEN hour_dec < 6.0 OR hour_dec >= 22.0 THEN "dropout"
          WHEN (hour_dec >= 11.0 AND hour_dec < 13.5) OR (hour_dec >= 17.0 AND hour_dec < 22.0) THEN "spike"
          ELSE "normal"
        END AS competitor_mode
      FROM enriched
    )
    SELECT
      auction_id,
      timestamp,
      daypart,
      campaign_id,
      bid_cpm,
      competitor_highest_bid_cpm,
      IF(bid_cpm >= competitor_highest_bid_cpm, 1, 0) AS win,
      IF(bid_cpm >= competitor_highest_bid_cpm, ROUND(bid_cpm / 1000.0, 5), 0.0) AS cost,
      IF(bid_cpm >= competitor_highest_bid_cpm, ROUND(bid_cpm * 1.4 / 1000.0, 5), 0.0) AS revenue,
      2500.00 AS budget_remaining,
      competitor_mode
    FROM modeled;
    """

def run_generation(target_days: int = 730, rows_per_day: int = 1000000, batch_days: int = 5, drop_table: bool = False):
    """Executes the BigQuery generation process in parallel serverless query batches."""
    client = get_bq_client()
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_NAME}"
    create_table_if_not_exists(client, table_ref, drop_existing=drop_table)

    total_target = target_days * rows_per_day
    print(f"\n🚀 Starting synthetic telemetry generation:")
    print(f"   • Project:     {PROJECT_ID}")
    print(f"   • Target Table: {table_ref}")
    print(f"   • Total Days:   {target_days} days (2 full years)")
    print(f"   • Rows / Day:   {rows_per_day:,}")
    print(f"   • Total Volume: {total_target:,} records")
    print(f"   • Batch Size:   {batch_days} days ({batch_days * rows_per_day:,} rows / batch)\n")

    start_time = time.time()
    current_day = 1
    batch_num = 1
    total_batches = (target_days + batch_days - 1) // batch_days

    while current_day <= target_days:
        days_in_batch = min(batch_days, target_days - current_day + 1)
        batch_rows = days_in_batch * rows_per_day
        print(f"⏳ Executing Batch {batch_num}/{total_batches}: Days {current_day}..{current_day + days_in_batch - 1} ({batch_rows:,} rows)...", end="", flush=True)

        batch_sql = generate_batch_sql(table_ref, current_day, days_in_batch, rows_per_day)
        b_start = time.time()
        job = client.query(batch_sql)
        job.result() # Wait for job completion
        b_elapsed = time.time() - b_start

        print(f" ✅ Done ({b_elapsed:.1f}s)")
        current_day += days_in_batch
        batch_num += 1

    total_elapsed = time.time() - start_time
    print(f"\n🎉 Generation Complete in {total_elapsed:.1f}s!")
    
    # Final count verification
    verify_sql = f"SELECT COUNT(1) AS total_rows, MIN(timestamp) as min_ts, MAX(timestamp) as max_ts FROM `{table_ref}`"
    res = list(client.query(verify_sql).result())[0]
    print(f"📊 Verification Summary:")
    print(f"   • Total Rows: {res.total_rows:,}")
    print(f"   • Date Range: {res.min_ts} ➔ {res.max_ts}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate 730M BigQuery auction telemetry records.")
    parser.add_argument("--days", type=int, default=730, help="Number of days to generate (default: 730)")
    parser.add_argument("--rows-per-day", type=int, default=1000000, help="Auctions per day (default: 1,000,000)")
    parser.add_argument("--batch-days", type=int, default=10, help="Days per BigQuery query batch (default: 10)")
    parser.add_argument("--drop", action="store_true", help="Drop existing table before generating")
    parser.add_argument("--quick-test", action="store_true", help="Generate a quick 100k test sample (1 day, 100k rows)")
    
    args = parser.parse_args()
    if args.quick_test:
        run_generation(target_days=2, rows_per_day=100000, batch_days=2, drop_table=args.drop)
    else:
        run_generation(target_days=args.days, rows_per_day=args.rows_per_day, batch_days=args.batch_days, drop_table=args.drop)
