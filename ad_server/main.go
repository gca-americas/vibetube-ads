package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

type Config struct {
	Port          string
	DBConnStr     string
	GCPProjectID  string
	PubSubTopicID string
}

func loadConfig() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}

	dbPort := os.Getenv("DB_PORT")
	if dbPort == "" {
		dbPort = "5432"
	}

	dbUser := os.Getenv("DB_USER")
	if dbUser == "" {
		dbUser = "postgres"
	}

	dbPass := os.Getenv("DB_PASSWORD")

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "postgres"
	}

	gcpProjectID := os.Getenv("GCP_PROJECT_ID")
	pubsubTopicID := os.Getenv("PUBSUB_TOPIC_ID")
	if pubsubTopicID == "" {
		pubsubTopicID = "vibeflix-ad-telemetry"
	}

	// Build PostgreSQL connection string
	dbConnStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		dbHost, dbPort, dbUser, dbPass, dbName)

	return Config{
		Port:          port,
		DBConnStr:     dbConnStr,
		GCPProjectID:  gcpProjectID,
		PubSubTopicID: pubsubTopicID,
	}
}

func main() {
	log.Println("Starting Vibeflix Ad-Serving Engine...")
	cfg := loadConfig()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initialize Telemetry Publisher
	publisher, err := NewPublisher(ctx, cfg.GCPProjectID, cfg.PubSubTopicID)
	if err != nil {
		log.Fatalf("Failed to initialize Telemetry Publisher: %v", err)
	}

	// Initialize Database connection and run migrations
	db, err := InitDB(cfg.DBConnStr)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize Server and handlers
	srv := NewServer(db, publisher)

	mux := http.NewServeMux()
	mux.HandleFunc("/request", srv.HandleAdRequest)
	mux.HandleFunc("/track", srv.HandleTrack)

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		IdleTimeout:  30 * time.Second,
	}

	// Channel to catch termination signals for graceful shutdown
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	// Run HTTP server in a separate goroutine
	go func() {
		log.Printf("HTTP Server is listening on port %s...", cfg.Port)
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
