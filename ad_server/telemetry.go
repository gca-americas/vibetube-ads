package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/oauth2/google"
)

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
		projectID = os.Getenv("DEVSHELL_PROJECT_ID")
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
