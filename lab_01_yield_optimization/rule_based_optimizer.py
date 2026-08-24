import requests
from google.cloud import bigquery

# Configure client
PROJECT_ID = "your-project-id"
AD_SERVER_URL = "http://localhost:8080"
bq_client = bigquery.Client(project=PROJECT_ID)

def get_campaign_config():
    response = requests.get(f"{AD_SERVER_URL}/campaign/config")
    return response.json()

def update_active_bid(new_price: float):
    response = requests.post(
        f"{AD_SERVER_URL}/campaign/update", 
        json={"bid_cpm": new_price}
    )
    return response.json()

def calculate_overall_win_rate():
    # Fetch overall win rate of the last 5 minutes
    query = f"""
    SELECT
      SAFE_DIVIDE(SUM(win), COUNT(*)) as win_rate
    FROM
      `{PROJECT_ID}.vibetube_telemetry.auction_events`
    WHERE
      timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
    """
    query_job = bq_client.query(query)
    results = list(query_job.result())
    return results[0].win_rate or 0.0

def run_optimization():
    config = get_campaign_config()
    current_bid = config.get("active_bid_cpm", 2.50)
    max_ceiling = config.get("max_bid_ceiling", 10.00)
    budget = config.get("budget_remaining", 2500.0)
    
    win_rate = calculate_overall_win_rate()
    
    print(f"Remaining Budget: ${budget:.2f}")
    print(f"Current Active Bid: ${current_bid:.2f} CPM (Ceiling: ${max_ceiling:.2f} CPM)")
    print(f"5-Minute Win Rate: {win_rate * 100:.1f}%")
    
    # Heuristic rule: fixed threshold adjustment
    if win_rate < 0.30:
        new_bid = min(current_bid + 0.50, max_ceiling)
    elif win_rate > 0.85:
        new_bid = max(current_bid - 0.20, 0.50)
    else:
        new_bid = current_bid
        
    if new_bid != current_bid:
        print(f"Adjusting Active Bid to: ${new_bid:.2f} CPM")
        update_active_bid(new_bid)

if __name__ == "__main__":
    run_optimization()

