package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"sort"
	"time"
)

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

func generate24HourCompetitorBids(stepIndex int, totalSteps int, totalAuctions int) ([]float64, string, string) {
	bids := make([]float64, totalAuctions)
	if totalSteps <= 0 {
		totalSteps = 50
	}
	t := (float64(stepIndex) / float64(totalSteps)) * 24.0 // Hour 0.0 to 24.0

	var daypart string
	var mode string
	var baseMean float64

	// 1. Layer 1: Daily Market Curve & Daypart Classification
	if t < 6.0 {
		daypart = "late_night"
		mode = "dropout"
		baseMean = 0.85 + 0.10*math.Sin(t) // $0.85 – $0.95
	} else if t < 12.0 {
		daypart = "morning"
		mode = "normal"
		baseMean = 1.40 + (t-6.0)*0.18 // $1.40 -> $2.48
	} else if t < 14.0 {
		daypart = "lunch"
		mode = "spike"
		baseMean = 3.80 + 0.50*math.Sin((t-12.0)*math.Pi/2.0) // Lunch rush peak ~$4.30
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
	} else if t < 17.0 {
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
