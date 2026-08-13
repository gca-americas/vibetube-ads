package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)


type Config struct {
	Port          string
	GCPProjectID  string
	PubSubTopicID string
}

func loadConfig() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	gcpProjectID := os.Getenv("GCP_PROJECT_ID")
	pubsubTopicID := os.Getenv("PUBSUB_TOPIC_ID")
	if pubsubTopicID == "" {
		pubsubTopicID = "vibetube-ad-telemetry" // Default topic name
	}

	return Config{
		Port:          port,
		GCPProjectID:  gcpProjectID,
		PubSubTopicID: pubsubTopicID,
	}
}

func main() {
	log.Println("Starting Vibeflix Local Ad-Serving Engine & Wizard...")
	cfg := loadConfig()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Telemetry Publisher
	publisher, err := NewPublisher(ctx, cfg.GCPProjectID, cfg.PubSubTopicID)
	if err != nil {
		log.Fatalf("Failed to initialize Telemetry Publisher: %v", err)
	}

	// Initialize Campaign JSON Local Store
	store := NewStore("campaign_state.json")

	// Initialize Server
	srv := NewServer(store, publisher)

	mux := http.NewServeMux()

	// API endpoints for Agent and Wizard
	mux.HandleFunc("/campaign/status", srv.HandleGetStatus)
	mux.HandleFunc("/campaign/update", srv.HandleUpdateBid)
	mux.HandleFunc("/campaign/setup", srv.HandleSetupCampaign)
	mux.HandleFunc("/campaign/generate-creative", srv.HandleGenerateCreative)
	mux.HandleFunc("/simulation/run", srv.HandleRunSimulation)
	mux.HandleFunc("/simulation/cool-down", srv.HandleTriggerDropout)
	mux.HandleFunc("/simulation/spike", srv.HandleTriggerSpike)
	mux.HandleFunc("/simulation/reset", srv.HandleReset)

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("Vibetube Ad Server API Running"))
	})

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  30 * time.Second,
	}

	// Channel to catch termination signals for graceful shutdown
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	// Run HTTP server in a separate goroutine
	go func() {
		log.Printf("Ad Server & Wizard UI is listening on http://localhost:%s ...", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP Server failed: %v", err)
		}
	}()

	// Block until we receive a signal
	sig := <-stopChan
	log.Printf("Received signal %v. Initiating graceful shutdown...", sig)

	// 1. Shutdown HTTP server first (stop accepting new requests)
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("HTTP server Shutdown failed: %v", err)
	} else {
		log.Println("HTTP server shut down successfully.")
	}

	// 2. Shut down publisher (wait for pending Pub/Sub telemetry writes to flush)
	if err := publisher.Close(); err != nil {
		log.Printf("Publisher Close failed: %v", err)
	} else {
		log.Println("Telemetry publisher shut down successfully.")
	}

	log.Println("Service stopped cleanly.")
}
