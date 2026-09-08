package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

func getLabDir() string {
	if env := os.Getenv("LAB_DIR"); env != "" {
		return env
	}
	candidates := []string{
		"../agentic_data_engineer",
		"./agentic_data_engineer",
		"agentic_data_engineer",
		"/app/agentic_data_engineer",
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
	return "../agentic_data_engineer"
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
