package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
)

type Campaign struct {
	ID             int     `json:"id"`
	Name           string  `json:"name"`
	TargetGenre    *string `json:"target_genre"`
	TargetLocation *string `json:"target_location"`
	BidCPM         float64 `json:"bid_cpm"`
	CreativeURL    string  `json:"creative_url"`
	Active         bool    `json:"active"`
}

// InitDB initializes the connection pool, runs migrations, and pre-populates data.
func InitDB(connStr string) (*sql.DB, error) {
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Optimize connection pool settings for performance
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Run migration
	if err := runMigration(ctx, db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	// Pre-populate campaigns
	if err := seedCampaigns(ctx, db); err != nil {
		return nil, fmt.Errorf("failed to seed campaigns: %w", err)
	}

	return db, nil
}

func runMigration(ctx context.Context, db *sql.DB) error {
	query := `
	CREATE TABLE IF NOT EXISTS campaigns (
		id SERIAL PRIMARY KEY,
		name VARCHAR(255) NOT NULL,
		target_genre VARCHAR(100),
		target_location VARCHAR(100),
		bid_cpm NUMERIC(10, 2),
		creative_url TEXT,
		active BOOLEAN DEFAULT TRUE
	);`
	_, err := db.ExecContext(ctx, query)
	return err
}

func seedCampaigns(ctx context.Context, db *sql.DB) error {
	// Check if we already have campaigns populated to avoid duplicate seeding
	var count int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM campaigns").Scan(&count)
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	log.Println("Seeding sample campaigns into the database...")
	seedQuery := `
	INSERT INTO campaigns (name, target_genre, target_location, bid_cpm, creative_url, active)
	VALUES 
		('Sci-Fi Movie Trailer', 'Sci-Fi', 'Seattle', 5.50, 'https://example.com/scifi.mp4', TRUE),
		('Energy Drink Ad', 'Action', 'Seattle', 4.20, 'https://example.com/energy.mp4', TRUE),
		('Sports Gear Ad', 'Sports', 'Vancouver', 3.80, 'https://example.com/sports.mp4', TRUE),
		('Default House Ad', NULL, NULL, 1.00, 'https://example.com/default.mp4', TRUE);`

	_, err = db.ExecContext(ctx, seedQuery)
	return err
}

// QueryWinningCampaign selects the best matching active campaign or falls back to default house ad
func QueryWinningCampaign(ctx context.Context, db *sql.DB, genre, location string) (*Campaign, error) {
	query := `
	SELECT id, name, target_genre, target_location, bid_cpm, creative_url, active
	FROM campaigns
	WHERE active = TRUE AND (
		(target_genre = $1 AND target_location = $2)
		OR
		((target_genre IS NULL OR target_genre = '') AND (target_location IS NULL OR target_location = ''))
	)
	ORDER BY 
		(CASE WHEN target_genre = $1 AND target_location = $2 THEN 0 ELSE 1 END),
		bid_cpm DESC
	LIMIT 1;`

	var c Campaign
	err := db.QueryRowContext(ctx, query, genre, location).Scan(
		&c.ID, &c.Name, &c.TargetGenre, &c.TargetLocation, &c.BidCPM, &c.CreativeURL, &c.Active,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}
