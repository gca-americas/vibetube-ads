import os
import sys
import time
from pathlib import Path
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

PROJECT_ID = (
    os.environ.get("GCP_PROJECT_ID")
    or os.environ.get("GOOGLE_CLOUD_PROJECT")
    or os.environ.get("PROJECT_ID")
    or "vibeflix-sandbox"
)
DATASET_ID = os.environ.get("BQ_DATASET_ID", "vibetube_telemetry")
TABLE_ID = os.environ.get("BQ_TABLE_ID", "auction_events")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "US")

# Scale factor: 1 = ~387k rows, 5 = ~1.94M rows (default), 10 = ~3.87M rows across 2 years
DEFAULT_SCALE = 5
if "--quick" in sys.argv:
    DEFAULT_SCALE = 1
SCALE = int(os.environ.get("BQ_SEED_SCALE", DEFAULT_SCALE))

SCHEMA = [
    bigquery.SchemaField("auction_id", "STRING", mode="NULLABLE", description="Unique auction event identifier"),
    bigquery.SchemaField("timestamp", "TIMESTAMP", mode="NULLABLE", description="UTC timestamp of the ad auction"),
    bigquery.SchemaField("daypart", "STRING", mode="NULLABLE", description="Market daypart (late_night, morning, lunch, afternoon, primetime)"),
    bigquery.SchemaField("campaign_id", "STRING", mode="NULLABLE", description="Campaign identifier (camp-default)"),
    bigquery.SchemaField("bid_cpm", "FLOAT64", mode="NULLABLE", description="Our submitted first-price bid CPM in USD"),
    bigquery.SchemaField("competitor_highest_bid_cpm", "FLOAT64", mode="NULLABLE", description="Highest competitor clearing bid in the auction"),
    bigquery.SchemaField("win", "INT64", mode="NULLABLE", description="1 if impression was won, 0 if outbid"),
    bigquery.SchemaField("cost", "FLOAT64", mode="NULLABLE", description="Incurred impression cost (bid_cpm / 1000.0) if won"),
    bigquery.SchemaField("revenue", "FLOAT64", mode="NULLABLE", description="Attributed ad conversion revenue"),
    bigquery.SchemaField("budget_remaining", "FLOAT64", mode="NULLABLE", description="Remaining daily campaign budget balance in USD"),
    bigquery.SchemaField("competitor_mode", "STRING", mode="NULLABLE", description="Market regime dynamics (standard vs adversarial)"),
]


def generate_sql(project_id: str, dataset_id: str, table_id: str) -> str:
    """Builds the server-side BigQuery SQL to generate 1 year (365 days) of auction telemetry at 600k auctions/day."""
    # Daypart allocation summing to 600,000 auctions per day across 24 hours:
    # late_night (0-6h): 150,000 | morning (6-11h): 125,000 | lunch (11-14h): 75,000
    # afternoon (14-17h): 75,000 | primetime (17-22h): 125,000 | late_night (22-24h): 50,000
    return f"""
CREATE OR REPLACE TABLE `{project_id}.{dataset_id}.{table_id}`
PARTITION BY DATE(timestamp)
CLUSTER BY daypart, competitor_mode, campaign_id AS
WITH date_spine AS (
  SELECT 
    day, 
    EXTRACT(DAYOFWEEK FROM day) AS dow,
    DATE_DIFF(CURRENT_DATE(), day, DAY) AS days_ago
  FROM UNNEST(GENERATE_DATE_ARRAY(DATE_SUB(CURRENT_DATE(), INTERVAL 365 DAY), CURRENT_DATE())) AS day
),
daypart_template AS (
  SELECT "late_night" AS daypart, 0 AS start_h, 6 AS end_h, 0.82 AS base_p90, 0.20 AS min_bid, 1.10 AS max_bid, "standard" AS comp_mode, 150000 AS samples UNION ALL
  SELECT "morning"    AS daypart, 6 AS start_h, 11 AS end_h, 2.32 AS base_p90, 1.10 AS min_bid, 2.70 AS max_bid, "standard" AS comp_mode, 125000 AS samples UNION ALL
  SELECT "lunch"      AS daypart, 11 AS start_h, 14 AS end_h, 4.15 AS base_p90, 2.20 AS min_bid, 4.60 AS max_bid, "standard" AS comp_mode, 75000 AS samples UNION ALL
  SELECT "afternoon"  AS daypart, 14 AS start_h, 17 AS end_h, 8.35 AS base_p90, 3.00 AS min_bid, 9.20 AS max_bid, "adversarial" AS comp_mode, 75000 AS samples UNION ALL
  SELECT "primetime"  AS daypart, 17 AS start_h, 22 AS end_h, 9.35 AS base_p90, 6.50 AS min_bid, 10.20 AS max_bid, "adversarial" AS comp_mode, 125000 AS samples UNION ALL
  SELECT "late_night" AS daypart, 22 AS start_h, 24 AS end_h, 0.82 AS base_p90, 0.20 AS min_bid, 1.10 AS max_bid, "standard" AS comp_mode, 50000 AS samples
),
base_cross AS (
  SELECT 
    d.day,
    d.dow,
    d.days_ago,
    dp.daypart,
    dp.start_h,
    dp.end_h,
    dp.base_p90,
    dp.min_bid,
    dp.comp_mode,
    dp.samples,
    row_idx
  FROM date_spine d
  CROSS JOIN daypart_template dp
  CROSS JOIN UNNEST(GENERATE_ARRAY(1, dp.samples)) AS row_idx
),
simulated AS (
  SELECT
    CONCAT("auc-", FORMAT_DATE("%Y%m%d", day), "-", CAST(100000 + CAST(FLOOR(RAND() * 899999) AS INT64) AS STRING)) AS auction_id,
    TIMESTAMP_ADD(
      TIMESTAMP(day), 
      INTERVAL CAST(FLOOR(start_h * 3600 + (end_h - start_h) * 3600 * (row_idx / (samples + 1.0)) + RAND() * 60) AS INT64) SECOND
    ) AS timestamp,
    daypart,
    "camp-default" AS campaign_id,
    2.50 AS bid_cpm,
    ROUND(
      GREATEST(min_bid, 
        base_p90 * (1.0 + 0.04 * SIN(days_ago * 0.05) + IF(dow IN (1, 7), 0.02, -0.01)) + 
        IF(RAND() < 0.90, -0.20 * RAND(), 0.50 * RAND())
      ), 2
    ) AS competitor_highest_bid_cpm,
    comp_mode AS competitor_mode,
    row_idx
  FROM base_cross
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
  IF(bid_cpm >= competitor_highest_bid_cpm, ROUND((bid_cpm / 1000.0) * 1.35, 5), 0.0) AS revenue,
  ROUND(GREATEST(0.0, 2500.0 - (row_idx * 0.0025)), 2) AS budget_remaining,
  competitor_mode
FROM simulated;
"""


def main():
    force = "--force" in sys.argv or os.environ.get("FORCE_RESEED") == "1"

    global PROJECT_ID
    project_id = PROJECT_ID
    if project_id == "vibeflix-sandbox":
        try:
            default_client = bigquery.Client()
            if default_client.project and default_client.project != "vibeflix-sandbox":
                project_id = default_client.project
                PROJECT_ID = project_id
        except Exception:
            pass

    print(f"🚀 Initializing BigQuery historical telemetry for project '{project_id}'...")
    client = bigquery.Client(project=project_id)

    # 1. Ensure Dataset
    dataset_ref = bigquery.DatasetReference(project_id, DATASET_ID)
    dataset = bigquery.Dataset(dataset_ref)
    dataset.location = LOCATION
    client.create_dataset(dataset, exists_ok=True)

    table_ref = dataset_ref.table(TABLE_ID)

    # 2. Check if already seeded with full 1-year history (~219M rows)
    if not force:
        try:
            table = client.get_table(table_ref)
            if table.num_rows > 200000000:
                check_query = f"""
                SELECT 
                  COUNT(1) AS row_count,
                  MIN(DATE(timestamp)) AS min_date,
                  MAX(DATE(timestamp)) AS max_date,
                  DATE_DIFF(MAX(DATE(timestamp)), MIN(DATE(timestamp)), DAY) AS date_span
                FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
                """
                res = list(client.query(check_query).result())
                if res and res[0].date_span >= 350 and res[0].row_count >= 200000000:
                    print(
                        f"✅ Table '{DATASET_ID}.{TABLE_ID}' already contains 1 year of telemetry "
                        f"({res[0].row_count:,} rows from {res[0].min_date} to {res[0].max_date})."
                    )
                    print("   Pass --force to re-generate.")
                    return
        except NotFound:
            pass

    # 3. Generate 1-Year Dataset (600k auctions/day = 219M rows) via Server-Side CTAS
    print(f"⚙️  Generating 1 full year (365 days @ 600,000 auctions/day = ~219M events) via BigQuery CTAS...")
    start = time.time()
    client.delete_table(table_ref, not_found_ok=True)
    ctas_sql = generate_sql(PROJECT_ID, DATASET_ID, TABLE_ID)
    job = client.query(ctas_sql)
    job.result()
    elapsed = time.time() - start

    # 4. Attach Rich Schema Descriptions
    table = client.get_table(table_ref)
    table.schema = SCHEMA
    client.update_table(table, ["schema"])

    # 5. Verify & Print Stats
    verify_sql = f"""
    SELECT 
      COUNT(1) AS total_rows,
      MIN(DATE(timestamp)) AS min_date,
      MAX(DATE(timestamp)) AS max_date,
      COUNT(DISTINCT DATE(timestamp)) AS num_days
    FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
    """
    stats = list(client.query(verify_sql).result())[0]
    print(f"\n✅ Successfully generated {stats.total_rows:,} auction events in {elapsed:.1f}s ({elapsed/60:.1f}m)!")
    print(f"   📅 Historical Date Range: {stats.min_date} to {stats.max_date} ({stats.num_days} days / ~1 year)")

    breakdown_sql = f"""
    SELECT 
      daypart,
      COUNT(*) AS auctions,
      ROUND(AVG(competitor_highest_bid_cpm), 2) AS avg_competitor_cpm,
      ROUND(APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)], 2) AS market_p90_cpm,
      ROUND(AVG(win) * 100, 1) AS win_rate_pct
    FROM `{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}`
    GROUP BY daypart
    ORDER BY market_p90_cpm DESC
    """
    print("\n   📊 Daypart Calibration:")
    for row in client.query(breakdown_sql).result():
        print(f"      • {row.daypart:<11}: P90 ${row.market_p90_cpm:>5.2f} CPM | Win Rate: {row.win_rate_pct:>5.1f}% | Total: {row.auctions:,}")


if __name__ == "__main__":
    main()

