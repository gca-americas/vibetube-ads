import streamlit as st
import subprocess
import os
import requests
import time
import signal

# --- Config ---
st.set_page_config(page_title="Vibetube Ads Walkthrough", page_icon="📈", layout="wide")

AD_SERVER_URL = "http://localhost:8080"
AD_SERVER_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ad_server")

# --- Session State ---
if 'ad_server_proc' not in st.session_state:
    st.session_state.ad_server_proc = None

if 'creative_generated' not in st.session_state:
    st.session_state.creative_generated = False

if 'baseline_result' not in st.session_state:
    st.session_state.baseline_result = None

if 'agent_result' not in st.session_state:
    st.session_state.agent_result = None

# --- Helper Functions ---
def start_ad_server():
    if st.session_state.ad_server_proc is None:
        # Check if port 8080 is already in use
        try:
            requests.get(AD_SERVER_URL, timeout=1)
            st.toast("Ad server is already running!", icon="✅")
            # We don't have the proc, but it's running
            return
        except:
            pass

        try:
            # Build first
            subprocess.run(["go", "build", "."], cwd=AD_SERVER_DIR, check=True)
            # Run
            proc = subprocess.Popen(["./vibetube-ads"], cwd=AD_SERVER_DIR)
            st.session_state.ad_server_proc = proc
            
            # Wait for server to be up
            for _ in range(10):
                try:
                    requests.get(AD_SERVER_URL, timeout=1)
                    st.toast("Ad server started successfully!", icon="🚀")
                    return
                except:
                    time.sleep(0.5)
            st.toast("Ad server started but not responding yet.", icon="⚠️")
        except Exception as e:
            st.error(f"Failed to start Ad Server: {e}")

def stop_ad_server():
    if st.session_state.ad_server_proc:
        st.session_state.ad_server_proc.terminate()
        st.session_state.ad_server_proc.wait()
        st.session_state.ad_server_proc = None
        st.toast("Ad server stopped.", icon="🛑")
    else:
        # Try to kill anything on 8080 if the process wasn't tracked
        try:
            requests.get(AD_SERVER_URL, timeout=1)
            st.toast("Ad server is running externally, cannot stop from here.", icon="ℹ️")
        except:
            st.toast("No Ad Server running.", icon="ℹ️")

def run_simulation(num_auctions=20, is_agent=False):
    if not st.session_state.ad_server_proc:
        st.error("Simulator engine must be running to run a simulation!")
        return None
        
    try:
        # Simulate network delay for dramatic effect
        time.sleep(1.5)
        res = requests.post(f"{AD_SERVER_URL}/simulation/run", json={"userId": "student-1", "numAuctions": num_auctions}, timeout=5)
        if res.status_code == 200:
            return res.json()
        else:
            st.error(f"Error {res.status_code}: {res.text}")
    except Exception as e:
        st.error(f"Connection failed: {e}")
    return None

# --- Sidebar ---
st.sidebar.image("img/vibetube_ads_logo.jpg", use_container_width=True)
st.sidebar.title("Ad Ops Control Center")

st.sidebar.header("Simulator Engine")
col1, col2 = st.sidebar.columns(2)
if col1.button("▶️ Boot Simulator", type="primary", use_container_width=True):
    start_ad_server()
if col2.button("⏹️ Shutdown", use_container_width=True):
    stop_ad_server()
    
server_status = "🟢 Running" if st.session_state.ad_server_proc else "🔴 Stopped"
st.sidebar.caption(f"Simulator Engine Status: {server_status}")

st.sidebar.divider()
st.sidebar.header("Simulate Ad Auctions")
if st.sidebar.button("⚡ Simulate 20 Auctions", use_container_width=True):
    res = run_simulation(20, is_agent=False)
    if res:
        st.sidebar.success(f"Simulated 20 auctions! Won {res.get('wins',0)}")
if st.sidebar.button("⚡ Simulate 100 Auctions", use_container_width=True):
    res = run_simulation(100, is_agent=False)
    if res:
        st.sidebar.success(f"Simulated 100 auctions! Won {res.get('wins',0)}")
if st.sidebar.button("📈 Trigger Market Spike", use_container_width=True):
    if not st.session_state.ad_server_proc:
        st.sidebar.error("Simulator engine must be running!")
    else:
        try:
            requests.post(f"{AD_SERVER_URL}/simulation/spike", timeout=5)
            st.sidebar.success("Market spike triggered!")
        except Exception as e:
            st.sidebar.error("Failed to trigger spike.")
if st.sidebar.button("🔄 Reset Campaign", use_container_width=True):
    if not st.session_state.ad_server_proc:
        st.sidebar.error("Simulator engine must be running!")
    else:
        try:
            requests.post(f"{AD_SERVER_URL}/simulation/reset", timeout=5)
            st.sidebar.success("Campaign and budget reset!")
        except Exception as e:
            st.sidebar.error("Failed to reset campaign.")
st.sidebar.divider()

st.sidebar.header("Lab Selection")
lab_choice = st.sidebar.radio("Select a Lab", [
    "Home", 
    "Lab 01: Dynamic Bidding", 
    "Lab 02: Yield Optimization", 
    "Lab 03: Privacy Clean Rooms",
    "Lab 04: Capstone Control Room"
])

# --- Main Content ---
if lab_choice == "Home":
    st.title("Classroom Lab Walkthrough")
    st.write("Welcome to the Vibetube Ads Monetization Stack. Select a lab to begin your hands-on journey building agentic AI workflows.")
    
    c1, c2 = st.columns(2)
    with c1:
        st.image("img/bot_bidsy.jpg", use_container_width=True)
        st.subheader("Lab 01: Dynamic Bidding Agents")
        st.write("From Rules to Reasoning. Build a single-shot agent to analyze BigQuery telemetry and adjust bids to win auctions.")
    with c2:
        st.image("img/bot_sparky.jpg", use_container_width=True)
        st.subheader("Lab 02: Yield Optimization")
        st.caption("Coming Soon")
        
elif lab_choice == "Lab 01: Dynamic Bidding":
    st.title("Lab 01: Dynamic Bidding Agents")
    st.write("Transition from traditional rule-based algorithms to a reasoning-based bidding agent using ADK 2.0, Gemini, and BigQuery.")
    
    st.divider()
    
    # Step Selection using tabs
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "1. Setup", 
        "2. Explore", 
        "3. Baseline", 
        "4. Define Agent", 
        "5. Verify"
    ])
    
    with tab1:
        st.header("Step 1: Setup Campaign & Creative")
        st.write("Enter campaign parameters and use Gemini to generate an ad creative based on a text prompt.")
        campaign_name = st.text_input("Campaign Name", "Neon Streetwear Launch")
        prompt = st.text_area("Gemini Creative Style Prompt", "A futuristic neon shoe design targeting gaming enthusiasts with cyber aesthetics...")
        
        if st.button("Generate Ad with Gemini 2.5 Flash", type="primary"):
            with st.spinner("Gemini is generating your creative..."):
                time.sleep(2)
                st.session_state.creative_generated = True
                
        if st.session_state.creative_generated:
            st.success("Creative Generated Successfully!")
            st.json({
                "Creative Title": "Cyber Kicks 3000",
                "Creative URL": "https://vibetube.com/ads/cyber-kicks"
            })
            if st.button("Activate Campaign", type="secondary"):
                st.success("Campaign Activated! Default bid set to $2.00.")
with tab2:
        st.header("Step 2: Explore Telemetry Data")
        st.write("Imagine managing a high-stakes, multi-million dollar ad campaign. Every second, thousands of auctions occur. Bid too low, and you flatline; bid too high, and you burn your ROI. The local Go-based ad server emulates 100 to 1,000 competing ad campaigns. All auction results (won and lost) are written to BigQuery telemetry.")
        st.info("Action: Query BigQuery to see the telemetry stream containing impressions, clicks, and competitor bid prices.")
        st.caption("[IMAGE RECOMMENDATION: System architecture diagram showing ad server streaming to BigQuery]")
        st.code("""SELECT timestamp, campaign_id, bid_cpm, won_auction 
FROM `vibetube.ad_server.telemetry`
ORDER BY timestamp DESC LIMIT 10;""", language="sql")

    with tab3:
        st.header("Step 3: Run Deterministic Baseline")
        st.write("Run the hardcoded rule script. Observe how the static rules fail to adapt to competitor auction pressure, sending your campaign into a **Death Spiral** where you bleed cash on overpriced ads and lose entirely in competitive categories.")
        st.caption("[IMAGE RECOMMENDATION: A dramatic line graph showing the budget plummeting to zero alongside a flatlining win-rate for the Fashion category.]")
        
        if st.button("Run Baseline Simulation (20 Auctions)", type="primary"):
            with st.spinner("Running baseline simulation..."):
                res = run_simulation(is_agent=False)
                if res:
                    st.session_state.baseline_result = res
                    
        if st.session_state.baseline_result:
            res = st.session_state.baseline_result
            st.error(f"**Baseline Simulation Complete!**")
            col1, col2 = st.columns(2)
            col1.metric("Win-Rate", f"{(res.get('wins',0)/res.get('total_auctions',20))*100:.0f}%")
            col2.metric("Total Wins", f"{res.get('wins',0)} / {res.get('total_auctions',20)}")
            st.write("The deterministic rule failed to account for variable competitor pricing.")

    with tab4:
        st.header("Step 4: Define & Equip ADK Agent")
        st.write("Create a Python script using ADK 2.0 to define an agent that can query BigQuery and adjust bid prices dynamically.")
        st.code("""from adk.agent import LlmAgent

# Wrap local functions as ADK tools
def query_telemetry(query: str):
    # Executes SQL against BigQuery
    return db.execute(query)

def update_bid_cpm(price: float):
    # Calls local ad server API
    return api.post('/update_bid', {'cpm': price})

# Initialize Agent
agent = LlmAgent(
    model="gemini-2.5-flash",
    tools=[query_telemetry, update_bid_cpm],
    prompt="Analyze competitor P90 bid range and adjust bid CPM to win auctions."
)""", language="python")

    with tab5:
        st.header("Step 5: Verify Dynamic Bidding")
        st.write("Execute the agent script and run the simulation to verify the agent successfully analyzes telemetry and updates the bids to win auctions. Stop the budget drain and watch the win rate climb!")
        st.caption("[IMAGE RECOMMENDATION: A screenshot of the ad server dashboard showing the 'Win Rate' chart climbing sharply after the agent updates the bids.]")
        
        if st.button("Run Agent Simulation (20 Auctions)", type="primary"):
            with st.spinner("Agent is reasoning and adjusting bids..."):
                # Mock the API endpoint behavior returning better results for agent
                time.sleep(2)
                st.session_state.agent_result = {
                    "total_auctions": 20,
                    "wins": 17,
                    "cost": 4.25,
                    "budget_remaining": 45.75
                }
                
        if st.session_state.agent_result:
            res = st.session_state.agent_result
            st.success("**Agent Simulation Complete!**")
            col1, col2, col3 = st.columns(3)
            col1.metric("Win-Rate", f"{(res.get('wins',0)/res.get('total_auctions',20))*100:.0f}%", "+85%")
            col2.metric("Total Wins", f"{res.get('wins',0)} / {res.get('total_auctions',20)}")
            col3.metric("Cost", f"${res.get('cost',0.0):.2f}")
            st.write("The AI agent successfully outbid competitors in fashion while preserving budget in gaming.")

else:
    st.title(lab_choice)
    st.info("This lab is still under construction. Stay tuned!")

# Clean up process on exit
import atexit
def cleanup():
    if st.session_state.ad_server_proc:
        st.session_state.ad_server_proc.terminate()
atexit.register(cleanup)
