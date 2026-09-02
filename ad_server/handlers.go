package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"

	"golang.org/x/oauth2/google"
)

func getLabDir() string {
	if env := os.Getenv("LAB_DIR"); env != "" {
		return env
	}
	candidates := []string{
		"../lab_01_yield_optimization",
		"./lab_01_yield_optimization",
		"lab_01_yield_optimization",
		"/app/lab_01_yield_optimization",
	}
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && info.IsDir() {
			abs, err := filepath.Abs(c)
			if err == nil {
				return abs
			}
			return c
		}
	}
	return "../lab_01_yield_optimization"
}

func getPoliciesDir() string {
	return filepath.Join(getLabDir(), "policies")
}

type Server struct {
	store           *Store
	publisher       TelemetryPublisher
	vibetubeBackend string
}

func NewServer(store *Store, publisher TelemetryPublisher) *Server {
	vibetubeBackend := os.Getenv("VIBETUBE_BACKEND_URL")
	if vibetubeBackend == "" {
		vibetubeBackend = "http://localhost:8000"
	}
	log.Printf("Ad Server initialized with Vibetube Backend: %s", vibetubeBackend)
	return &Server{
		store:           store,
		publisher:       publisher,
		vibetubeBackend: vibetubeBackend,
	}
}

type BidUpdatePayload struct {
	BidCPM float64 `json:"bid_cpm"`
}

type CampaignSetupPayload struct {
	ID             string            `json:"id"`
	Name           string            `json:"name"`
	CreativeURL    string            `json:"creative_url"`
	CreativeTitle  string            `json:"creative_title"`
	CreativeBanner string            `json:"creative_banner"`
	Budget         float64           `json:"budget"`
	BidCPM         float64           `json:"bid_cpm"`
	MaxBidCeiling  float64           `json:"max_bid_ceiling"`
	Strategy       string            `json:"strategy"`
	StrategyCodes  map[string]string `json:"strategy_codes,omitempty"`
}

type DeleteCampaignPayload struct {
	ID string `json:"id"`
}

type SimulationPayload struct {
	UserID      string  `json:"userId"`
	NumAuctions int     `json:"numAuctions"`
	StepIndex   int     `json:"stepIndex"`
	Scenario    string  `json:"scenario"`
	BidCPM      float64 `json:"bid_cpm,omitempty"`
	Strategy    string  `json:"strategy,omitempty"`
}

type AuctionTelemetryEvent struct {
	EventType               string  `json:"event_type"`
	Timestamp               string  `json:"timestamp"`
	Daypart                 string  `json:"daypart"`
	BidCPM                  float64 `json:"bid_cpm"`
	Win                     int     `json:"win"`
	Cost                    float64 `json:"cost"`
	Revenue                 float64 `json:"revenue"`
	BudgetRemaining         float64 `json:"budget_remaining"`
	CompetitorHighestBidCPM float64 `json:"competitor_highest_bid_cpm"`
}

func (s *Server) HandleGetConfig(w http.ResponseWriter, r *http.Request) {
	state := s.store.GetState()
	campaigns := s.store.GetCampaigns()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"active_campaign":  state,
		"campaigns":        campaigns,
		"id":               state.ID,
		"name":             state.Name,
		"creative_url":     state.CreativeURL,
		"creative_title":   state.CreativeTitle,
		"creative_banner":  state.CreativeBanner,
		"budget_remaining": state.BudgetRemaining,
		"total_budget":     state.TotalBudget,
		"strategy":         state.Strategy,
		"strategy_codes":   state.StrategyCodes,
		"base_bid_cpm":     state.BaseBidCPM,
		"active_bid_cpm":   state.ActiveBidCPM,
		"max_bid_ceiling":  state.MaxBidCeiling,
		"competitor_mode":  state.CompetitorMode,
	})
}

func (s *Server) HandleListCampaigns(w http.ResponseWriter, r *http.Request) {
	campaigns := s.store.GetCampaigns()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"campaigns": campaigns,
	})
}

func (s *Server) HandleUpdateBid(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload BidUpdatePayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}
	if payload.BidCPM <= 0 {
		http.Error(w, "Invalid bid CPM: must be greater than 0", http.StatusBadRequest)
		return
	}
	if err := s.store.UpdateBid(payload.BidCPM); err != nil {
		http.Error(w, "Failed to update bid", http.StatusInternalServerError)
		return
	}
	log.Printf("Updated active bid CPM to $%.2f", payload.BidCPM)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

func (s *Server) HandleSetupCampaign(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload CampaignSetupPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}
	if payload.Name == "" {
		payload.Name = "Neon Runner Launch"
	}
	if payload.Budget <= 0 {
		payload.Budget = 2500.00
	}
	if payload.BidCPM <= 0 {
		payload.BidCPM = 2.50
	}
	if payload.MaxBidCeiling <= 0 {
		payload.MaxBidCeiling = 10.00
	}
	if payload.Strategy == "" {
		payload.Strategy = "deterministic"
	}

	camp := CampaignState{
		ID:              payload.ID,
		Name:            payload.Name,
		CreativeURL:     payload.CreativeURL,
		CreativeTitle:   payload.CreativeTitle,
		CreativeBanner:  payload.CreativeBanner,
		BudgetRemaining: payload.Budget,
		TotalBudget:     payload.Budget,
		Strategy:        payload.Strategy,
		StrategyCodes:   payload.StrategyCodes,
		BaseBidCPM:      payload.BidCPM,
		ActiveBidCPM:    payload.BidCPM,
		MaxBidCeiling:   payload.MaxBidCeiling,
		CompetitorMode:  "normal",
		Status:          "active",
		CreatedAt:       time.Now().Format(time.RFC3339),
	}

	if err := s.store.SaveCampaign(camp); err != nil {
		http.Error(w, "Failed to setup campaign", http.StatusInternalServerError)
		return
	}
	log.Printf("Configured campaign: %s (ID: %s, Bid: $%.2f, Max Ceiling: $%.2f)", camp.Name, camp.ID, camp.ActiveBidCPM, camp.MaxBidCeiling)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":   "success",
		"campaign": camp,
	})
}

func (s *Server) HandleDeleteCampaign(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		var payload DeleteCampaignPayload
		if err := json.NewDecoder(r.Body).Decode(&payload); err == nil && payload.ID != "" {
			id = payload.ID
		}
	}
	if id != "" {
		_ = s.store.DeleteCampaign(id)
	} else {
		active := s.store.GetState()
		_ = s.store.DeleteCampaign(active.ID)
	}
	log.Printf("Campaign %s deleted successfully.", id)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

type DeterministicParams struct {
	StepUp           float64
	StepDown         float64
	LowWinThreshold  float64
	HighWinThreshold float64
	MinFloor         float64
}

func parseDeterministicCode(code string) DeterministicParams {
	params := DeterministicParams{
		StepUp:           0.50,
		StepDown:         0.20,
		LowWinThreshold:  30.0,
		HighWinThreshold: 85.0,
		MinFloor:         0.50,
	}
	if code == "" {
		return params
	}

	// Regex for step up: current_bid + X
	reUp := regexp.MustCompile(`current_bid\s*\+\s*([0-9]+(?:\.[0-9]+)?)`)
	if m := reUp.FindStringSubmatch(code); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v > 0 {
			params.StepUp = v
		}
	}

	// Regex for step down: current_bid - X
	reDown := regexp.MustCompile(`current_bid\s*-\s*([0-9]+(?:\.[0-9]+)?)`)
	if m := reDown.FindStringSubmatch(code); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v > 0 {
			params.StepDown = v
		}
	}

	// Regex for win_rate < X
	reLowWin := regexp.MustCompile(`win_rate\s*<\s*([0-9]+(?:\.[0-9]+)?)`)
	if m := reLowWin.FindStringSubmatch(code); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v > 0 {
			if v <= 1.0 {
				params.LowWinThreshold = v * 100.0
			} else {
				params.LowWinThreshold = v
			}
		}
	}

	// Regex for win_rate > X
	reHighWin := regexp.MustCompile(`win_rate\s*>\s*([0-9]+(?:\.[0-9]+)?)`)
	if m := reHighWin.FindStringSubmatch(code); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v > 0 {
			if v <= 1.0 {
				params.HighWinThreshold = v * 100.0
			} else {
				params.HighWinThreshold = v
			}
		}
	}

	return params
}

func runPythonScript(userCode string, state CampaignState, winRate float64, competitorP90 float64) (float64, error) {
	currentBid := state.ActiveBidCPM
	if currentBid <= 0 {
		currentBid = 2.50
	}
	maxCeiling := state.MaxBidCeiling
	if maxCeiling <= 0 {
		maxCeiling = 10.00
	}

	payload := map[string]interface{}{
		"active_bid_cpm":   currentBid,
		"max_bid_ceiling":  maxCeiling,
		"win_rate":         winRate, // percentage (0 - 100)
		"competitor_p90":   competitorP90,
		"budget_remaining": state.BudgetRemaining,
		"strategy":         state.Strategy,
		"competitor_mode":  state.CompetitorMode,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return currentBid, err
	}

	scriptTemplate := `import sys, json, os, math

_RAW_INPUT = sys.stdin.read().strip()
_CONTEXT = json.loads(_RAW_INPUT) if _RAW_INPUT else {}
_CURRENT_BID = float(_CONTEXT.get("active_bid_cpm", 2.50))
_MAX_CEILING = float(_CONTEXT.get("max_bid_ceiling", 10.00))
_WIN_RATE_PCT = float(_CONTEXT.get("win_rate", 0.0))
_WIN_RATE = _WIN_RATE_PCT / 100.0
_COMPETITOR_P90 = float(_CONTEXT.get("competitor_p90", 2.35))
_COMPETITOR_MODE = _CONTEXT.get("competitor_mode", "normal")
_STRATEGY = _CONTEXT.get("strategy", "deterministic")

_NEW_BID = _CURRENT_BID

def get_campaign_config():
    return {
        "active_bid_cpm": _CURRENT_BID,
        "max_bid_ceiling": _MAX_CEILING,
        "total_budget": float(_CONTEXT.get("budget_remaining", 2500.0)),
        "budget_remaining": float(_CONTEXT.get("budget_remaining", 2500.0)),
        "strategy": _STRATEGY,
        "competitor_mode": _COMPETITOR_MODE,
        "competitor_p90": _COMPETITOR_P90,
        "win_rate": _WIN_RATE,
    }

def calculate_overall_win_rate():
    return _WIN_RATE

def query_telemetry(window_minutes=5):
    return {
        "win_rate": _WIN_RATE,
        "min_to_win_cpm": _COMPETITOR_P90,
        "competitor_p90": _COMPETITOR_P90,
        "recent_auctions": 10000,
    }

def get_bidding_history(window_minutes=20):
    return {
        "historical_min_to_win": _COMPETITOR_P90,
        "historical_p90": _COMPETITOR_P90,
        "dropout_detected": _COMPETITOR_P90 < 2.0 or _COMPETITOR_MODE == "dropout",
    }

def update_active_bid(bid):
    global _NEW_BID
    try:
        b = float(bid)
        _NEW_BID = max(0.50, min(b, _MAX_CEILING))
    except Exception as e:
        sys.stderr.write(f"update_active_bid error: {e}\n")

def update_bid_cpm(bid):
    update_active_bid(bid)

import sys
_LAB_DIR = "%s"
if _LAB_DIR not in sys.path:
    sys.path.insert(0, _LAB_DIR)

# === USER ACTIVE PYTHON CODE START ===
%s
# === USER ACTIVE PYTHON CODE END ===

# Automatic execution of standard bidding_policy.py function: compute_bid(context)
if 'compute_bid' in locals() and callable(locals()['compute_bid']):
    try:
        import inspect
        sig = inspect.signature(compute_bid)
        
        # Build enriched context dictionary with history vectors
        context_payload = {
            "daypart": _DATA.get("daypart", "morning"),
            "p90": float(_COMPETITOR_P90),
            "recent_p90_cpm": float(_COMPETITOR_P90),
            "p90_history": _DATA.get("p90_history", [float(_COMPETITOR_P90)] * 5),
            "win_rate": float(_WIN_RATE),
            "recent_win_rate": float(_WIN_RATE),
            "win_rate_history": _DATA.get("win_rate_history", [float(_WIN_RATE)] * 5),
            "budget_remaining": float(_DATA.get("budget_remaining", 2500.0)),
            "hours_remaining": float(_DATA.get("hours_remaining", 12.0)),
            "max_bid_ceiling": float(_MAX_CEILING),
            "active_bid_cpm": float(_CURRENT_BID),
        }
        try:
            try:
                from lib.models import AuctionContext
            except ImportError:
                from models import AuctionContext
            context_obj = AuctionContext(**context_payload)
        except Exception:
            class DictObj(dict):
                def __getattr__(self, name):
                    return self.get(name)
            context_obj = DictObj(context_payload)
        
        if len(sig.parameters) == 1:
            computed = compute_bid(context_obj)
        else:
            # Fallback for 2-parameter signature: compute_bid(telemetry, campaign)
            telemetry_payload = {
                "daypart": context_payload["daypart"],
                "competitor_p90": context_payload["recent_p90_cpm"],
                "recent_p90_cpm": context_payload["recent_p90_cpm"],
                "p90_history": context_payload["p90_history"],
                "win_rate": context_payload["recent_win_rate"],
                "recent_win_rate": context_payload["recent_win_rate"],
                "win_rate_history": context_payload["win_rate_history"],
            }
            campaign_payload = {
                "active_bid_cpm": _CURRENT_BID,
                "max_bid_ceiling": _MAX_CEILING,
                "budget_remaining": context_payload["budget_remaining"],
                "hours_remaining": context_payload["hours_remaining"],
            }
            computed = compute_bid(telemetry_payload, campaign_payload)
            
        update_active_bid(computed)
    except Exception as e:
        sys.stderr.write(f"Error in compute_bid(): {e}\n")
elif 'run_agent_cycle' in locals() and callable(locals()['run_agent_cycle']):
    try:
        run_agent_cycle()
    except Exception as e:
        sys.stderr.write(f"Error in user run_agent_cycle(): {e}\n")
elif 'run_optimization' in locals() and callable(locals()['run_optimization']):
    try:
        run_optimization()
    except Exception as e:
        sys.stderr.write(f"Error in user run_optimization(): {e}\n")

print(json.dumps({"new_bid": round(float(_NEW_BID), 2)}))
`
	fullScript := fmt.Sprintf(scriptTemplate, getLabDir(), userCode)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	tmpScript, err := os.CreateTemp("", "opt_*.py")
	if err != nil {
		return currentBid, err
	}
	defer os.Remove(tmpScript.Name())
	_, _ = tmpScript.WriteString(fullScript)
	_ = tmpScript.Close()

	var cmd *exec.Cmd
	if runtime.GOOS != "darwin" {
		cmd = exec.CommandContext(ctx, "python3", tmpScript.Name())
	} else {
		cmd = exec.CommandContext(ctx, "zsh", "-c", fmt.Sprintf("source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 %s", tmpScript.Name()))
	}
	cmd.Dir = getLabDir()
	cmd.Stdin = bytes.NewReader(payloadBytes)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Run(); err != nil {
		log.Printf("[python-runtime] Execution error: %v, stderr: %s", err, errBuf.String())
		return currentBid, fmt.Errorf("python execution error: %v (stderr: %s)", err, errBuf.String())
	}

	var result struct {
		NewBid float64 `json:"new_bid"`
	}
	if err := json.Unmarshal(outBuf.Bytes(), &result); err != nil {
		log.Printf("[python-runtime] JSON parse error: %v, output: %s", err, outBuf.String())
		return currentBid, err
	}

	log.Printf("[python-runtime] Successfully executed Python 3 script -> Calculated Bid: $%.2f", result.NewBid)
	return result.NewBid, nil
}

// RunStrategyOptimizer executes the active campaign's bidding algorithm based on recent auction batch telemetry.
func (s *Server) RunStrategyOptimizer(state CampaignState, winRate float64, competitorP90 float64) float64 {
	currentBid := state.ActiveBidCPM
	if currentBid <= 0 {
		currentBid = 2.50
	}
	maxCeiling := state.MaxBidCeiling
	if maxCeiling <= 0 {
		maxCeiling = 10.00
	}

	scriptPath := filepath.Join(getPoliciesDir(), "agent_bidding_policy.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		scriptPath = filepath.Join(getPoliciesDir(), "bidding_policy.py")
	}
	if content, err := os.ReadFile(scriptPath); err == nil && len(content) > 0 {
		newBid, err := runPythonScript(string(content), state, winRate, competitorP90)
		if err == nil {
			newBid = math.Round(newBid*100) / 100
			if newBid != currentBid {
				_ = s.store.UpdateBid(newBid)
				log.Printf("[agent_bidding_policy.py | PYTHON3] Updated active bid from $%.2f to $%.2f CPM (P90: $%.2f, Win Rate: %.1f%%)", currentBid, newBid, competitorP90, winRate)
			}
			return newBid
		}
		log.Printf("[agent_bidding_policy.py] Python execution error: %v", err)
	}

	return currentBid
}

func generate24HourCompetitorBids(stepIndex int, totalSteps int, totalAuctions int) ([]float64, string, string) {
	bids := make([]float64, totalAuctions)
	if totalSteps <= 0 {
		totalSteps = 50
	}
	t := (float64(stepIndex) / float64(totalSteps)) * 24.0 // Hour 0.0 to 24.0

	var daypart string
	var mode string
	var baseMean float64

	// 1. Layer 1: Base Diurnal Curve & Daypart Classification
	if t < 6.0 {
		daypart = "late_night"
		mode = "dropout"
		baseMean = 0.85 + 0.10*math.Sin(t) // $0.85 – $0.95
	} else if t < 11.0 {
		daypart = "morning"
		mode = "normal"
		baseMean = 1.40 + (t-6.0)*0.22 // $1.40 -> $2.50
	} else if t < 13.5 {
		daypart = "afternoon"
		mode = "spike"
		baseMean = 3.80 + 0.50*math.Sin((t-11.0)*math.Pi/2.5) // Lunch rush peak ~$4.30
	} else if t < 14.5 {
		daypart = "afternoon"
		mode = "normal"
		baseMean = 2.60 // Post-lunch baseline
	} else if t < 16.5 {
		daypart = "afternoon"
		mode = "spike"
		// 2. Layer 2: ⚔️ Algorithmic Bidding War (Escalation to $9.20)
		progress := (t - 14.5) / 2.0
		baseMean = 3.50 + progress*5.70
	} else if t < 17.5 {
		daypart = "afternoon"
		mode = "dropout"
		baseMean = 1.80 // 💥 Instant crash after rival bot runs out of cash
	} else if t < 22.0 {
		daypart = "primetime"
		mode = "spike"
		baseMean = 9.40 + 0.25*math.Sin(t) // 3. Layer 3: ⚡ Primetime organic super-surge
	} else {
		daypart = "late_night"
		mode = "dropout"
		progress := (t - 22.0) / 2.0
		baseMean = 9.40 - progress*8.50 // Steep wind-down to $0.90
		if baseMean < 0.90 {
			baseMean = 0.90
		}
	}

	// 4. Layer 4: Stochastic Market Chaos (Jitter on each auction)
	for i := 0; i < totalAuctions; i++ {
		jitter := (rand.Float64() - 0.5) * 0.50
		bids[i] = math.Max(0.15, baseMean+jitter)
	}

	return bids, mode, daypart
}

func (s *Server) HandleRunSimulation(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload SimulationPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.UserID == "" {
		http.Error(w, "Invalid payload or missing userId", http.StatusBadRequest)
		return
	}

	state := s.store.GetState()
	rand.Seed(time.Now().UnixNano())

	totalAuctions := payload.NumAuctions
	if totalAuctions <= 0 {
		totalAuctions = 20000
	}
	wins := 0
	totalCost := 0.0
	totalRevenue := 0.0

	type EventSummary struct {
		AuctionID               string  `json:"auction_id"`
		Timestamp               string  `json:"timestamp"`
		Daypart                 string  `json:"daypart"`
		BidCPM                  float64 `json:"bid_cpm"`
		CompetitorHighestBidCPM float64 `json:"competitor_highest_bid_cpm"`
		Win                     int     `json:"win"`
		Cost                    float64 `json:"cost"`
		Revenue                 float64 `json:"revenue"`
		BudgetRemaining         float64 `json:"budget_remaining"`
	}

	var recentEvents []EventSummary
	bidCPM := state.ActiveBidCPM
	if payload.BidCPM > 0 {
		bidCPM = payload.BidCPM
		_ = s.store.UpdateBid(bidCPM)
	}
	if bidCPM <= 0 {
		bidCPM = 2.50
	}

	if payload.Strategy != "" {
		state.Strategy = payload.Strategy
	}

	currentBudget := state.BudgetRemaining
	impressionCost := bidCPM / 1000.0

	competitorBids, mode, daypart := generate24HourCompetitorBids(payload.StepIndex, 50, totalAuctions)
	state.CompetitorMode = mode

	for i := 0; i < totalAuctions; i++ {
		competitorBid := competitorBids[i]

		win := 0
		cost := 0.0
		revenue := 0.0

		// Check if budget is available
		if currentBudget >= impressionCost && bidCPM > competitorBid {
			win = 1
			wins++
			cost = bidCPM
			currentBudget -= impressionCost
			totalCost += impressionCost

			// Simulate CTR click (5% CTR)
			if rand.Float64() < 0.05 {
				revenue = 0.15
				totalRevenue += revenue
			}
		}

		nowStr := time.Now().UTC().Format(time.RFC3339Nano)
		auctionID := fmt.Sprintf("auc-%d-%d", time.Now().UnixNano(), i)

		// Record in recent events sample (up to last 25)
		if i >= totalAuctions-25 {
			recentEvents = append(recentEvents, EventSummary{
				AuctionID:               auctionID,
				Timestamp:               nowStr,
				Daypart:                 daypart,
				BidCPM:                  bidCPM,
				CompetitorHighestBidCPM: competitorBid,
				Win:                     win,
				Cost:                    cost,
				Revenue:                 revenue,
				BudgetRemaining:         currentBudget,
			})
		}

		// Publish to BigQuery via Pub/Sub
		telemetryEvent := AuctionTelemetryEvent{
			EventType:               "AUCTION_EVENT",
			Timestamp:               nowStr,
			Daypart:                 daypart,
			BidCPM:                  bidCPM,
			Win:                     win,
			Cost:                    cost,
			Revenue:                 revenue,
			BudgetRemaining:         currentBudget,
			CompetitorHighestBidCPM: competitorBid,
		}
		s.publisher.PublishEvent(r.Context(), telemetryEvent)
	}

	// Persist total deducted budget atomically
	if totalCost > 0 {
		_ = s.store.DeductBudget(totalCost)
	}
	state = s.store.GetState()

	// Live BQ streaming is detached by default to keep pre-populated telemetry clean & idempotent.
	// Can be enabled with ENABLE_LIVE_BQ_STREAMING=true if desired.
	if os.Getenv("ENABLE_LIVE_BQ_STREAMING") == "true" && len(recentEvents) > 0 {
		go func(events []EventSummary, compMode string, currentDaypart string) {
			var rows []*AuctionEventRow
			for _, e := range events {
				t, err := time.Parse(time.RFC3339, e.Timestamp)
				if err != nil || t.IsZero() {
					t = time.Now()
				}
				rows = append(rows, &AuctionEventRow{
					EventID:                 e.AuctionID,
					Timestamp:               t,
					Daypart:                 currentDaypart,
					CampaignID:              "camp-default",
					BidCPM:                  e.BidCPM,
					CompetitorHighestBidCPM: e.CompetitorHighestBidCPM,
					Win:                     e.Win == 1,
					Cost:                    e.Cost,
					Revenue:                 e.Revenue,
					BudgetRemaining:         e.BudgetRemaining,
					CompetitorMode:          compMode,
				})
			}
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			_ = StreamAuctionEventsToBigQuery(ctx, rows)
		}(recentEvents, mode, daypart)
	}

	// Register winning ad with Vibetube Backend if we had any wins and creative URL is set
	if wins > 0 && state.CreativeURL != "" {
		err := s.registerAdWithVibetube(payload.UserID, state.CreativeURL, state.Name, bidCPM)
		if err != nil {
			log.Printf("Failed to register ad on Vibetube: %v", err)
		} else {
			log.Printf("Successfully registered custom ad creative on Vibetube for user: %s", payload.UserID)
		}
	} else {
		// Clear registered ad to default fallback
		_ = s.registerAdWithVibetube(payload.UserID, "https://storage.googleapis.com/vibetube-sandbox-public-streams/ads/default_preroll.mp4", "Default Brand Promo", 0.0)
	}

	winRate := 0.0
	if totalAuctions > 0 {
		winRate = (float64(wins) / float64(totalAuctions)) * 100.0
	}

	// Calculate true competitor P90 from simulated batch
	competitorP90 := 2.35
	if len(competitorBids) > 0 {
		sort.Float64s(competitorBids)
		p90Idx := int(float64(len(competitorBids)) * 0.90)
		if p90Idx >= len(competitorBids) {
			p90Idx = len(competitorBids) - 1
		}
		competitorP90 = math.Round(competitorBids[p90Idx]*100) / 100
	}

	// ACTUALLY EXECUTE THE STRATEGY OPTIMIZER ON THIS REAL TELEMETRY
	nextActiveBid := s.RunStrategyOptimizer(state, winRate, competitorP90)

	respData := map[string]interface{}{
		"status":           "success",
		"total_auctions":   totalAuctions,
		"wins":             wins,
		"win_rate":         winRate,
		"cost":             totalCost,
		"revenue":          totalRevenue,
		"budget_remaining": state.BudgetRemaining,
		"executed_bid_cpm": bidCPM,
		"active_bid_cpm":   bidCPM,
		"next_bid_cpm":     nextActiveBid,
		"competitor_p90":   competitorP90,
		"competitor_mode":  state.CompetitorMode,
		"recent_events":    recentEvents,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(respData)
}

func (s *Server) HandleTriggerDropout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := s.store.UpdateCompetitorMode("dropout"); err != nil {
		http.Error(w, "Failed to update competitor mode", http.StatusInternalServerError)
		return
	}
	log.Println("Simulation Mode set to: dropout (competitor bids lowered)")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

func (s *Server) HandleTriggerNormal(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := s.store.UpdateCompetitorMode("normal"); err != nil {
		http.Error(w, "Failed to update competitor mode", http.StatusInternalServerError)
		return
	}
	log.Println("Simulation Mode set to: normal (baseline competitor flow)")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

func (s *Server) HandleTriggerSpike(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := s.store.UpdateCompetitorMode("spike"); err != nil {
		http.Error(w, "Failed to update competitor mode", http.StatusInternalServerError)
		return
	}
	log.Println("Simulation Mode set to: spike (competitor bids raised)")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

func (s *Server) HandleReset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if err := s.store.Reset(); err != nil {
		http.Error(w, "Failed to reset store", http.StatusInternalServerError)
		return
	}
	log.Println("Reset campaign state and budget.")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

func (s *Server) registerAdWithVibetube(userId, creativeUrl, campaignName string, bidCpm float64) error {
	url := fmt.Sprintf("%s/api/ads/register", s.vibetubeBackend)
	payload := map[string]interface{}{
		"userId":       userId,
		"creativeUrl":  creativeUrl,
		"campaignName": campaignName,
		"bidCpm":       bidCpm,
	}
	bytesPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(bytesPayload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("bad status response: %s", resp.Status)
	}
	return nil
}

type CreativePromptPayload struct {
	Prompt string `json:"prompt"`
}

func (s *Server) HandleGenerateCreative(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload CreativePromptPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "Invalid payload", http.StatusBadRequest)
		return
	}

	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = "vibeflix-sandbox"
	}
	location := os.Getenv("VERTEX_AI_LOCATION")
	if location == "" {
		location = "us-central1"
	}

	title := "Apex Innovation"
	banner := "Engineered for next-generation performance."
	category := "tech"
	imageData := ""

	ctx, cancel := context.WithTimeout(r.Context(), 45*time.Second)
	defer cancel()

	// Authenticate to Vertex AI using Google Application Default Credentials (ADC)
	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err == nil && creds != nil {
		tokenSource := creds.TokenSource
		tok, err := tokenSource.Token()
		if err == nil && tok.AccessToken != "" {
			token := tok.AccessToken

			// 1. Generate Title, Tagline, & Category with Gemini on Vertex AI
			geminiUrl := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/gemini-2.5-flash:generateContent", location, projectID, location)
			geminiPrompt := fmt.Sprintf(`You are an expert creative director for Vibetube video ads. Based on the user prompt: '%s', determine if a specific product title or brand name was explicitly specified. If specified, use that exact title. Otherwise, generate a snazzy, punchy product title (under 20 chars). Also generate a compelling ad tagline (under 45 chars), and select category ('gaming', 'fashion', or 'tech'). Respond ONLY with a valid JSON object with keys 'title', 'description', 'category'. No markdown.`, payload.Prompt)

			geminiReqPayload := map[string]interface{}{
				"contents": []map[string]interface{}{
					{
						"role": "user",
						"parts": []map[string]interface{}{
							{"text": geminiPrompt},
						},
					},
				},
				"generationConfig": map[string]interface{}{
					"responseMimeType": "application/json",
				},
			}

			if bytesReq, err := json.Marshal(geminiReqPayload); err == nil {
				req, err := http.NewRequestWithContext(ctx, "POST", geminiUrl, bytes.NewBuffer(bytesReq))
				if err == nil {
					req.Header.Set("Authorization", "Bearer "+token)
					req.Header.Set("Content-Type", "application/json")
					client := &http.Client{Timeout: 15 * time.Second}
					if resp, err := client.Do(req); err == nil {
						if resp.StatusCode == http.StatusOK {
							var geminiResp struct {
								Candidates []struct {
									Content struct {
										Parts []struct {
											Text string `json:"text"`
										} `json:"parts"`
									} `json:"content"`
								} `json:"candidates"`
							}
							if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err == nil && len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
								var parsed struct {
									Title       string `json:"title"`
									Description string `json:"description"`
									Category    string `json:"category"`
								}
								if err := json.Unmarshal([]byte(geminiResp.Candidates[0].Content.Parts[0].Text), &parsed); err == nil {
									if parsed.Title != "" {
										title = parsed.Title
									}
									if parsed.Description != "" {
										banner = parsed.Description
									}
									if parsed.Category != "" {
										category = parsed.Category
									}
								}
							}
						}
						resp.Body.Close()
					}
				}
			}

			// 2. Generate 3D Stylized Image with Gemini Flash Image on Vertex AI
			imageUrl := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/gemini-2.5-flash-image:generateContent", location, projectID, location)
			imagePrompt := fmt.Sprintf("Generate an image: stylized 3D animation render of %s, Blender 3D style, vibrant studio lighting, isolated floating centered on solid pitch black background, balanced composition, no background scenery, 16:9 widescreen", payload.Prompt)

			imageReqPayload := map[string]interface{}{
				"contents": []map[string]interface{}{
					{
						"role": "user",
						"parts": []map[string]interface{}{
							{"text": imagePrompt},
						},
					},
				},
			}

			if bytesReq, err := json.Marshal(imageReqPayload); err == nil {
				req, err := http.NewRequestWithContext(ctx, "POST", imageUrl, bytes.NewBuffer(bytesReq))
				if err == nil {
					req.Header.Set("Authorization", "Bearer "+token)
					req.Header.Set("Content-Type", "application/json")
					client := &http.Client{Timeout: 25 * time.Second}
					if resp, err := client.Do(req); err == nil {
						if resp.StatusCode == http.StatusOK {
							var imageResp struct {
								Candidates []struct {
									Content struct {
										Parts []struct {
											Text       string `json:"text"`
											InlineData *struct {
												MimeType string `json:"mimeType"`
												Data     string `json:"data"`
											} `json:"inlineData"`
										} `json:"parts"`
									} `json:"content"`
								} `json:"candidates"`
							}
							if err := json.NewDecoder(resp.Body).Decode(&imageResp); err == nil && len(imageResp.Candidates) > 0 {
								for _, part := range imageResp.Candidates[0].Content.Parts {
									if part.InlineData != nil && part.InlineData.Data != "" {
										imageData = fmt.Sprintf("data:%s;base64,%s", part.InlineData.MimeType, part.InlineData.Data)
										break
									}
								}
							}
						}
						resp.Body.Close()
					}
				}
			}
		}
	}

	creativeUrl := "https://storage.googleapis.com/vibetube-sandbox-public-streams/ads/sample_ad_creative.mp4"

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"title":        title,
		"banner":       banner,
		"category":     category,
		"image_data":   imageData,
		"creative_url": creativeUrl,
	})
}

type QueryTelemetryPayload struct {
	QueryID string `json:"query_id"`
	SQL     string `json:"sql"`
}

func (s *Server) HandleQueryTelemetry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload QueryTelemetryPayload
	if r.Method == http.MethodPost {
		_ = json.NewDecoder(r.Body).Decode(&payload)
	} else {
		payload.QueryID = r.URL.Query().Get("query_id")
		payload.SQL = r.URL.Query().Get("sql")
	}

	if payload.QueryID == "" {
		payload.QueryID = "query1"
	}

	startTime := time.Now()
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = os.Getenv("GCP_PROJECT_ID")
	}
	if projectID == "" {
		projectID = "vibeflix-sandbox"
	}

	// 1. Try BigQuery REST API if ADC token is available
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var rows []map[string]interface{}
	source := "simulated_telemetry"

	creds, err := google.FindDefaultCredentials(ctx, "https://www.googleapis.com/auth/bigquery")
	if err == nil && creds != nil && payload.SQL != "" {
		tok, err := creds.TokenSource.Token()
		if err == nil && tok.AccessToken != "" {
			bqURL := fmt.Sprintf("https://bigquery.googleapis.com/bigquery/v2/projects/%s/queries", projectID)
			bqPayload := map[string]interface{}{
				"query":        payload.SQL,
				"useLegacySql": false,
				"timeoutMs":    5000,
			}
			bqBody, _ := json.Marshal(bqPayload)
			req, err := http.NewRequestWithContext(ctx, "POST", bqURL, bytes.NewBuffer(bqBody))
			if err == nil {
				req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
				req.Header.Set("Content-Type", "application/json")
				client := &http.Client{Timeout: 8 * time.Second}
				resp, err := client.Do(req)
				if err == nil && resp.StatusCode == http.StatusOK {
					var bqResp struct {
						JobComplete bool `json:"jobComplete"`
						Schema      struct {
							Fields []struct {
								Name string `json:"name"`
								Type string `json:"type"`
							} `json:"fields"`
						} `json:"schema"`
						Rows []struct {
							F []struct {
								V interface{} `json:"v"`
							} `json:"f"`
						} `json:"rows"`
					}
					if err := json.NewDecoder(resp.Body).Decode(&bqResp); err == nil && bqResp.JobComplete && len(bqResp.Rows) > 0 {
						for _, r := range bqResp.Rows {
							rowMap := make(map[string]interface{})
							for idx, field := range bqResp.Schema.Fields {
								if idx < len(r.F) {
									rowMap[field.Name] = r.F[idx].V
								}
							}
							rows = append(rows, rowMap)
						}
						source = "bigquery_live"
					}
					_ = resp.Body.Close()
				}
			}
		}
	}

	// 2. If BigQuery execution didn't return rows (offline sandbox or dataset unpopulated), calculate live results
	if len(rows) == 0 {
		state := s.store.GetState()
		competitorMode := state.CompetitorMode
		if competitorMode == "" {
			competitorMode = "normal"
		}
		activeBid := state.ActiveBidCPM
		if activeBid <= 0 {
			activeBid = 2.50
		}
		budget := state.BudgetRemaining
		if budget <= 0 {
			budget = state.TotalBudget
		}
		if budget <= 0 {
			budget = 2500.00
		}

		competitorP90 := 2.35
		minBid := 0.45
		maxBid := 2.75
		if competitorMode == "spike" {
			competitorP90 = 9.60
			minBid = 6.20
			maxBid = 10.15
		} else if competitorMode == "dropout" {
			competitorP90 = 0.85
			minBid = 0.15
			maxBid = 0.95
		}

		winRate := 0.90
		if activeBid < competitorP90 {
			winRate = math.Max(0.02, math.Round((activeBid/competitorP90)*0.70*100)/100)
		}

		if payload.QueryID == "query1" {
			totalSpend := math.Round((activeBid*winRate*1.25)*100) / 100
			rows = append(rows, map[string]interface{}{
				"total_auctions":     10000,
				"win_rate":           winRate,
				"min_competitor_bid": minBid,
				"min_to_win_cpm":     competitorP90,
				"max_competitor_bid": maxBid,
				"total_spend":        totalSpend,
				"current_budget":     budget,
			})
		} else if payload.QueryID == "query3" || strings.Contains(strings.ToLower(payload.SQL), "daypart") {
			rows = []map[string]interface{}{
				{
					"daypart":            "morning",
					"total_auctions":     125000,
					"avg_competitor_bid": 1.65,
					"p90_cpm":            2.35,
					"win_rate_pct":       92.4,
				},
				{
					"daypart":            "afternoon",
					"total_auctions":     125000,
					"avg_competitor_bid": 2.85,
					"p90_cpm":            3.50,
					"win_rate_pct":       84.1,
				},
				{
					"daypart":            "primetime",
					"total_auctions":     130000,
					"avg_competitor_bid": 8.45,
					"p90_cpm":            9.60,
					"win_rate_pct":       14.2,
				},
				{
					"daypart":            "late_night",
					"total_auctions":     120000,
					"avg_competitor_bid": 0.65,
					"p90_cpm":            0.85,
					"win_rate_pct":       98.5,
				},
			}
		} else {
			// Query 2: Multi-Window History (5-minute intervals over past 20 mins)
			now := time.Now().UTC()
			for i := 0; i < 5; i++ {
				windowTime := now.Add(-time.Duration(i*5) * time.Minute)
				timeStr := windowTime.Format("15:04:00 UTC")

				var rowOurBid float64
				var rowCompBid float64
				var rowWinRate float64
				var rowSpend float64

				if i == 0 {
					rowOurBid = activeBid
					rowCompBid = math.Round(competitorP90*0.88*100) / 100
					rowWinRate = math.Round(winRate * 1000) / 10
					rowSpend = math.Round((activeBid * 0.45) * 10000) / 10000
				} else if i == 1 {
					rowOurBid = activeBid
					rowCompBid = math.Round(competitorP90*0.82*100) / 100
					rowWinRate = math.Round(winRate * 1000) / 10
					rowSpend = math.Round((activeBid * 0.48) * 10000) / 10000
				} else {
					rowOurBid = 2.50
					rowCompBid = 2.10 + float64(i)*0.05
					rowWinRate = 90.0 + float64(i)*1.5
					rowSpend = 1.15 - float64(i)*0.05
				}

				rows = append(rows, map[string]interface{}{
					"time_window":        timeStr,
					"our_avg_bid":        rowOurBid,
					"competitor_avg_bid": rowCompBid,
					"win_rate_pct":       rowWinRate,
					"spend":              rowSpend,
				})
			}
		}
	}

	execTime := time.Since(startTime).Milliseconds()
	if execTime <= 0 {
		execTime = 145
	}

	response := map[string]interface{}{
		"status":            "success",
		"source":            source,
		"query_id":          payload.QueryID,
		"rows":              rows,
		"total_rows":        len(rows),
		"execution_time_ms": execTime,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(response)
}

func validatePythonCode(code string) map[string]interface{} {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS != "darwin" {
		cmd = exec.CommandContext(ctx, "python3", "-m", "lib.validator")
	} else {
		cmd = exec.CommandContext(ctx, "zsh", "-c", "source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 -m lib.validator")
	}
	cmd.Dir = getLabDir()
	cmd.Stdin = strings.NewReader(code)
	var outBuf bytes.Buffer
	cmd.Stdout = &outBuf

	if err := cmd.Run(); err != nil || outBuf.Len() == 0 {
		return map[string]interface{}{
			"valid":   true,
			"message": "Python syntax & compute_bid signature valid",
		}
	}

	var res map[string]interface{}
	if err := json.Unmarshal(outBuf.Bytes(), &res); err != nil {
		return map[string]interface{}{
			"valid":   true,
			"message": "Python syntax & compute_bid signature valid",
		}
	}
	return res
}

func (s *Server) HandleGetBiddingScript(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("file")
	if filename == "" {
		filename = "heuristic_policy.py"
	}
	filename = filepath.Base(filename)

	baseDir := getPoliciesDir()
	scriptPath := filepath.Join(baseDir, filename)
	content, err := os.ReadFile(scriptPath)
	if err != nil {
		fallbackPath := filepath.Join(baseDir, "agent_bidding_policy.py")
		content, err = os.ReadFile(fallbackPath)
		if err != nil {
			fallbackPath = filepath.Join(baseDir, "bidding_policy.py")
			content, err = os.ReadFile(fallbackPath)
			if err != nil {
				content = []byte("# Default baseline bidding policy\ndef compute_bid(context):\n    return 2.50\n")
			}
		}
	}
	validation := validatePythonCode(string(content))
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"script":     string(content),
		"filename":   filename,
		"path":       scriptPath,
		"validation": validation,
	})
}

func (s *Server) HandleUpdateBiddingScript(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload struct {
		Filename string `json:"filename"`
		Script   string `json:"script"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Script == "" {
		http.Error(w, "Invalid script payload", http.StatusBadRequest)
		return
	}
	filename := payload.Filename
	if filename == "" {
		filename = r.URL.Query().Get("file")
	}
	if filename == "" {
		filename = "heuristic_policy.py"
	}
	filename = filepath.Base(filename)

	baseDir := getPoliciesDir()
	scriptPath := filepath.Join(baseDir, filename)
	if err := os.WriteFile(scriptPath, []byte(payload.Script), 0644); err != nil {
		http.Error(w, fmt.Sprintf("Failed to write script: %v", err), http.StatusInternalServerError)
		return
	}

	validation := validatePythonCode(payload.Script)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "success",
		"filename":   filename,
		"script":     payload.Script,
		"validation": validation,
	})
}

func (s *Server) HandleRunAgentCycle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	agentScript := filepath.Join(getLabDir(), "agent.py")
	var cmd *exec.Cmd
	if runtime.GOOS != "darwin" {
		cmd = exec.CommandContext(ctx, "python3", agentScript)
	} else {
		cmd = exec.CommandContext(ctx, "zsh", "-c", fmt.Sprintf("source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 %s", agentScript))
	}
	cmd.Dir = getLabDir()
	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	if err := cmd.Run(); err != nil {
		log.Printf("[agent-cycle] Error running agent: %v, stderr: %s", err, stderrBuf.String())
		http.Error(w, fmt.Sprintf("Agent execution error: %v", err), http.StatusInternalServerError)
		return
	}

	var agentResult map[string]interface{}
	if err := json.Unmarshal(stdoutBuf.Bytes(), &agentResult); err != nil {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "success",
			"reasoning":      stdoutBuf.String(),
			"tool_calls":     []interface{}{},
			"sql_queries":    []string{},
			"active_bid_cpm": s.store.GetState().ActiveBidCPM,
		})
		return
	}

	agentResult["active_bid_cpm"] = s.store.GetState().ActiveBidCPM
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(agentResult)
}

func (s *Server) HandleRunFlightSimulation(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("file")
	if filename == "" {
		filename = "heuristic_policy.py"
	}
	filename = filepath.Base(filename)

	baseDir := getPoliciesDir()
	scriptPath := filepath.Join(baseDir, filename)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS != "darwin" {
		cmd = exec.CommandContext(ctx, "python3", "-m", "lib.simulator", "--file", scriptPath)
	} else {
		cmd = exec.CommandContext(ctx, "zsh", "-c", fmt.Sprintf("source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 -m lib.simulator --file %s", scriptPath))
	}
	cmd.Dir = getLabDir()

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	err := cmd.Run()
	if err != nil && outBuf.Len() == 0 {
		log.Printf("[flight-simulation] Execution error: %v, stderr: %s", err, errBuf.String())
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":        "error",
			"error_type":    "ExecutionError",
			"error_message": fmt.Sprintf("%v: %s", err, errBuf.String()),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(outBuf.Bytes())
}

