package main

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"sync"
	"time"
)

type CampaignState struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	CreativeURL     string  `json:"creative_url"`
	CreativeTitle   string  `json:"creative_title"`
	CreativeBanner  string  `json:"creative_banner"`
	BudgetRemaining float64 `json:"budget_remaining"`
	TotalBudget     float64 `json:"total_budget"`
	Strategy        string            `json:"strategy"`
	BaseBidCPM      float64           `json:"base_bid_cpm"`
	ActiveBidCPM    float64           `json:"active_bid_cpm"`
	MaxBidCeiling   float64           `json:"max_bid_ceiling"`
	CompetitorMode  string            `json:"competitor_mode"` // "normal", "spike", "dropout"
	Status          string            `json:"status"`
	CreatedAt       string            `json:"created_at"`
	StrategyCodes   map[string]string `json:"strategy_codes,omitempty"`
}

type StoreData struct {
	Campaigns        map[string]CampaignState `json:"campaigns"`
	ActiveCampaignID string                   `json:"active_campaign_id"`
	// backward compatibility fields
	Name            string  `json:"name,omitempty"`
	CreativeURL     string  `json:"creative_url,omitempty"`
	CreativeTitle   string  `json:"creative_title,omitempty"`
	CreativeBanner  string  `json:"creative_banner,omitempty"`
	BudgetRemaining float64 `json:"budget_remaining,omitempty"`
	ActiveBidCPM    float64 `json:"active_bid_cpm,omitempty"`
	MaxBidCeiling   float64 `json:"max_bid_ceiling,omitempty"`
	CompetitorMode  string  `json:"competitor_mode,omitempty"`
}

type Store struct {
	mu       sync.RWMutex
	filePath string
	Data     StoreData
}

func NewStore(filePath string) *Store {
	s := &Store{filePath: filePath}
	s.Data.Campaigns = make(map[string]CampaignState)
	s.Data.CompetitorMode = "normal"
	
	// Load existing state if file exists
	if err := s.Load(); err != nil || len(s.Data.Campaigns) == 0 {
		defaultCampID := "camp-default"
		s.Data.Campaigns[defaultCampID] = CampaignState{
			ID:              defaultCampID,
			Name:            "Neon Runner Launch",
			CreativeURL:     "/images/creatives/sneaker.jpg",
			CreativeTitle:   "Neon Runner Pro",
			CreativeBanner:  "Responsive neon cushioning with kinetic energy return.",
			BudgetRemaining: 2500.00,
			TotalBudget:     2500.00,
			Strategy:        "deterministic",
			ActiveBidCPM:    2.50,
			MaxBidCeiling:   10.00,
			CompetitorMode:  "normal",
			Status:          "active",
			CreatedAt:       time.Now().Format(time.RFC3339),
		}
		s.Data.ActiveCampaignID = defaultCampID
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

	if err := json.Unmarshal(data, &s.Data); err == nil && s.Data.Campaigns != nil {
		return nil
	}

	var single CampaignState
	if err := json.Unmarshal(data, &single); err == nil && single.Name != "" {
		if single.ID == "" {
			single.ID = "camp-1"
		}
		if single.ActiveBidCPM <= 0 {
			single.ActiveBidCPM = 2.50
		}
		s.Data.Campaigns = map[string]CampaignState{single.ID: single}
		s.Data.ActiveCampaignID = single.ID
		return nil
	}

	return nil
}

func (s *Store) Save() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if active, ok := s.Data.Campaigns[s.Data.ActiveCampaignID]; ok {
		s.Data.Name = active.Name
		s.Data.CreativeURL = active.CreativeURL
		s.Data.CreativeTitle = active.CreativeTitle
		s.Data.CreativeBanner = active.CreativeBanner
		s.Data.BudgetRemaining = active.BudgetRemaining
		s.Data.ActiveBidCPM = active.ActiveBidCPM
		s.Data.MaxBidCeiling = active.MaxBidCeiling
		s.Data.CompetitorMode = active.CompetitorMode
	}

	data, err := json.MarshalIndent(s.Data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.filePath, data, 0644)
}

func (s *Store) GetCampaigns() []CampaignState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var list []CampaignState
	for _, c := range s.Data.Campaigns {
		if c.MaxBidCeiling <= 0 {
			c.MaxBidCeiling = 10.00
		}
		list = append(list, c)
	}
	return list
}

func (s *Store) GetState() CampaignState {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	if active, ok := s.Data.Campaigns[s.Data.ActiveCampaignID]; ok {
		if active.ActiveBidCPM <= 0 {
			active.ActiveBidCPM = 2.50
		}
		if active.MaxBidCeiling <= 0 {
			active.MaxBidCeiling = 10.00
		}
		return active
	}
	for _, c := range s.Data.Campaigns {
		if c.ActiveBidCPM <= 0 {
			c.ActiveBidCPM = 2.50
		}
		if c.MaxBidCeiling <= 0 {
			c.MaxBidCeiling = 10.00
		}
		return c
	}
	return CampaignState{
		ID:              "camp-default",
		Name:            "Neon Runner Launch",
		BudgetRemaining: 2500.00,
		TotalBudget:     2500.00,
		Strategy:        "deterministic",
		ActiveBidCPM:    2.50,
		MaxBidCeiling:   10.00,
		CompetitorMode:  "normal",
		Status:          "active",
	}
}

func (s *Store) SaveCampaign(camp CampaignState) error {
	s.mu.Lock()
	if camp.ID == "" {
		camp.ID = fmt.Sprintf("camp-%d", time.Now().UnixMilli())
	}
	if camp.CreatedAt == "" {
		camp.CreatedAt = time.Now().Format(time.RFC3339)
	}
	if camp.BaseBidCPM <= 0 {
		if camp.ActiveBidCPM > 0 {
			camp.BaseBidCPM = camp.ActiveBidCPM
		} else {
			camp.BaseBidCPM = 2.50
		}
	}
	if camp.ActiveBidCPM <= 0 {
		camp.ActiveBidCPM = camp.BaseBidCPM
	}
	if camp.MaxBidCeiling <= 0 {
		camp.MaxBidCeiling = 10.00
	}
	if camp.TotalBudget <= 0 {
		camp.TotalBudget = 2500.00
	}
	if camp.BudgetRemaining <= 0 {
		camp.BudgetRemaining = camp.TotalBudget
	}
	if camp.Status == "" {
		camp.Status = "active"
	}
	s.Data.Campaigns[camp.ID] = camp
	s.Data.ActiveCampaignID = camp.ID
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) UpdateBid(bidCPM float64) error {
	s.mu.Lock()
	if active, ok := s.Data.Campaigns[s.Data.ActiveCampaignID]; ok {
		if active.MaxBidCeiling > 0 && bidCPM > active.MaxBidCeiling {
			bidCPM = active.MaxBidCeiling
		}
		active.ActiveBidCPM = bidCPM
		s.Data.Campaigns[s.Data.ActiveCampaignID] = active
	}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) DeleteCampaign(id string) error {
	s.mu.Lock()
	delete(s.Data.Campaigns, id)
	if s.Data.ActiveCampaignID == id {
		for k := range s.Data.Campaigns {
			s.Data.ActiveCampaignID = k
			break
		}
	}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) DeductBudget(amount float64) error {
	s.mu.Lock()
	if active, ok := s.Data.Campaigns[s.Data.ActiveCampaignID]; ok {
		active.BudgetRemaining = math.Round((active.BudgetRemaining-amount)*100000) / 100000
		if active.BudgetRemaining < 0 {
			active.BudgetRemaining = 0
		}
		s.Data.Campaigns[s.Data.ActiveCampaignID] = active
	}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) UpdateCompetitorMode(mode string) error {
	s.mu.Lock()
	s.Data.CompetitorMode = mode
	if active, ok := s.Data.Campaigns[s.Data.ActiveCampaignID]; ok {
		active.CompetitorMode = mode
		s.Data.Campaigns[s.Data.ActiveCampaignID] = active
	}
	s.mu.Unlock()
	return s.Save()
}

func (s *Store) Reset() error {
	s.mu.Lock()
	for id, camp := range s.Data.Campaigns {
		if camp.BaseBidCPM > 0 {
			camp.ActiveBidCPM = camp.BaseBidCPM
		} else {
			camp.ActiveBidCPM = 2.50
		}
		camp.BudgetRemaining = camp.TotalBudget
		camp.CompetitorMode = "normal"
		s.Data.Campaigns[id] = camp
	}
	if len(s.Data.Campaigns) == 0 {
		defaultCampID := "camp-default"
		s.Data.Campaigns[defaultCampID] = CampaignState{
			ID:              defaultCampID,
			Name:            "Neon Runner Launch",
			CreativeURL:     "/images/creatives/sneaker.jpg",
			CreativeTitle:   "Neon Runner Pro",
			CreativeBanner:  "Responsive neon cushioning with kinetic energy return.",
			BudgetRemaining: 2500.00,
			TotalBudget:     2500.00,
			Strategy:        "deterministic",
			BaseBidCPM:      2.50,
			ActiveBidCPM:    2.50,
			MaxBidCeiling:   10.00,
			CompetitorMode:  "normal",
			Status:          "active",
			CreatedAt:       time.Now().Format(time.RFC3339),
		}
		s.Data.ActiveCampaignID = defaultCampID
	}
	s.Data.CompetitorMode = "normal"
	s.mu.Unlock()
	return s.Save()
}

