package main

import (
	"context"
	"sync"
)

type TelemetryPublisher interface {
	PublishEvent(ctx context.Context, payload interface{})
	Close() error
}

// MemoryPublisher buffers recent telemetry events in memory without external cloud dependencies.
type MemoryPublisher struct {
	events []interface{}
	mu     sync.Mutex
}

// MockPublisher is an alias for MemoryPublisher for test compatibility.
type MockPublisher = MemoryPublisher

func NewPublisher() TelemetryPublisher {
	return &MemoryPublisher{events: make([]interface{}, 0)}
}

func (m *MemoryPublisher) PublishEvent(ctx context.Context, payload interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.events = append(m.events, payload)
	if len(m.events) > 100 {
		m.events = m.events[len(m.events)-100:]
	}
}

func (m *MemoryPublisher) Close() error {
	return nil
}
