package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"
)

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
	Category string  `json:"category"`
	BidCPM   float64 `json:"bid_cpm"`
}

type CampaignSetupPayload struct {
	Name           string `json:"name"`
	CreativeURL    string `json:"creative_url"`
	CreativeTitle  string `json:"creative_title"`
	CreativeBanner string `json:"creative_banner"`
}

type SimulationPayload struct {
	UserID string `json:"userId"`
}

type AuctionTelemetryEvent struct {
	EventType               string  `json:"event_type"`
	Timestamp               string  `json:"timestamp"`
	BidCPM                  float64 `json:"bid_cpm"`
	Win                     int     `json:"win"`
	Cost                    float64 `json:"cost"`
	Revenue                 float64 `json:"revenue"`
	Category                string  `json:"category"`
	BudgetRemaining         float64 `json:"budget_remaining"`
	CompetitorHighestBidCPM float64 `json:"competitor_highest_bid_cpm"`
}

func (s *Server) HandleGetStatus(w http.ResponseWriter, r *http.Request) {
	state := s.store.GetState()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(state)
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
	if payload.Category != "gaming" && payload.Category != "fashion" {
		http.Error(w, "Invalid category: must be gaming or fashion", http.StatusBadRequest)
		return
	}
	if err := s.store.UpdateBid(payload.Category, payload.BidCPM); err != nil {
		http.Error(w, "Failed to update bid", http.StatusInternalServerError)
		return
	}
	log.Printf("Updated bid for %s to $%.2f", payload.Category, payload.BidCPM)
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
	if err := s.store.UpdateCampaign(payload.Name, payload.CreativeURL, payload.CreativeTitle, payload.CreativeBanner); err != nil {
		http.Error(w, "Failed to setup campaign", http.StatusInternalServerError)
		return
	}
	log.Printf("Configured campaign: %s (Creative: %s)", payload.Name, payload.CreativeURL)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
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

	totalAuctions := 20 // 10 gaming, 10 fashion
	wins := 0
	totalCost := 0.0
	totalRevenue := 0.0

	categories := []string{"gaming", "fashion"}

	for i := 0; i < totalAuctions; i++ {
		category := categories[i%2]
		bidCPM := state.Bids[category].ActiveBidCPM

		// Generate competitor bid based on mode
		competitorBid := 0.0
		switch state.CompetitorMode {
		case "spike":
			if category == "gaming" {
				competitorBid = 3.50 + rand.Float64()*2.50 // P90 is around $5.75
			} else {
				competitorBid = 6.00 + rand.Float64()*4.00 // P90 is around $9.60
			}
		case "dropout":
			if category == "gaming" {
				competitorBid = 0.20 + rand.Float64()*0.60 // P90 is around $0.74
			} else {
				competitorBid = 0.80 + rand.Float64()*1.20 // P90 is around $1.88
			}
		default: // "normal"
			if category == "gaming" {
				competitorBid = 1.00 + rand.Float64()*1.50 // P90 is around $2.35
			} else {
				competitorBid = 3.50 + rand.Float64()*3.00 // P90 is around $6.20
			}
		}

		win := 0
		cost := 0.0
		revenue := 0.0

		// Check if budget is depleted
		if state.BudgetRemaining > 0 && bidCPM > competitorBid {
			win = 1
			wins++
			cost = bidCPM
			impressionCost := cost / 1000.0
			_ = s.store.DeductBudget(impressionCost)
			totalCost += impressionCost

			// Simulate CTR click
			if rand.Float64() < 0.05 { // 5% CTR
				revenue = 0.15
				totalRevenue += revenue
			}
		}

		// Refresh state for latest remaining budget
		state = s.store.GetState()

		// Publish to BigQuery via Pub/Sub
		telemetryEvent := AuctionTelemetryEvent{
			EventType:               "AUCTION_EVENT",
			Timestamp:               time.Now().UTC().Format(time.RFC3339),
			BidCPM:                  bidCPM,
			Win:                     win,
			Cost:                    cost,
			Revenue:                 revenue,
			Category:                category,
			BudgetRemaining:         state.BudgetRemaining,
			CompetitorHighestBidCPM: competitorBid,
		}
		s.publisher.PublishEvent(r.Context(), telemetryEvent)
	}

	// Register winning ad with Vibetube Backend if we had any wins and creative URL is set
	if wins > 0 && state.CreativeURL != "" {
		err := s.registerAdWithVibetube(payload.UserID, state.CreativeURL, state.Name, state.Bids["gaming"].ActiveBidCPM)
		if err != nil {
			log.Printf("Failed to register ad on Vibetube: %v", err)
		} else {
			log.Printf("Successfully registered custom ad creative on Vibetube for user: %s", payload.UserID)
		}
	} else {
		// Clear registered ad to default fallback
		_ = s.registerAdWithVibetube(payload.UserID, "https://storage.googleapis.com/vibetube-sandbox-public-streams/ads/default_preroll.mp4", "Default Brand Promo", 0.0)
	}

	// Return summary
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(fmt.Sprintf(`{
		"status": "success",
		"total_auctions": %d,
		"wins": %d,
		"cost": %.4f,
		"revenue": %.4f,
		"budget_remaining": %.4f
	}`, totalAuctions, wins, totalCost, totalRevenue, state.BudgetRemaining)))
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

	apiKey := os.Getenv("GEMINI_API_KEY")
	title := "Neon Kickz"
	banner := "Light up your step with the retro neon sneaker!"
	creativeUrl := "https://storage.googleapis.com/vibetube-sandbox-public-streams/ads/sample_ad_creative.mp4"

	if apiKey != "" {
		geminiUrl := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=%s", apiKey)
		geminiReqPayload := map[string]interface{}{
			"contents": []map[string]interface{}{
				{
					"parts": []map[string]interface{}{
						{
							"text": fmt.Sprintf("Create a catchy ad campaign: write a short title (under 15 chars) and a brief description (under 40 chars) based on this prompt: '%s'. Respond ONLY with a JSON object containing keys 'title' and 'description'. Do not output markdown code blocks.", payload.Prompt),
						},
					},
				},
			},
			"generationConfig": map[string]interface{}{
				"responseMimeType": "application/json",
			},
		}

		bytesReq, err := json.Marshal(geminiReqPayload)
		if err == nil {
			req, err := http.NewRequest("POST", geminiUrl, bytes.NewBuffer(bytesReq))
			if err == nil {
				req.Header.Set("Content-Type", "application/json")
				client := &http.Client{Timeout: 10 * time.Second}
				resp, err := client.Do(req)
				if err == nil && resp.StatusCode == http.StatusOK {
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
						rawJson := geminiResp.Candidates[0].Content.Parts[0].Text
						var parsed struct {
							Title       string `json:"title"`
							Description string `json:"description"`
						}
						if err := json.Unmarshal([]byte(rawJson), &parsed); err == nil {
							title = parsed.Title
							banner = parsed.Description
						}
					}
					resp.Body.Close()
				}
			}
		}
	}

	// Update campaign in store
	_ = s.store.UpdateCampaign("My Gemini Campaign", creativeUrl, title, banner)

	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(fmt.Sprintf(`{
		"title": %q,
		"banner": %q,
		"creative_url": %q
	}`, title, banner, creativeUrl)))
}

