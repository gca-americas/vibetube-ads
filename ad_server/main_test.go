package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func setupTestServer() *Server {
	store := NewStore("")
	mockPublisher := &MockPublisher{events: make([]interface{}, 0)}
	return NewServer(store, mockPublisher)
}

func TestHandleGetConfig(t *testing.T) {
	server := setupTestServer()

	req := httptest.NewRequest(http.MethodGet, "/config", nil)
	w := httptest.NewRecorder()

	server.HandleGetConfig(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if resp["name"] != "Neon Runner Launch" {
		t.Errorf("Expected campaign name 'Neon Runner Launch', got '%v'", resp["name"])
	}
	if resp["competitor_mode"] != "normal" {
		t.Errorf("Expected competitor_mode 'normal', got '%v'", resp["competitor_mode"])
	}
}

func TestHandleListCampaigns(t *testing.T) {
	server := setupTestServer()

	req := httptest.NewRequest(http.MethodGet, "/campaigns", nil)
	w := httptest.NewRecorder()

	server.HandleListCampaigns(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var resp struct {
		Campaigns []CampaignState `json:"campaigns"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to unmarshal campaigns: %v", err)
	}

	if len(resp.Campaigns) == 0 {
		t.Errorf("Expected at least 1 campaign, got 0")
	}
}

func TestHandleUpdateBid(t *testing.T) {
	server := setupTestServer()

	payload := map[string]interface{}{
		"bid_cpm": 3.75,
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/bid/update", bytes.NewReader(body))
	w := httptest.NewRecorder()

	server.HandleUpdateBid(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	state := server.store.GetState()
	if state.ActiveBidCPM != 3.75 {
		t.Errorf("Expected ActiveBidCPM to be 3.75, got %f", state.ActiveBidCPM)
	}
}

func TestHandleGetOptimizationHistory(t *testing.T) {
	server := setupTestServer()

	req := httptest.NewRequest(http.MethodGet, "/optimization/history", nil)
	w := httptest.NewRecorder()

	server.HandleGetOptimizationHistory(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if resp["rounds"] == nil {
		t.Errorf("Expected rounds array in optimization history")
	}
	if resp["gemini_model"] == nil || resp["gemini_model"] == "" {
		t.Errorf("Expected gemini_model to be present")
	}
}
