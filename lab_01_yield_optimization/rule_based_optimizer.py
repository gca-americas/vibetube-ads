import requests
from google.cloud import bigquery

# Configure client
PROJECT_ID = "your-project-id"
AD_SERVER_URL = "http://localhost:8080"
bq_client = bigquery.Client(project=PROJECT_ID)

def get_campaign_status():
    response = requests.get(f"{AD_SERVER_URL}/campaign/status")
    return response.json() # Returns {"bids": {"gaming": float, "fashion": float}, "budget_remaining": float}

def update_category_bid(category, new_price):
    response = requests.post(
        f"{AD_SERVER_URL}/campaign/update", 
        json={"category": category, "bid_cpm": new_price}
    )
    return response.json()

def calculate_overall_win_rate():
    # Fetch overall win rate of the last 5 minutes (ignoring category)
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
    status = get_campaign_status()
    bids = status["bids"]
    budget = status["budget_remaining"]
    
    overall_win_rate = calculate_overall_win_rate()
    
    print(f"Remaining Budget: ${budget:.2f}")
    print(f"Current Bids -> Gaming: ${bids['gaming']:.2f} | Fashion: ${bids['fashion']:.2f}")
    print(f"Overall Win Rate: {overall_win_rate * 100:.1f}%")
    
    # Deterministic heuristic rules based on overall win rate
    # If win rate is low, increase bids for BOTH categories blindly
    if overall_win_rate < 0.30:
        new_gaming_bid = bids["gaming"] + 0.50
        new_fashion_bid = bids["fashion"] + 0.50
    # If win rate is high, decrease bids for BOTH categories blindly
    elif overall_win_rate > 0.85:
        new_gaming_bid = bids["gaming"] - 0.20
        new_fashion_bid = bids["fashion"] - 0.20
    else:
        new_gaming_bid = bids["gaming"]
        new_fashion_bid = bids["fashion"]
        
    if new_gaming_bid != bids["gaming"]:
        print(f"Adjusting Gaming bid to: ${new_gaming_bid:.2f}")
        update_category_bid("gaming", new_gaming_bid)
    if new_fashion_bid != bids["fashion"]:
        print(f"Adjusting Fashion bid to: ${new_fashion_bid:.2f}")
        update_category_bid("fashion", new_fashion_bid)

if __name__ == "__main__":
    run_optimization()
