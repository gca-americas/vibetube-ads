package main

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"cloud.google.com/go/pubsub"
)

type TelemetryPublisher interface {
	PublishEvent(ctx context.Context, payload interface{})
	Close() error
}

type PubSubPublisher struct {
	client     *pubsub.Client
	topic      *pubsub.Topic
	eventsChan chan []byte
	workersWg  sync.WaitGroup
	ctx        context.Context
	cancel     context.CancelFunc
}

// MockPublisher is used when GCP Project ID or Topic ID is missing or set to mock.
type MockPublisher struct {
	events []interface{}
	mu     sync.Mutex
}

func (m *MockPublisher) PublishEvent(ctx context.Context, payload interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events = append(m.events, payload)
	if len(m.events) > 100 {
		m.events = m.events[len(m.events)-100:]
	}
}

func (m *MockPublisher) Close() error {
	log.Println("[MockTelemetry] Closed publisher")
	return nil
}

// AsyncPublisher wraps a publisher so HTTP server startup is never blocked by remote Pub/Sub checks.
type AsyncPublisher struct {
	mu      sync.RWMutex
	current TelemetryPublisher
}

func (a *AsyncPublisher) PublishEvent(ctx context.Context, payload interface{}) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	a.current.PublishEvent(ctx, payload)
}

func (a *AsyncPublisher) Close() error {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.current.Close()
}

// NewPublisher initializes Pub/Sub in the background so HTTP server startup is instantaneous.
func NewPublisher(ctx context.Context, projectID, topicID string) (TelemetryPublisher, error) {
	mock := &MockPublisher{events: make([]interface{}, 0)}
	if projectID == "" || projectID == "mock" {
		log.Println("[info] GCP_PROJECT_ID not set or set to 'mock'. Using Mock Telemetry Publisher.")
		return mock, nil
	}

	asyncPub := &AsyncPublisher{current: mock}

	go func() {
		initCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		client, err := pubsub.NewClient(initCtx, projectID)
		if err != nil {
			log.Printf("[info] Pub/Sub client initialization skipped (%v). Retaining Mock Telemetry Publisher.", err)
			return
		}

		topic := client.Topic(topicID)
		exists, err := topic.Exists(initCtx)
		if err != nil {
			log.Printf("[info] Pub/Sub topic check skipped (%v). Retaining Mock Telemetry Publisher.", err)
			client.Close()
			return
		}

		if !exists {
			log.Printf("Pub/Sub Topic '%s' does not exist. Creating it...", topicID)
			topic, err = client.CreateTopic(initCtx, topicID)
			if err != nil {
				log.Printf("[info] Pub/Sub CreateTopic note (%v). Retaining Mock Telemetry Publisher.", err)
				client.Close()
				return
			}
		}

		pubCtx, pubCancel := context.WithCancel(context.Background())
		p := &PubSubPublisher{
			client:     client,
			topic:      topic,
			eventsChan: make(chan []byte, 10000), // Buffered channel to protect against spikes
			ctx:        pubCtx,
			cancel:     pubCancel,
		}

		// Start 5 worker goroutines to drain the channel and publish to Pub/Sub
		for i := 0; i < 5; i++ {
			p.workersWg.Add(1)
			go p.worker()
		}

		asyncPub.mu.Lock()
		asyncPub.current = p
		asyncPub.mu.Unlock()
		log.Printf("[info] Connected to real Pub/Sub telemetry pipeline for topic '%s'", topicID)
	}()

	return asyncPub, nil
}

func (p *PubSubPublisher) PublishEvent(ctx context.Context, payload interface{}) {
	bytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal event payload: %v", err)
		return
	}

	select {
	case p.eventsChan <- bytes:
	default:
		log.Println("Warning: Telemetry events channel is full, dropping event")
	}
}

func (p *PubSubPublisher) worker() {
	defer p.workersWg.Done()
	for {
		select {
		case <-p.ctx.Done():
			// Process remaining buffered items up to a reasonable limit before stopping
			for {
				select {
				case msg := <-p.eventsChan:
					p.publish(msg)
				default:
					return
				}
			}
		case msg := <-p.eventsChan:
			p.publish(msg)
		}
	}
}

func (p *PubSubPublisher) publish(msg []byte) {
	// topic.Publish is thread-safe and executes asynchronously in the background.
	// We call Get on the result in a separate goroutine to verify delivery.
	res := p.topic.Publish(p.ctx, &pubsub.Message{
		Data: msg,
	})

	go func(r *pubsub.PublishResult) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		id, err := r.Get(ctx)
		if err != nil {
			log.Printf("Failed to publish telemetry event to Pub/Sub: %v", err)
		} else {
			_ = id // Successfully sent, event ID can be optionally logged
		}
	}(res)
}

func (p *PubSubPublisher) Close() error {
	p.cancel()
	p.workersWg.Wait()
	p.topic.Stop()
	return p.client.Close()
}
