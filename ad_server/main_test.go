package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestHandleAdRequest_SuccessDirectMatch(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	mockPublisher := &MockPublisher{events: make([]interface{}, 0)}
	server := NewServer(db, mockPublisher)

	// Sample Campaign Row
	genre := "Sci-Fi"
	location := "Seattle"
	targetGenre := "Sci-Fi"
	targetLocation := "Seattle"
	rows := sqlmock.NewRows([]string{"id", "name", "target_genre", "target_location", "bid_cpm", "creative_url", "active"}).
		AddRow(1, "Sci-Fi Movie Trailer", &targetGenre, &targetLocation, 5.50, "https://example.com/scifi.mp4", true)

	// Expect the query with correct arguments
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, name, target_genre, target_location, bid_cpm, creative_url, active`)).
		WithArgs(genre, location).
		WillReturnRows(rows)

	payload := AdRequestPayload{
		UserID:            "user_test_1",
		Location:          location,
		CurrentGenre:      genre,
		AdDurationSeconds: 15,
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/request", bytes.NewReader(body))
	w := httptest.NewRecorder()

	server.HandleAdRequest(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var resp AdResponsePayload
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if resp.CampaignID != 1 {
		t.Errorf("Expected CampaignID 1, got %d", resp.CampaignID)
	}
	if resp.CreativeURL != "https://example.com/scifi.mp4" {
		t.Errorf("Expected creative url 'https://example.com/scifi.mp4', got '%s'", resp.CreativeURL)
	}
	if resp.BidCPM != 5.50 {
		t.Errorf("Expected BidCPM 5.50, got %f", resp.BidCPM)
	}

	expectedStartBeacon := "/track?event=start&campaign_id=1&user_id=user_test_1"
	expectedCompleteBeacon := "/track?event=complete&campaign_id=1&user_id=user_test_1"

	if resp.TrackingBeacons.Start != expectedStartBeacon {
		t.Errorf("Expected start beacon '%s', got '%s'", expectedStartBeacon, resp.TrackingBeacons.Start)
	}
	if resp.TrackingBeacons.Complete != expectedCompleteBeacon {
		t.Errorf("Expected complete beacon '%s', got '%s'", expectedCompleteBeacon, resp.TrackingBeacons.Complete)
	}

	// Verify telemetry publish
	mockPublisher.mu.Lock()
	defer mockPublisher.mu.Unlock()
	if len(mockPublisher.events) != 1 {
		t.Errorf("Expected 1 telemetry event published, got %d", len(mockPublisher.events))
	} else {
		event := mockPublisher.events[0].(AdServedEvent)
		if event.EventType != "AD_SERVED" {
			t.Errorf("Expected event_type 'AD_SERVED', got '%s'", event.EventType)
		}
		if event.WinningCampaignID != 1 {
			t.Errorf("Expected winning campaign ID 1, got %d", event.WinningCampaignID)
		}
	}
}

func TestHandleAdRequest_FallbackToHouseAd(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	defer db.Close()

	mockPublisher := &MockPublisher{events: make([]interface{}, 0)}
	server := NewServer(db, mockPublisher)

	// Mock DB to return the fallback house ad (targets are NULL)
	rows := sqlmock.NewRows([]string{"id", "name", "target_genre", "target_location", "bid_cpm", "creative_url", "active"}).
		AddRow(4, "Default House Ad", nil, nil, 1.00, "https://example.com/default.mp4", true)

	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, name, target_genre, target_location, bid_cpm, creative_url, active`)).
		WithArgs("Comedy", "London").
		WillReturnRows(rows)

	payload := AdRequestPayload{
		UserID:            "user_test_2",
		Location:          "London",
		CurrentGenre:      "Comedy",
		AdDurationSeconds: 30,
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/request", bytes.NewReader(body))
	w := httptest.NewRecorder()

	server.HandleAdRequest(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var resp AdResponsePayload
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if resp.CampaignID != 4 {
		t.Errorf("Expected fallback CampaignID 4, got %d", resp.CampaignID)
	}
	if resp.CreativeURL != "https://example.com/default.mp4" {
		t.Errorf("Expected creative url 'https://example.com/default.mp4', got '%s'", resp.CreativeURL)
	}
	if resp.BidCPM != 1.00 {
		t.Errorf("Expected BidCPM 1.00, got %f", resp.BidCPM)
	}
}

func TestHandleTrack_Start(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()

	mockPublisher := &MockPublisher{events: make([]interface{}, 0)}
	server := NewServer(db, mockPublisher)

	req := httptest.NewRequest(http.MethodGet, "/track?event=start&campaign_id=12&user_id=usr_99", nil)
	w := httptest.NewRecorder()

	server.HandleTrack(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	// Verify transparent pixel is returned
	if !bytes.Equal(w.Body.Bytes(), transparentPixel) {
		t.Errorf("Returned body does not match the 1x1 transparent pixel GIF")
	}

	if w.Header().Get("Content-Type") != "image/gif" {
		t.Errorf("Expected Content-Type image/gif, got '%s'", w.Header().Get("Content-Type"))
	}

	// Verify telemetry publish
	mockPublisher.mu.Lock()
	defer mockPublisher.mu.Unlock()
	if len(mockPublisher.events) != 1 {
		t.Errorf("Expected 1 telemetry event published, got %d", len(mockPublisher.events))
	} else {
		event := mockPublisher.events[0].(AdTelemetryEvent)
		if event.EventType != "AD_START" {
			t.Errorf("Expected event_type 'AD_START', got '%s'", event.EventType)
		}
		if event.CampaignID != 12 {
			t.Errorf("Expected campaign ID 12, got %d", event.CampaignID)
		}
		if event.UserID != "usr_99" {
			t.Errorf("Expected user ID 'usr_99', got '%s'", event.UserID)
		}
	}
}

func TestHandleTrack_Complete(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()

	mockPublisher := &MockPublisher{events: make([]interface{}, 0)}
	server := NewServer(db, mockPublisher)

	req := httptest.NewRequest(http.MethodGet, "/track?event=complete&campaign_id=12&user_id=usr_99", nil)
	w := httptest.NewRecorder()

	server.HandleTrack(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	mockPublisher.mu.Lock()
	defer mockPublisher.mu.Unlock()
	if len(mockPublisher.events) != 1 {
		t.Errorf("Expected 1 telemetry event published, got %d", len(mockPublisher.events))
	} else {
		event := mockPublisher.events[0].(AdTelemetryEvent)
		if event.EventType != "AD_COMPLETE" {
			t.Errorf("Expected event_type 'AD_COMPLETE', got '%s'", event.EventType)
		}
	}
}

func TestHandleTrack_InvalidParams(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()

	mockPublisher := &MockPublisher{events: make([]interface{}, 0)}
	server := NewServer(db, mockPublisher)

	// Missing campaign_id
	req := httptest.NewRequest(http.MethodGet, "/track?event=start&user_id=usr_99", nil)
	w := httptest.NewRecorder()
	server.HandleTrack(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for missing campaign_id, got %d", w.Code)
	}

	// Invalid event parameter
	req = httptest.NewRequest(http.MethodGet, "/track?event=pause&campaign_id=1&user_id=usr_99", nil)
	w = httptest.NewRecorder()
	server.HandleTrack(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for invalid event type, got %d", w.Code)
	}
}

func TestMain(m *testing.M) {
	// Execute tests
	m.Run()
}
