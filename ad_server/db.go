package main

import (
	"encoding/json"
	"os"
	"sync"
)

type CategoryState struct {
	ActiveBidCPM float64 `json:"active_bid_cpm"`
}

type CampaignState struct {
	Name            string                   `json:"name"`
	CreativeURL     string                   `json:"creative_url"`
	CreativeTitle   string                   `json:"creative_title"`
	CreativeBanner  string                   `json:"creative_banner"`
	BudgetRemaining float64                  `json:"budget_remaining"`
	Bids            map[string]CategoryState `json:"bids"`
	CompetitorMode  string                   `json:"competitor_mode"` // "normal", "spike", "dropout"
}

type Store struct {
	mu       sync.RWMutex
	filePath string
	State    CampaignState
}

func NewStore(filePath string) *Store {
	s := &Store{filePath: filePath}
	s.State.Bids = make(map[string]CategoryState)
	s.State.Bids["gaming"] = CategoryState{ActiveBidCPM: 2.00}
	s.State.Bids["fashion"] = CategoryState{ActiveBidCPM: 2.00}
	s.State.BudgetRemaining = 50.00
	s.State.CompetitorMode = "normal"
	
	// Load existing state if file exists
	if err := s.Load(); err != nil {
		// If load fails, save the default initial state
		_ = s.Save()
	}
	return s
}

func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, &s.State)
}

func (s *Store) Save() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	data, err := json.MarshalIndent(s.State, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *Store) GetState() CampaignState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.State
}

func (s *Store) UpdateBid(category string, bidCPM float64) error {
	s.mu.Lock()
	s.State.Bids[category] = CategoryState{ActiveBidCPM: bidCPM}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) UpdateCampaign(name, creativeURL, title, banner string) error {
	s.mu.Lock()
	s.State.Name = name
	s.State.CreativeURL = creativeURL
	s.State.CreativeTitle = title
	s.State.CreativeBanner = banner
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) DeductBudget(amount float64) error {
	s.mu.Lock()
	s.State.BudgetRemaining -= amount
	if s.State.BudgetRemaining < 0 {
		s.State.BudgetRemaining = 0
	}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) UpdateCompetitorMode(mode string) error {
	s.mu.Lock()
	s.State.CompetitorMode = mode
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) Reset() error {
	s.mu.Lock()
	s.State.Bids["gaming"] = CategoryState{ActiveBidCPM: 2.00}
	s.State.Bids["fashion"] = CategoryState{ActiveBidCPM: 2.00}
	s.State.BudgetRemaining = 50.00
	s.State.CompetitorMode = "normal"
	s.mu.Unlock()
	return s.Save()
}
