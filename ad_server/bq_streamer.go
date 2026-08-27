package main

import (
	"context"
	"log"
	"os"
	"time"

	"cloud.google.com/go/bigquery"
)

type AuctionEventRow struct {
	EventID                 string    `bigquery:"event_id"`
	Timestamp               time.Time `bigquery:"timestamp"`
	Daypart                 string    `bigquery:"daypart"`
	CampaignID              string    `bigquery:"campaign_id"`
	BidCPM                  float64   `bigquery:"bid_cpm"`
	CompetitorHighestBidCPM float64   `bigquery:"competitor_highest_bid_cpm"`
	Win                     bool      `bigquery:"win"`
	Cost                    float64   `bigquery:"cost"`
	Revenue                 float64   `bigquery:"revenue"`
	BudgetRemaining         float64   `bigquery:"budget_remaining"`
	CompetitorMode          string    `bigquery:"competitor_mode"`
}

func StreamAuctionEventsToBigQuery(ctx context.Context, rows []*AuctionEventRow) error {
	projectID := os.Getenv("GOOGLE_CLOUD_PROJECT")
	if projectID == "" {
		projectID = "vibeflix-sandbox"
	}
	datasetID := os.Getenv("BQ_DATASET_ID")
	if datasetID == "" {
		datasetID = "vibetube_telemetry"
	}
	tableID := os.Getenv("BQ_TABLE_ID")
	if tableID == "" {
		tableID = "auction_events"
	}

	client, err := bigquery.NewClient(ctx, projectID)
	if err != nil {
		log.Printf("[bq-streamer] Failed to initialize BigQuery client: %v", err)
		return err
	}
	defer client.Close()

	inserter := client.Dataset(datasetID).Table(tableID).Inserter()
	if err := inserter.Put(ctx, rows); err != nil {
		log.Printf("[bq-streamer] BigQuery insert error: %v", err)
		return err
	}
	log.Printf("[bq-streamer] Successfully streamed %d events directly to BigQuery (%s.%s.%s)", len(rows), projectID, datasetID, tableID)
	return nil
}
