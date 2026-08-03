package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"
)

type Server struct {
	db        *sql.DB
	publisher TelemetryPublisher
}

func NewServer(db *sql.DB, publisher TelemetryPublisher) *Server {
	return &Server{
		db:        db,
		publisher: publisher,
	}
}

type AdRequestPayload struct {
	UserID            string `json:"user_id"`
	Location          string `json:"location"`
	CurrentGenre      string `json:"current_genre"`
	AdDurationSeconds int    `json:"ad_duration_seconds"`
}

type TrackingBeacons struct {
	Start    string `json:"start"`
	Complete string `json:"complete"`
}

type AdResponsePayload struct {
	CampaignID      int             `json:"campaign_id"`
	CreativeURL     string          `json:"creative_url"`
	BidCPM          float64         `json:"bid_cpm"`
	TrackingBeacons TrackingBeacons `json:"tracking_beacons"`
}

var transparentPixel = []byte{
	0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
	0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
	0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
	0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
}

func (s *Server) HandleAdRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req AdRequestPayload
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// Input Validation
	if req.UserID == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	// Query DB for winning campaign
	campaign, err := QueryWinningCampaign(r.Context(), s.db, req.CurrentGenre, req.Location)
	if err != nil {
		if err == sql.ErrNoRows {
			http.Error(w, "No active campaigns available", http.StatusNotFound)
			return
		}
		log.Printf("Database error querying winning campaign: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Format tracking beacon URLs
	startBeacon := fmt.Sprintf("/track?event=start&campaign_id=%d&user_id=%s", campaign.ID, req.UserID)
	completeBeacon := fmt.Sprintf("/track?event=complete&campaign_id=%d&user_id=%s", campaign.ID, req.UserID)

	// Publish AD_SERVED event asynchronously to Pub/Sub
	servedEvent := AdServedEvent{
		EventType:         "AD_SERVED",
		RequestContext:    req,
		WinningCampaignID: campaign.ID,
		Timestamp:         time.Now().UTC().Format(time.RFC3339),
	}
	s.publisher.PublishEvent(r.Context(), servedEvent)

	// Send Response
	resp := AdResponsePayload{
		CampaignID:  campaign.ID,
		CreativeURL: campaign.CreativeURL,
		BidCPM:      campaign.BidCPM,
		TrackingBeacons: TrackingBeacons{
			Start:    startBeacon,
			Complete: completeBeacon,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("Failed to encode response payload: %v", err)
	}
}

func (s *Server) HandleTrack(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	eventParam := r.URL.Query().Get("event")
	campaignIDStr := r.URL.Query().Get("campaign_id")
	userID := r.URL.Query().Get("user_id")

	if eventParam == "" || campaignIDStr == "" || userID == "" {
		http.Error(w, "Missing event, campaign_id, or user_id", http.StatusBadRequest)
		return
	}

	campaignID, err := strconv.Atoi(campaignIDStr)
	if err != nil {
		http.Error(w, "Invalid campaign_id", http.StatusBadRequest)
		return
	}

	// Map event parameter to telemetry state
	var eventType string
	switch eventParam {
	case "start":
		eventType = "AD_START"
	case "complete":
		eventType = "AD_COMPLETE"
	default:
		http.Error(w, "Invalid event type", http.StatusBadRequest)
		return
	}

	// Publish telemetry event asynchronously to Pub/Sub
	telemetryEvent := AdTelemetryEvent{
		EventType:  eventType,
		CampaignID: campaignID,
		UserID:     userID,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}
	s.publisher.PublishEvent(r.Context(), telemetryEvent)

	// Return 1x1 transparent tracking pixel
	w.Header().Set("Content-Type", "image/gif")
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(transparentPixel)
}
